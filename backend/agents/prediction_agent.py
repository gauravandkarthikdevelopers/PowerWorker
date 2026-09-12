"""
prediction_agent.py
PredictionAgent: the grid-failure early-warning brain of the PowerWorker
micro-grid.

Responsibilities:
- Score grid-failure risk (0-100) each cycle from physical signals:
  supply margin, grid availability, carbon intensity, battery reserve,
  peak-hour load, and the resolved community shortfall.
- Derive a risk level, a forecast horizon, and machine-readable trigger
  tags for the UI gauge/timeline.
- Ask the AI reasoning layer for a human-readable narrative + concrete
  mitigation actions. Falls back to deterministic templates if the LLM is
  unavailable so the pipeline never hard-fails offline.

Runs last in the pipeline (after the Trading node) so it can factor P2P
settlement into the resilience picture.
"""

from __future__ import annotations

from datetime import datetime, timezone

from agents.state import CommunityState
from agents.logger import log_event
from agents.memory import record_risk
from llms.aicredits_client import AICreditsClient

HIGH_CARBON_INTENSITY = 500.0
LOW_BATTERY_SOC = 20.0

_ai = AICreditsClient()


def _current_hour_label(state: CommunityState) -> str:
    timestamp = state.get("timestamp", "")
    try:
        hour_part = timestamp.split("T")[1][:2] if "T" in timestamp else timestamp[11:13]
        return f"{hour_part}:00"
    except (IndexError, ValueError):
        return ""


