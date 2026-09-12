"""
grid.py — Live micro-grid telemetry REST endpoints.

GET /grid/status        : last computed community snapshot (metrics + prediction + trading summary)
GET /grid/trade-log     : recent P2P trades across the session (most recent first)
GET /grid/risk-history  : grid-failure risk score over time (for the sparkline)
GET /grid/summary       : cumulative P2P trading summary
"""
from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from agents import memory

router = APIRouter(prefix="/grid", tags=["grid"])


@router.get("/status")
async def grid_status():
    result = memory.get_last_result()
    if not result:
        raise HTTPException(status_code=404, detail="No simulation has been run yet.")
    return result


@router.get("/trade-log")
async def trade_log(limit: int = Query(default=50, ge=1, le=500)):
    return {"trades": memory.get_trade_log(limit=limit), "summary": memory.get_trading_summary()}


@router.get("/risk-history")
async def risk_history(limit: int = Query(default=50, ge=1, le=200)):
    return {"history": memory.get_risk_history(limit=limit)}


@router.get("/summary")
async def summary():
    return memory.get_trading_summary()
