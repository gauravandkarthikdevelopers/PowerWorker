"""
PowerWorker FastAPI backend.
Autonomous decentralized micro-grid intelligence: agent networks that
monitor hyper-local generation, predict grid failures, and autonomously
execute peer-to-peer energy trading.

Entry point: uvicorn main:app --reload --port 8000
(run from backend/ directory)
"""
from __future__ import annotations
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env.local (preferred) then .env, from this dir and the project root.
_here = os.path.dirname(__file__)
for _candidate in (
    os.path.join(_here, "..", ".env.local"),
    os.path.join(_here, ".env.local"),
    os.path.join(_here, "..", ".env"),
    os.path.join(_here, ".env"),
):
    if os.path.exists(_candidate):
        load_dotenv(_candidate, override=False)
load_dotenv(override=False)

from routers.simulate import router as simulate_router
from routers.chat import router as chat_router
from routers.grid import router as grid_router

app = FastAPI(
    title="PowerWorker API",
    description="Autonomous decentralized micro-grid intelligence — P2P energy trading, grid-failure prediction, and hyper-local generation monitoring.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulate_router)
app.include_router(chat_router)
app.include_router(grid_router)

@app.get("/health")
async def health():
    from llms.aicredits_client import AICreditsClient
    return {
        "status": "ok",
        "service": "powerworker-backend",
        "version": "2.0.0",
        "ai_live": AICreditsClient().is_live,
    }