def _risk_level(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "moderate"
    return "low"


def _horizon_hours(score: float) -> int:
    if score >= 75:
        return 1
    if score >= 50:
        return 3
    if score >= 25:
        return 6
    return 12


def _score_grid_risk(state: CommunityState) -> tuple[float, list[str]]:
    solar = state["solar"]
    battery = state["battery"]
    grid = state["grid"]
    households = state["households"]
    decisions = state.get("decisions", {})

    total_demand = sum(h["current_demand"] for h in households)
    # Local (grid-independent) supply: rooftop solar + dischargeable battery.
    total_local = solar["current_generation"] + battery.get("available_discharge", 0.0)

    score = 0.0
    factors: list[str] = []

    # Fraction of demand that CANNOT be met locally and must lean on the grid —
    # the grid is the single point of failure this platform is designed to hedge.
    grid_dependency = max(0.0, (total_demand - total_local) / total_demand) if total_demand > 0 else 0.0

    if not grid["availability"]:
        # Island mode: risk is dominated by whether local supply covers demand.
        score += 40
        factors.append("grid_offline")
        if grid_dependency > 0:
            score += min(45.0, grid_dependency * 90)
            factors.append("island_deficit")
    else:
        if grid_dependency > 0.5:
            score += min(45.0, grid_dependency * 55)
            factors.append("heavy_grid_dependency")
        elif grid_dependency > 0.25:
            score += grid_dependency * 40
            factors.append("elevated_grid_dependency")
        elif grid_dependency > 0.0:
            score += 8
            factors.append("thin_supply_margin")

    shortfall = float(decisions.get("grid_import_kw", 0.0))
    if total_demand > 0 and shortfall > 0.15 * total_demand:
        score += 15
        factors.append("large_shortfall")

    if grid.get("carbon_intensity", 0.0) >= HIGH_CARBON_INTENSITY:
        score += 8
        factors.append("high_carbon_intensity")

    if battery.get("soc", 100.0) < LOW_BATTERY_SOC:
        score += 10
        factors.append("low_battery_reserve")

    current_hour = _current_hour_label(state)
    if current_hour and current_hour in grid.get("peak_hours", []):
        score += 10
        factors.append("peak_hour")

    return max(0.0, min(100.0, round(score, 1))), factors


_FACTOR_ACTIONS = {
    "grid_offline": "Sustain island mode on battery + solar; shed non-critical loads immediately.",
    "island_deficit": "Local supply cannot cover demand off-grid — shed non-critical loads and reserve battery for critical homes.",
    "heavy_grid_dependency": "Community is heavily grid-dependent — discharge battery, pause deferrable EV charging, and maximise P2P sharing.",
    "elevated_grid_dependency": "Grid reliance is rising — pre-position battery discharge and route deficits through P2P before grid import.",
    "thin_supply_margin": "Pre-charge battery from any solar surplus and stage flexible loads for later.",
    "large_shortfall": "Prioritise P2P imports from surplus neighbors before drawing peak-priced grid power.",
    "high_carbon_intensity": "Shift discretionary loads off the grid to avoid dirty, expensive peak energy.",
    "low_battery_reserve": "Hold battery above the 15% reserve floor; recharge during the next solar window.",
    "peak_hour": "Activate demand response — defer AC/water-heater loads out of the peak window.",
}


def _template_narrative(score: float, level: str, horizon: int, factors: list[str]) -> str:
    if not factors:
        return (
            f"Grid resilience is healthy (risk {score:.0f}/100). Supply comfortably exceeds demand "
            f"and reserves are intact; no failure expected within {horizon}h."
        )
    trigger_text = ", ".join(f.replace("_", " ") for f in factors)
    return (
        f"Grid-failure risk is {level.upper()} at {score:.0f}/100 within the next {horizon}h, "
        f"driven by: {trigger_text}. The agent network is rebalancing storage, EV charging, and "
        f"P2P trading to protect critical loads."
    )


def prediction_agent_fn(state: CommunityState) -> CommunityState:
    score, factors = _score_grid_risk(state)
    level = _risk_level(score)
    horizon = _horizon_hours(score)
    now_iso = datetime.now(timezone.utc).isoformat()

    recommended = [_FACTOR_ACTIONS[f] for f in factors if f in _FACTOR_ACTIONS]
    if not recommended:
        recommended = ["Maintain current dispatch; continue monitoring hyper-local generation."]

    prediction = {
        "risk_score": score,
        "risk_level": level,
        "horizon_hours": horizon,
        "narrative": _template_narrative(score, level, horizon, factors),
        "recommended_actions": recommended[:4],
        "factors": factors,
        "ai_generated": False,
        "generated_at": now_iso,
    }
    state["grid_prediction"] = prediction
    record_risk({"timestamp": now_iso, "risk_score": score, "risk_level": level})

    log_event(
        state,
        f"Prediction Agent: Grid-failure risk {level.upper()} ({score:.0f}/100) over next {horizon}h"
        + (f" — triggers: {', '.join(factors)}." if factors else " — grid stable."),
    )
    return state


async def enrich_prediction_narrative(state: CommunityState) -> CommunityState:
    """Optional async pass: upgrade the templated narrative + actions with a
    real LLM analysis. Routers call this after run_cycle_full."""
    prediction = state.get("grid_prediction")
    if not prediction:
        return state

    system = (
        "You are the grid-resilience analyst for PowerWorker, a decentralized micro-grid. "
        "Given a computed risk score and its trigger factors, return a JSON object with exactly "
        "two keys: \"narrative\" (2-3 sentence plain-language risk explanation, no markdown) and "
        "\"actions\" (array of 2-4 short imperative mitigation steps). Be specific and technical."
    )
    user = (
        f"Risk score: {prediction['risk_score']}/100 ({prediction['risk_level']}), "
        f"horizon {prediction['horizon_hours']}h.\n"
        f"Trigger factors: {', '.join(prediction['factors']) or 'none'}.\n"
        f"Community context: solar {state['solar']['current_generation']:.0f} kWh, "
        f"battery SoC {state['battery']['soc']:.0f}%, grid "
        f"{'ONLINE' if state['grid']['availability'] else 'OFFLINE'}, "
        f"grid import {state.get('decisions', {}).get('grid_import_kw', 0):.0f} kWh."
    )
    raw = await _ai.complete(system_prompt=system, user_prompt=user, temperature=0.4, max_tokens=320)
    if not raw:
        return state

    import json
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 2)[1].lstrip("json").strip() if "```" in cleaned else cleaned
        parsed = json.loads(cleaned)
        narrative = parsed.get("narrative")
        actions = parsed.get("actions")
        if isinstance(narrative, str) and narrative.strip():
            prediction["narrative"] = narrative.strip()
            prediction["ai_generated"] = True
        if isinstance(actions, list) and actions:
            prediction["recommended_actions"] = [str(a).strip() for a in actions][:4]
    except (json.JSONDecodeError, ValueError, IndexError):
        # Keep the deterministic template; don't fail the request.
        pass

    state["grid_prediction"] = prediction
    return state
