"""
simulate.py — Agent pipeline endpoints.
POST /simulate     : run a scenario, return decisions + metrics + P2P trades + grid prediction.
WS   /ws/negotiate : stream the agent network's reasoning in real time.
"""
from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from agents.run import (
    run_cycle_full,
    generate_mock_community_state,
    inject_scenario,
    enrich_market_narrative,
    enrich_prediction_narrative,
)
from agents.graph import app as langgraph_app
from agents import memory

router = APIRouter()

# Scenario name mapping: frontend camelCase -> backend snake_case
SCENARIO_MAP: dict[str, str | None] = {
    "normal":      None,
    "cloudCover":  "cloud_cover",
    "heatwave":    "heatwave",
    "gridFailure": "grid_failure",
    "evSurge":     "ev_surge",
}

AGENT_DISPLAY_NAMES: dict[str, str] = {
    "solar_agent":      "Solar",
    "battery_agent":    "Battery",
    "house_agents":     "House",
    "ev_agent":         "EV",
    "grid_agent":       "Grid",
    "optimizer":        "Optimizer",
    "trading_agent":    "Trading",
    "prediction_agent": "Prediction",
}


class SimulateRequest(BaseModel):
    scenario: str = "normal"
    seed: int = 42
    solar_pct: float = 100.0
    battery_pct: float = 100.0
    grid_pct: float = 100.0


def _build_state(
    scenario_frontend: str,
    seed: int,
    solar_pct: float = 100.0,
    battery_pct: float = 100.0,
    grid_pct: float = 100.0,
) -> dict:
    """Generate mock state, inject scenario, then scale by slider percentages."""
    state = generate_mock_community_state(seed=seed)
    backend_scenario = SCENARIO_MAP.get(scenario_frontend)
    if backend_scenario:
        inject_scenario(state, backend_scenario)
    state["solar"]["current_generation"] = round(
        state["solar"]["current_generation"] * (solar_pct / 100.0), 2
    )
    state["solar"]["forecast_24h"] = [
        round(v * (solar_pct / 100.0), 2) for v in state["solar"]["forecast_24h"]
    ]
    state["battery"]["soc"] = min(100.0, round(state["battery"]["soc"] * (battery_pct / 100.0), 1))
    state["grid"]["max_import_kw"] = round(state["grid"]["max_import_kw"] * (grid_pct / 100.0), 1)
    return state


def _frontend_house_id(backend_house_id: str) -> str:
    """Map backend 'H00'..'H49' to the frontend 'house-1'..'house-50' scheme."""
    digits = "".join(c for c in backend_house_id if c.isdigit())
    idx = int(digits) if digits else 0
    return f"house-{idx + 1}"


def _map_to_frontend_metrics(state: dict, decisions: dict) -> dict:
    solar   = state.get("solar",   {})
    battery = state.get("battery", {})
    evs     = state.get("evs",     [])
    paused_ids = set(decisions.get("ev_charging_paused", []))
    active_evs = sum(
        1 for ev in evs
        if ev.get("currently_charging") and ev.get("ev_id") not in paused_ids
    )
    return {
        "solarGeneration": round(solar.get("current_generation", 0), 1),
        "batteryLevel":    round(battery.get("soc", 0), 1),
        "gridImport":      round(decisions.get("grid_import_kw", 0), 1),
        "evCount":         active_evs,
        "moneySaved":      round(decisions.get("estimated_savings_inr", 0), 0),
        "carbonReduced":   round(decisions.get("carbon_saved_kg", 0), 1),
        "renewableUsage":  round(decisions.get("renewable_utilization_pct", 0), 1),
    }


def _map_trades(state: dict) -> list[dict]:
    out = []
    for t in state.get("trades", []):
        out.append({
            "id":               t["trade_id"],
            "sellerId":         _frontend_house_id(t["seller_id"]),
            "buyerId":          _frontend_house_id(t["buyer_id"]),
            "sellerNode":       t["seller_id"],
            "buyerNode":        t["buyer_id"],
            "energyKwh":        round(t["energy_kwh"], 2),
            "pricePerKwh":      round(t["price_per_kwh"], 2),
            "gridPricePerKwh":  round(t["grid_price_per_kwh"], 2),
            "totalInr":         round(t["total_inr"], 2),
            "savingsInr":       round(t["savings_inr"], 2),
            "reason":           t["reason"],
            "executedAt":       t["executed_at"],
        })
    return out


def _map_prediction(state: dict) -> Optional[dict]:
    p = state.get("grid_prediction")
    if not p:
        return None
    return {
        "riskScore":          p["risk_score"],
        "riskLevel":          p["risk_level"],
        "horizonHours":       p["horizon_hours"],
        "narrative":          p["narrative"],
        "recommendedActions": p["recommended_actions"],
        "factors":            p.get("factors", []),
        "aiGenerated":        p.get("ai_generated", False),
        "generatedAt":        p["generated_at"],
    }


