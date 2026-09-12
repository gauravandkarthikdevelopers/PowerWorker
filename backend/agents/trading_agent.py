"""
trading_agent.py
TradingAgent: the peer-to-peer (P2P) energy market maker for the
PowerWorker micro-grid.

Responsibilities:
- Continuously monitor hyper-local generation vs. demand per household
  (net position: surplus solar producer vs. deficit consumer).
- During peak demand or a community-wide supply shortfall, autonomously
  match surplus households with deficit households and execute trades at
  a dynamic price strictly between the wholesale solar cost and the grid
  tariff — a strict win for both sides versus importing from the grid.
- Ask the AI reasoning layer (deepseek-chat via aicredits.in) for a short
  market-commentary narrative explaining *why* the market behaved the way
  it did this cycle. Falls back to a deterministic template if the LLM is
  unavailable, so the pipeline never depends on network reachability.

Runs after the Optimizer node so it can see the resolved community-level
shortfall/grid-import decision.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from agents.state import CommunityState
from agents.logger import log_event
from agents.memory import record_trades, get_market_memory, set_market_memory
from llms.aicredits_client import AICreditsClient

# Fraction of community households that own rooftop solar (prosumers).
# Deterministic per house_id so the same house is a producer every cycle.
PROSUMER_SHARE = 0.60

# Ignore net positions smaller than this — avoids noisy micro-trades.
NET_POSITION_FLOOR_KWH = 0.05

# Hard cap on trades executed per cycle — keeps the ledger/demo readable.
MAX_TRADES_PER_CYCLE = 12

# When the grid is down (tariff drops to 0), energy is scarce and most valuable.
# Use this reference ₹/kWh so P2P trades during an outage reflect real value.
OUTAGE_REFERENCE_PRICE = 12.0

# Peer price sits between this fraction of the grid tariff (seller floor)
# and this fraction (buyer ceiling) — both scaled further by scarcity.
PRICE_FLOOR_FRACTION = 0.55
PRICE_CEIL_FRACTION = 0.92

_ai = AICreditsClient()


def _rooftop_factor(house_id: str) -> float:
    """Deterministic pseudo-random 0..1 value derived from house_id.

    Used to decide (a) whether a household owns rooftop solar and (b) its
    relative panel capacity, without needing to mutate the shared mock-data
    generator or duplicate per-house state.
    """
    digest = hashlib.md5(house_id.encode("utf-8")).hexdigest()
    return (int(digest[:8], 16) % 10_000) / 10_000.0


def _current_hour_label(state: CommunityState) -> str:
    timestamp = state.get("timestamp", "")
    try:
        hour_part = timestamp.split("T")[1][:2] if "T" in timestamp else timestamp[11:13]
        return f"{hour_part}:00"
    except (IndexError, ValueError):
        return ""


def _dynamic_price(grid_price: float, scarcity_ratio: float) -> float:
    scarcity_ratio = max(0.0, min(1.0, scarcity_ratio))
    fraction = PRICE_FLOOR_FRACTION + (PRICE_CEIL_FRACTION - PRICE_FLOOR_FRACTION) * scarcity_ratio
    return round(grid_price * fraction, 2)


def _template_market_narrative(
    trade_count: int, total_kwh: float, total_savings: float, is_peak: bool, is_shortfall: bool
) -> str:
    if trade_count == 0:
        return (
            "Local generation currently covers local demand — the trading agent held "
            "off on P2P settlement this cycle and is monitoring for the next imbalance."
        )
    trigger = "peak-pricing window" if is_peak else "community supply shortfall"
    return (
        f"Detected a {trigger} and autonomously matched {trade_count} household pair(s), "
        f"routing {total_kwh:.1f} kWh directly between neighbors instead of the grid — "
        f"saving the community an estimated ₹{total_savings:,.0f} versus grid import."
    )


def trading_agent_fn(state: CommunityState) -> CommunityState:
    households = state["households"]
    solar = state["solar"]
    grid = state["grid"]
    decisions = state.get("decisions", {})

    total_demand = sum(h["current_demand"] for h in households)
    community_generation = max(0.0, solar["current_generation"])

    # Classify prosumers deterministically and size their rooftop capacity
    # so the sum of prosumer generation reconciles with community generation.
    enriched: list[dict] = []
    capacity_weights: dict[str, float] = {}
    for h in households:
        factor = _rooftop_factor(h["house_id"])
        is_prosumer = factor < PROSUMER_SHARE
        capacity_weights[h["house_id"]] = factor if is_prosumer else 0.0

    total_weight = sum(capacity_weights.values()) or 1.0

    net_positions: list[dict] = []
    for h in households:
        weight = capacity_weights[h["house_id"]]
        house_generation = (weight / total_weight) * community_generation if weight > 0 else 0.0
        net = round(house_generation - h["current_demand"], 3)
        role = "seller" if net > NET_POSITION_FLOOR_KWH else ("buyer" if net < -NET_POSITION_FLOOR_KWH else "balanced")
        entry = {"house_id": h["house_id"], "net_kwh": net, "role": role}
        net_positions.append(entry)
        enriched.append(entry)

    state["house_net_positions"] = net_positions

    shortfall_kwh = float(decisions.get("grid_import_kw", 0.0))
    is_shortfall = shortfall_kwh > 0.01
    current_hour = _current_hour_label(state)
    is_peak = bool(current_hour and current_hour in grid.get("peak_hours", []))

    trades: list[dict] = []

    context_label = (
        "a peak-pricing window" if is_peak
        else "a community supply shortfall" if is_shortfall
        else "local demand balancing, keeping energy off the grid"
    )

    # P2P value exists whenever a surplus house can supply a deficit neighbor —
    # this is true even when the community is net-positive. Peak demand and
    # shortfall simply push the clearing price up (scarcity pricing).
    sellers = sorted([e for e in enriched if e["role"] == "seller"], key=lambda e: -e["net_kwh"])
    buyers = sorted([e for e in enriched if e["role"] == "buyer"], key=lambda e: e["net_kwh"])
    remaining_seller_kwh = {s["house_id"]: s["net_kwh"] for s in sellers}

    grid_online = grid.get("availability", True) and grid["price_per_kwh"] > 0.5
    ref_grid_price = grid["price_per_kwh"] if grid_online else OUTAGE_REFERENCE_PRICE
    peak_premium = 0.5 if not grid_online else (0.35 if (is_peak or is_shortfall) else 0.0)
    scarcity_ratio = ((shortfall_kwh / total_demand) if total_demand > 0 else 0.0) + peak_premium
    price = _dynamic_price(ref_grid_price, scarcity_ratio)

    # --- Cross-cycle memory: the Trading agent recalls how well supply met
    # demand last cycle and adapts this cycle's clearing price accordingly.
    # A real autonomous feedback loop, not a one-shot formula.
    demanded_kwh = round(sum(max(0.0, -b["net_kwh"]) for b in buyers), 3)
    market_mem = get_market_memory()
    last_fill = market_mem.get("fill_ratio")
    adaptation_note = ""
    if isinstance(last_fill, (int, float)):
        # High fill last cycle (ample supply) -> ease price toward the floor to
        # move more energy; low fill (scarce) -> firm price toward the ceiling.
        adj = (0.5 - float(last_fill)) * 0.15
        floor_price = ref_grid_price * PRICE_FLOOR_FRACTION
        ceil_price = ref_grid_price * PRICE_CEIL_FRACTION
        price = round(max(floor_price, min(ceil_price, price * (1 + adj))), 2)
        if adj < -0.005:
            adaptation_note = (
                f"Recall: sellers had surplus last cycle (fill {last_fill:.0%}) \u2014 "
                f"lowered the clearing price {abs(adj) * 100:.0f}% to \u20b9{price:.2f}/kWh to move more energy."
            )
        elif adj > 0.005:
            adaptation_note = (
                f"Recall: demand outstripped supply last cycle (fill {last_fill:.0%}) \u2014 "
                f"firmed the clearing price {adj * 100:.0f}% to \u20b9{price:.2f}/kWh."
            )
    now_iso = datetime.now(timezone.utc).isoformat()

    if sellers and buyers:

        for buyer in buyers:
            if len(trades) >= MAX_TRADES_PER_CYCLE:
                break
            need = -buyer["net_kwh"]
            for seller in sellers:
                if need <= 0.01 or len(trades) >= MAX_TRADES_PER_CYCLE:
                    break
                available = remaining_seller_kwh[seller["house_id"]]
                if available <= 0.01:
                    continue
                qty = round(min(available, need), 3)
                if qty <= 0.01:
                    continue
                total_inr = round(qty * price, 2)
                grid_cost = round(qty * ref_grid_price, 2)
                savings = round(grid_cost - total_inr, 2)
                trades.append({
                    "trade_id": f"TRX-{len(trades) + 1:03d}-{abs(hash((seller['house_id'], buyer['house_id'], now_iso))) % 10000:04d}",
                    "seller_id": seller["house_id"],
                    "buyer_id": buyer["house_id"],
                    "energy_kwh": qty,
                    "price_per_kwh": price,
                    "grid_price_per_kwh": ref_grid_price,
                    "total_inr": total_inr,
                    "savings_inr": savings,
                    "reason": (
                        f"{seller['house_id']} exported {qty:.2f} kWh of surplus rooftop solar to "
                        f"{buyer['house_id']} at \u20b9{price:.2f}/kWh \u2014 \u20b9{savings:.0f} cheaper than the "
                        f"\u20b9{ref_grid_price:.2f}/kWh {'grid tariff' if grid_online else 'outage cost of unserved energy'} during {context_label}."
                    ),
                    "executed_at": now_iso,
                })
                remaining_seller_kwh[seller["house_id"]] -= qty
                need -= qty

    state["trades"] = trades
    record_trades(trades)

    total_kwh = round(sum(t["energy_kwh"] for t in trades), 2)
    total_savings = round(sum(t["savings_inr"] for t in trades), 2)

    fill_ratio = round(min(1.0, total_kwh / demanded_kwh), 3) if demanded_kwh > 0.01 else 1.0
    set_market_memory({"fill_ratio": fill_ratio, "price": price})
    state["market_adaptation"] = adaptation_note
    if adaptation_note:
        log_event(state, f"Trading Agent (memory): {adaptation_note}")

    if trades:
        log_event(
            state,
            f"Trading Agent: Autonomously matched {len(trades)} P2P trade(s) totalling {total_kwh:.1f} kWh "
            f"during {context_label} — community saved \u20b9{total_savings:,.0f} vs. grid import.",
        )
    else:
        log_event(
            state,
            "Trading Agent: Local generation covers local demand this cycle — "
            "no P2P settlement needed, continuing to monitor hyper-local net positions.",
        )

    state["market_narrative"] = _template_market_narrative(len(trades), total_kwh, total_savings, is_peak, is_shortfall)
    return state


async def enrich_market_narrative(state: CommunityState) -> CommunityState:
    """Optional async pass: replace the templated market narrative with a
    real LLM-generated one. Kept separate from trading_agent_fn because the
    LangGraph pipeline is synchronous; routers call this after run_cycle_full
    when they can await it.
    """
    trades = state.get("trades", [])
    if not trades:
        return state

    top_trades = trades[:5]
    trade_lines = "\n".join(
        f"- {t['seller_id']} -> {t['buyer_id']}: {t['energy_kwh']:.2f} kWh @ \u20b9{t['price_per_kwh']:.2f}/kWh "
        f"(grid \u20b9{t['grid_price_per_kwh']:.2f}/kWh, saved \u20b9{t['savings_inr']:.0f})"
        for t in top_trades
    )
    narrative = await _ai.complete(
        system_prompt=(
            "You are the market-commentary voice for PowerWorker's peer-to-peer energy trading "
            "engine. Given a list of executed trades, write ONE punchy sentence (max 40 words) "
            "summarizing the market behavior and community benefit. No preamble, no markdown."
        ),
        user_prompt=f"Trades executed this cycle:\n{trade_lines}",
        temperature=0.6,
        max_tokens=120,
    )
    if narrative:
        state["market_narrative"] = narrative
        state["market_narrative_ai_generated"] = True
    else:
        state["market_narrative_ai_generated"] = False
    return state
