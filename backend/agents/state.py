"""
state.py
Shared state schema for the PowerWorker multi-agent micro-grid system.
All agents read/write a single CommunityState object that flows
through the LangGraph sequentially.

DO NOT MODIFY EXISTING FIELD NAMES — frontend and backend depend on these
shapes. New fields must be additive.
"""

from __future__ import annotations

from typing import TypedDict, List


class SolarState(TypedDict):
    current_generation: float       # kWh right now
    forecast_24h: List[float]        # hourly forecast (next 24h)
    surplus_now: float               # generation - current total demand
    low_gen_windows: List[str]       # ISO timestamps / hour labels of low generation


class BatteryState(TypedDict):
    soc: float                       # state-of-charge 0-100%
    capacity: float                  # total kWh capacity
    charge_rate: float               # max kW charge/discharge
    available_discharge: float       # kWh available for discharge right now
    health_pct: float                # 0-100% battery health


class HouseState(TypedDict):
    house_id: str
    current_demand: float            # kWh
    forecast_demand: float           # next hour kWh
    flexibility: float               # 0 (inflexible) - 1 (fully deferrable)
    priority: str                    # "critical" | "normal" | "flexible"


class EVState(TypedDict):
    ev_id: str
    charge_needed: float             # kWh remaining to reach target SoC
    departure_time: str              # ISO timestamp
    currently_charging: bool
    v2g_eligible: bool
    flex_window_hrs: float           # hours of flexibility before departure


class GridState(TypedDict):
    price_per_kwh: float
    availability: bool
    carbon_intensity: float          # gCO2/kWh
    max_import_kw: float
    peak_hours: List[str]


class CommunityState(TypedDict):
    solar: SolarState
    battery: BatteryState
    households: List[HouseState]
    evs: List[EVState]
    grid: GridState
    timestamp: str
    decisions: dict                  # populated by optimizer at end
    logs: List[str]                  # human-readable agent negotiation logs
    # --- Additive channels (populated by trading/prediction agents) ---
    trades: List[TradeRecord]
    grid_prediction: GridPrediction
    house_net_positions: List[HouseNetPosition]
    market_narrative: str
    market_narrative_ai_generated: bool
    market_adaptation: str           # cross-cycle memory: how price adapted vs last cycle


class TradeRecord(TypedDict):
    trade_id: str
    seller_id: str
    buyer_id: str
    energy_kwh: float
    price_per_kwh: float
    grid_price_per_kwh: float
    total_inr: float
    savings_inr: float
    reason: str
    executed_at: str


class GridPrediction(TypedDict):
    risk_score: float                # 0-100
    risk_level: str                  # "low" | "moderate" | "high" | "critical"
    horizon_hours: int
    narrative: str
    recommended_actions: List[str]
    factors: List[str]               # short machine-readable trigger tags
    ai_generated: bool               # True if narrative came from the LLM, False if templated
    generated_at: str


class HouseNetPosition(TypedDict):
    house_id: str
    net_kwh: float                   # positive = surplus (seller), negative = deficit (buyer)
    role: str                        # "seller" | "buyer" | "balanced"