def _map_house_net_positions(state: dict) -> list[dict]:
    return [
        {
            "houseId": _frontend_house_id(n["house_id"]),
            "node":    n["house_id"],
            "netKwh":  round(n["net_kwh"], 2),
            "role":    n["role"],
        }
        for n in state.get("house_net_positions", [])
    ]


def _map_risk_history() -> list[dict]:
    return [
        {"timestamp": h["timestamp"], "riskScore": h["risk_score"], "riskLevel": h.get("risk_level", "low")}
        for h in memory.get_risk_history(limit=40)
    ]


def _build_payload(state: dict, scenario: str) -> dict:
    decisions = state.get("decisions", {})
    trades = _map_trades(state)
    payload = {
        "scenario":          scenario,
        "decisions":         decisions,
        "community_metrics": _map_to_frontend_metrics(state, decisions),
        "logs":              state.get("logs", []),
        "trades":            trades,
        "gridPrediction":    _map_prediction(state),
        "houseNetPositions": _map_house_net_positions(state),
        "tradingSummary": {
            **{
                "totalTrades":          memory.get_trading_summary()["total_trades"],
                "totalEnergyKwh":       memory.get_trading_summary()["total_energy_kwh"],
                "totalSavingsInr":      memory.get_trading_summary()["total_savings_inr"],
                "gridImportAvoidedKwh": memory.get_trading_summary()["grid_import_avoided_kwh"],
            }
        },
        "cycleTrades": {
            "count":       len(trades),
            "energyKwh":   round(sum(t["energyKwh"] for t in trades), 2),
            "savingsInr":  round(sum(t["savingsInr"] for t in trades), 2),
        },
        "marketNarrative":            state.get("market_narrative", ""),
        "marketNarrativeAiGenerated": state.get("market_narrative_ai_generated", False),
        "riskHistory":                _map_risk_history(),
    }
    memory.set_last_result(payload)
    return payload


@router.post("/simulate")
async def simulate(req: SimulateRequest):
    """Run the full agent pipeline for a scenario, with async LLM enrichment."""
    loop = asyncio.get_event_loop()
    state = _build_state(req.scenario, req.seed, req.solar_pct, req.battery_pct, req.grid_pct)
    result = await loop.run_in_executor(None, run_cycle_full, state)
    # LLM reasoning passes (graceful no-op if AI unavailable).
    await enrich_market_narrative(result)
    await enrich_prediction_narrative(result)
    return _build_payload(result, req.scenario)


@router.websocket("/ws/negotiate")
async def negotiate_websocket(websocket: WebSocket):
    """Stream each agent's reasoning in real time, then the final decisions."""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        scenario_frontend = data.get("scenario", "normal")
        solar_pct = float(data.get("solar_pct", 100.0))
        battery_pct = float(data.get("battery_pct", 100.0))
        grid_pct = float(data.get("grid_pct", 100.0))
        state = _build_state(scenario_frontend, seed=42, solar_pct=solar_pct,
                             battery_pct=battery_pct, grid_pct=grid_pct)

        def run_stream():
            log_events: list[tuple[str, str]] = []  # (node_name, log_line)
            final_state: dict = {}
            prev_count = 0
            for event in langgraph_app.stream(state):
                node_name = list(event.keys())[0]
                node_state = list(event.values())[0]
                final_state = node_state
                logs = node_state.get("logs", [])
                for line in logs[prev_count:]:
                    log_events.append((node_name, line))
                prev_count = len(logs)
            return log_events, final_state

        loop = asyncio.get_event_loop()
        log_events, final_state = await loop.run_in_executor(None, run_stream)

        for node_name, log_line in log_events:
            agent_display = AGENT_DISPLAY_NAMES.get(node_name, "System")
            await websocket.send_json({
                "type":      "log",
                "agent":     agent_display,
                "message":   log_line,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
            })
            await asyncio.sleep(0.3)

        # LLM enrichment after streaming the deterministic reasoning.
        await enrich_market_narrative(final_state)
        await enrich_prediction_narrative(final_state)
        payload = _build_payload(final_state, scenario_frontend)

        await websocket.send_json({
            "type":              "decisions",
            "decisions":         payload["decisions"],
            "community_metrics": payload["community_metrics"],
            "trades":            payload["trades"],
            "gridPrediction":    payload["gridPrediction"],
            "houseNetPositions": payload["houseNetPositions"],
            "tradingSummary":    payload["tradingSummary"],
            "cycleTrades":       payload["cycleTrades"],
            "marketNarrative":   payload["marketNarrative"],
            "riskHistory":       payload["riskHistory"],
        })
        await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
