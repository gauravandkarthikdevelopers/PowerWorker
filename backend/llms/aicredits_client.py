"""AI Credits LLM client for PowerWorker.

Wraps the OpenAI-compatible chat-completions API exposed at
https://api.aicredits.in/v1 (model: deepseek-chat by default). This is the
single real reasoning brain for the whole platform:

- Conversational grid advisor (the PowerWorker Agent)
- Tool-augmented household Q&A
- P2P energy-trade negotiation rationale / market commentary
- Grid-failure risk narratives and mitigation guidance

Configuration (see .env.local):
    AI_CREDITS_API_KEY   - bearer token
    AI_CREDITS_MODEL     - e.g. "deepseek-chat"
    AI_CREDITS_BASE_URL  - e.g. "https://api.aicredits.in/v1"

Falls back to deterministic mock replies if the key/SDK is unavailable so
the demo never hard-fails without connectivity.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


class AICreditsClient:
    """OpenAI-compatible client for the aicredits.in inference gateway.

    Features:
    - Async native (AsyncOpenAI, no event-loop blocking).
    - Tool calling for live energy data (bills, solar, EV, battery).
    - Structured JSON output for frontend integration.
    - Plain-text ``complete()`` helper for short narrative generation
      (trade rationale, grid-risk commentary) with graceful fallback.
    """

    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.model = model or os.environ.get("AI_CREDITS_MODEL", "deepseek-chat")
        self.base_url = base_url or os.environ.get("AI_CREDITS_BASE_URL", "https://api.aicredits.in/v1")
        api_key_env = os.environ.get("AI_CREDITS_API_KEY", "")
        if api_key_env.startswith("your_"):
            api_key_env = ""
        self.api_key = api_key or api_key_env
        self._mock_mode = not bool(self.api_key) or AsyncOpenAI is None
        self._client = (
            AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
            if not self._mock_mode
            else None
        )
        if self._mock_mode:
            logger.warning("AICreditsClient running in MOCK MODE (no AI_CREDITS_API_KEY set)")
        else:
            logger.info("AICreditsClient initialized: model=%s base_url=%s", self.model, self.base_url)

    @property
    def is_live(self) -> bool:
        return not self._mock_mode

    # ------------------------------------------------------------------
    # Full chat (tool-calling capable) — used by the PowerWorker Agent advisor.
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Run a chat completion, executing any requested tool calls.

        Returns a dict with ``reply``, ``model``, ``tools_used``, and
        optionally ``structured`` (parsed JSON reply).
        """
        if self._mock_mode:
            return self._mock_reply(messages, tools=tools)

        try:
            chat_messages: list[dict[str, str]] = []
            if system_prompt:
                chat_messages.append({"role": "system", "content": system_prompt})
            chat_messages.extend(messages)

            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": chat_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = await self._client.chat.completions.create(**kwargs)
            choice = response.choices[0]
            message = choice.message

            tool_calls_made: list[str] = []
            if message.tool_calls:
                chat_messages.append({
                    "role": "assistant",
                    "content": message.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                        }
                        for tc in message.tool_calls
                    ],
                })
                for tc in message.tool_calls:
                    tool_name = tc.function.name
                    tool_calls_made.append(tool_name)
                    tool_result = await self._execute_tool(
                        tool_name, json.loads(tc.function.arguments or "{}")
                    )
                    chat_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(tool_result),
                    })

                follow_up = await self._client.chat.completions.create(
                    model=self.model,
                    messages=chat_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                reply = follow_up.choices[0].message.content or ""
            else:
                reply = message.content or ""

            result: dict[str, Any] = {
                "reply": reply,
                "model": self.model,
                "tools_used": tool_calls_made,
                "finish_reason": choice.finish_reason,
            }
            if reply.strip().startswith("{"):
                try:
                    result["structured"] = json.loads(reply)
                except json.JSONDecodeError:
                    pass
            return result

        except Exception as e:  # noqa: BLE001 - never crash the advisor on a provider hiccup
            logger.error("AI Credits chat error: %s", e, exc_info=True)
            fallback = self._mock_reply(messages, tools=tools)
            fallback["model"] = "fallback"
            fallback["error"] = str(e)
            return fallback

    # ------------------------------------------------------------------
    # Lightweight narrative completion — used by trading + prediction agents.
    # ------------------------------------------------------------------

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        max_tokens: int = 400,
    ) -> str | None:
        """Return a plain-text completion, or None on any failure.

        Callers MUST provide a deterministic template fallback — this
        method never raises and never returns mock/fake content, so a
        None result must be handled explicitly.
        """
        if self._mock_mode:
            return None
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return (response.choices[0].message.content or "").strip() or None
        except Exception as e:  # noqa: BLE001
            logger.warning("AI Credits completion failed, using template fallback: %s", e)
            return None

    # ------------------------------------------------------------------
    # Tool definitions and execution
    # ------------------------------------------------------------------

    @staticmethod
    def get_energy_tools() -> list[dict[str, Any]]:
        """Return tool definitions for energy-domain queries."""
        household_id_param = {
            "type": "object",
            "properties": {
                "household_id": {
                    "type": "string",
                    "description": "Household identifier (e.g. H-17 or integer).",
                    "default": "1",
                }
            },
        }
        return [
            {"type": "function", "function": {
                "name": "get_current_bill",
                "description": "Get current electricity bill, last month bill, and savings percentage for a household.",
                "parameters": household_id_param,
            }},
            {"type": "function", "function": {
                "name": "get_solar_generation",
                "description": "Get today's solar generation, capacity, and efficiency for a household.",
                "parameters": household_id_param,
            }},
            {"type": "function", "function": {
                "name": "get_ev_status",
                "description": "Get EV battery level, charging status, and next scheduled charge time.",
                "parameters": household_id_param,
            }},
            {"type": "function", "function": {
                "name": "get_battery_status",
                "description": "Get home battery state of charge, capacity, and health.",
                "parameters": household_id_param,
            }},
            {"type": "function", "function": {
                "name": "get_p2p_trade_activity",
                "description": "Get recent peer-to-peer energy trades a household participated in as buyer or seller.",
                "parameters": household_id_param,
            }},
        ]

    async def _execute_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        raw_id = arguments.get("household_id", 1)
        if isinstance(raw_id, str):
            import re
            digits = re.findall(r"\d+", raw_id)
            household_id = int(digits[0]) if digits else 1
        else:
            household_id = int(raw_id)

        if tool_name == "get_current_bill":
            return {"household_id": household_id, "current_month_inr": 2850, "last_month_inr": 3200, "savings_pct": 10.9, "currency": "INR"}
        if tool_name == "get_solar_generation":
            return {"household_id": household_id, "today_kwh": 24.5, "capacity_kw": 6.5, "efficiency_pct": 92, "peak_generation_kw": 5.8}
        if tool_name == "get_ev_status":
            return {"household_id": household_id, "battery_pct": 45, "charging_status": "idle", "next_charge_time": "22:00", "range_km": 180}
        if tool_name == "get_battery_status":
            return {"household_id": household_id, "soc_pct": 65, "capacity_kwh": 13.5, "health_pct": 92, "cycles": 420}
        if tool_name == "get_p2p_trade_activity":
            from agents.memory import get_trade_log
            trades = [
                t for t in get_trade_log(limit=200)
                if str(household_id) in t.get("seller_id", "") or str(household_id) in t.get("buyer_id", "")
            ][:5]
            return {"household_id": household_id, "recent_trades": trades, "count": len(trades)}

        raise ValueError(f"Unknown tool: {tool_name}")

    # ------------------------------------------------------------------
    # Mock fallback (no API key configured)
    # ------------------------------------------------------------------

    def _mock_reply(
        self,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "Hello",
        )
        lowered = last_user.lower()

        if any(t in lowered for t in ["bill", "cost", "price", "₹", "inr", "बिल", "బిల్లు"]):
            reply = json.dumps({
                "action": "show_bill_analysis",
                "message": "Your current bill is ₹2,850, down 10.9% from last month. Keep shifting flexible loads to off-peak windows.",
                "savings_pct": 10.9,
                "recommendations": [
                    "Shift EV charging to after 10 PM",
                    "Sell surplus solar to neighbors via P2P trading during peak hours",
                    "Raise HVAC setpoint by 2°C during 6-9 PM",
                ],
            })
        elif any(t in lowered for t in ["trade", "trading", "p2p", "peer", "sell", "बेचना"]):
            reply = json.dumps({
                "action": "p2p_trading_info",
                "message": "P2P trading lets surplus-solar houses sell directly to deficit houses at a price between the solar cost and the grid tariff — both sides save versus importing from the grid.",
                "typical_discount_pct": 25,
            })
        elif any(t in lowered for t in ["ev", "charging", "vehicle", "चार्ज", "చార్జింగ్"]):
            reply = json.dumps({
                "action": "optimize_ev_charging",
                "message": "Your EV battery is at 45%. Best charging window: 10 PM - 6 AM (off-peak) or 11 AM - 3 PM (solar surplus).",
                "recommended_start": "22:00",
                "recommended_end": "06:00",
                "estimated_cost_saving_inr": 180,
            })
        elif any(t in lowered for t in ["solar", "panel", "generation", "सोलर", "సౌర"]):
            reply = json.dumps({
                "action": "solar_optimization",
                "message": "Solar generating 24.5 kWh today at 92% efficiency. Use surplus for EV/battery charging or sell it peer-to-peer.",
                "today_kwh": 24.5,
                "efficiency_pct": 92,
            })
        elif any(t in lowered for t in ["grid", "outage", "failure", "risk", "blackout"]):
            reply = json.dumps({
                "action": "grid_risk_info",
                "message": "The prediction agent is continuously scoring grid failure risk from supply margin, carbon intensity, and peak-hour load. Check the Grid Risk panel for the live score.",
            })
        else:
            reply = json.dumps({
                "action": "general_assist",
                "message": "I can help optimize your energy usage, reduce bills, schedule EV charging, and explain P2P trades. What would you like to know?",
                "available_tools": [t["function"]["name"] for t in (tools or [])],
            })

        return {
            "reply": reply,
            "model": "mock-aicredits",
            "tools_used": [t["function"]["name"] for t in tools] if tools else [],
            "structured": json.loads(reply),
        }
