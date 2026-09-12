"""
memory.py
Process-local in-memory ledger for the PowerWorker micro-grid demo.

Accumulates P2P trades and grid-risk history across /simulate and
/ws/negotiate calls so the frontend can render a running ledger and a
risk-over-time sparkline without a database. Intentionally volatile —
resets when the backend process restarts (fine for a hackathon demo).
"""

from __future__ import annotations

import threading
from typing import Any

_lock = threading.Lock()

_TRADE_LOG: list[dict[str, Any]] = []
_RISK_HISTORY: list[dict[str, Any]] = []
_LAST_RESULT: dict[str, Any] = {}
_MARKET_MEMORY: dict[str, Any] = {}

MAX_TRADE_LOG = 500
MAX_RISK_HISTORY = 200


def record_trades(trades: list[dict[str, Any]]) -> None:
    if not trades:
        return
    with _lock:
        _TRADE_LOG.extend(trades)
        del _TRADE_LOG[: max(0, len(_TRADE_LOG) - MAX_TRADE_LOG)]


def record_risk(point: dict[str, Any]) -> None:
    with _lock:
        _RISK_HISTORY.append(point)
        del _RISK_HISTORY[: max(0, len(_RISK_HISTORY) - MAX_RISK_HISTORY)]


def set_last_result(result: dict[str, Any]) -> None:
    with _lock:
        _LAST_RESULT.clear()
        _LAST_RESULT.update(result)


def get_trade_log(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        return list(reversed(_TRADE_LOG))[:limit]


def get_risk_history(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        return _RISK_HISTORY[-limit:]


def get_last_result() -> dict[str, Any]:
    with _lock:
        return dict(_LAST_RESULT)


def set_market_memory(memory: dict[str, Any]) -> None:
    """Persist the Trading agent's cross-cycle state (last clearing price,
    fill ratio) so it can adapt pricing on the next cycle."""
    with _lock:
        _MARKET_MEMORY.clear()
        _MARKET_MEMORY.update(memory)


def get_market_memory() -> dict[str, Any]:
    with _lock:
        return dict(_MARKET_MEMORY)


def get_trading_summary() -> dict[str, Any]:
    with _lock:
        trades = list(_TRADE_LOG)
    total_energy = sum(t["energy_kwh"] for t in trades)
    total_savings = sum(t["savings_inr"] for t in trades)
    return {
        "total_trades": len(trades),
        "total_energy_kwh": round(total_energy, 2),
        "total_savings_inr": round(total_savings, 0),
        "grid_import_avoided_kwh": round(total_energy, 2),
    }


def reset() -> None:
    """Clear all accumulated demo state (used by tests)."""
    with _lock:
        _TRADE_LOG.clear()
        _RISK_HISTORY.clear()
        _LAST_RESULT.clear()
        _MARKET_MEMORY.clear()
