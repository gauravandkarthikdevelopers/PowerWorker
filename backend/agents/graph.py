"""
graph.py
LangGraph graph topology for the PowerWorker multi-agent micro-grid system.

Sequential, deterministic flow — each agent enriches the shared
CommunityState before passing it on:

    SolarAgent -> BatteryAgent -> HouseAgent -> EVAgent -> GridAgent
        -> Optimizer -> TradingAgent (P2P) -> PredictionAgent (grid risk)

The physics/dispatch math is deterministic (reliable, fast, no
hallucinated numbers). The AI reasoning layer (deepseek-chat via
aicredits.in) is layered on top asynchronously by the routers for the
trading market narrative, grid-risk analysis, and the PowerWorker Agent
advisor.
"""

from langgraph.graph import StateGraph

from agents.state import CommunityState
from agents.solar_agent import solar_agent_fn
from agents.battery_agent import battery_agent_fn
from agents.house_agent import house_agents_fn
from agents.ev_agent import ev_agent_fn
from agents.grid_agent import grid_agent_fn
from agents.optimizer import optimizer_fn
from agents.trading_agent import trading_agent_fn
from agents.prediction_agent import prediction_agent_fn


def build_graph():
    """Construct and compile the PowerWorker LangGraph state graph."""
    graph = StateGraph(CommunityState)

    graph.add_node("solar_agent", solar_agent_fn)
    graph.add_node("battery_agent", battery_agent_fn)
    graph.add_node("house_agents", house_agents_fn)
    graph.add_node("ev_agent", ev_agent_fn)
    graph.add_node("grid_agent", grid_agent_fn)
    graph.add_node("optimizer", optimizer_fn)
    graph.add_node("trading_agent", trading_agent_fn)
    graph.add_node("prediction_agent", prediction_agent_fn)

    graph.set_entry_point("solar_agent")
    graph.add_edge("solar_agent", "battery_agent")
    graph.add_edge("battery_agent", "house_agents")
    graph.add_edge("house_agents", "ev_agent")
    graph.add_edge("ev_agent", "grid_agent")
    graph.add_edge("grid_agent", "optimizer")
    graph.add_edge("optimizer", "trading_agent")
    graph.add_edge("trading_agent", "prediction_agent")
    graph.set_finish_point("prediction_agent")

    return graph.compile()


# Compile once at module load — reused across cycles.
app = build_graph()
