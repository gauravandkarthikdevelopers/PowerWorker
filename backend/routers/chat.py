"""
chat.py — the PowerWorker Agent: PowerWorker's AI grid advisor, powered by deepseek-chat via
aicredits.in. POST /chat: single-turn chat with live community + trading
context. The model replies natively in the user's language — no separate
translation hop required.
"""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from llms.aicredits_client import AICreditsClient

router = APIRouter(prefix="/chat", tags=["chat"])

_ai = AICreditsClient()

SYSTEM_PROMPT_TEMPLATE = """You are the PowerWorker Agent, the autonomous AI intelligence at the core of PowerWorker — a decentralized micro-grid platform where a network of specialized agents monitors hyper-local power generation, predicts grid failures, and autonomously executes peer-to-peer (P2P) energy trading across a 50-home residential community in India.

Current community status:
- Solar Generation: {solar_generation} kWh
- Battery Level: {battery_level}%
- Grid Import: {grid_import} kWh
- Active EVs Charging: {ev_count}/10
- Renewable Usage: {renewable_usage}%
- Active Scenario: {active_scenario}
- Grid Risk Score: {risk_score}/100 ({risk_level})
- P2P Trades This Cycle: {trade_count} (₹{trade_savings} saved vs. grid price)
{house_section}
You help residents:
- Understand their energy usage, solar generation, and battery/EV status
- Understand why the autonomous agent network made a decision (solar, battery, EV, grid, optimizer, trading, or prediction agent)
- Explain P2P energy trades: who sold/bought, at what price, and why it's cheaper than the grid
- Interpret grid-failure risk scores and recommended mitigations
- Reduce electricity bills (use ₹ for rupees, kWh for energy)
- Plan for events like heatwaves, cloud cover, grid outages, or EV charging surges

Rules:
- Keep responses concise, actionable, and specific (3-5 sentences unless asked for detail)
- ALWAYS reply in the same language the user wrote in — you are fluent in English, Hindi, Telugu, and Urdu
- Use ₹ for currency, kWh for energy units
- If asked about savings, give specific rupee estimates when possible
- Never claim to control real hardware — you are a decision-support and explanation layer over the simulated agent network"""

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class HouseContext(BaseModel):
    house_id: str = ""
    consumption: float = 0.0
    solar_contribution_pct: float = 0.0
    energy_source: str = "mixed"
    solar_supply_kwh: float = 0.0
    battery_supply_kwh: float = 0.0
    grid_supply_kwh: float = 0.0

class CommunityContext(BaseModel):
    solarGeneration: float = 280
    batteryLevel:    float = 68
    gridImport:      float = 42
    evCount:         int   = 7
    renewableUsage:  float = 85
    activeScenario:  str   = "normal"
    riskScore:       float = 0
    riskLevel:       str   = "low"
    tradeCount:      int   = 0
    tradeSavingsInr: float = 0
    selectedHouse:   Optional[HouseContext] = None

class ChatRequest(BaseModel):
    message:  str
    language: str = "english"
    history:  list[ChatMessage] = []
    context:  Optional[CommunityContext] = None

@router.post("")
async def chat(req: ChatRequest):
    ctx = req.context or CommunityContext()

    house_section = ""
    if ctx.selectedHouse and ctx.selectedHouse.house_id:
        h = ctx.selectedHouse
        house_section = f"""
Currently selected house: {h.house_id}
- Consumption: {h.consumption:.1f} kWh
- Energy source type: {h.energy_source}
- Solar supplying: {h.solar_supply_kwh:.2f} kWh ({h.solar_contribution_pct:.0f}% of need)
- Battery supplying: {h.battery_supply_kwh:.2f} kWh
- Grid supplying: {h.grid_supply_kwh:.2f} kWh
"""
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        solar_generation = ctx.solarGeneration,
        battery_level    = ctx.batteryLevel,
        grid_import      = ctx.gridImport,
        ev_count         = ctx.evCount,
        renewable_usage  = ctx.renewableUsage,
        active_scenario  = ctx.activeScenario,
        risk_score       = ctx.riskScore,
        risk_level       = ctx.riskLevel,
        trade_count      = ctx.tradeCount,
        trade_savings    = ctx.tradeSavingsInr,
        house_section    = house_section,
    )

    language_hint = f"\n\n(Respond in {req.language}.)" if req.language.lower() != "english" else ""
    messages = [{"role": m.role, "content": m.content} for m in req.history] + [
        {"role": "user", "content": req.message + language_hint}
    ]

    result = await _ai.chat(
        messages      = messages,
        system_prompt = system_prompt,
        tools         = AICreditsClient.get_energy_tools(),
        temperature   = 0.7,
        max_tokens    = 512,
    )

    return {
        "reply":      result.get("reply", ""),
        "structured": result.get("structured"),
        "tools_used": result.get("tools_used", []),
        "model":      result.get("model", ""),
    }
