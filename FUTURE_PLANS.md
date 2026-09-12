# PowerWorker — Remodel Progress & Continuation Plan

> Resume doc so work can continue with zero re-discovery. Last updated: cinematic-features build complete (P2P beams, stress-sim, grid-fail cinematic, hero dashboard, cross-cycle agent memory).

## What PowerWorker Is (new philosophy)
Decentralized micro-grid intelligence. A network of autonomous AI agents that:
1. **Monitor hyper-local generation** per household (rooftop solar vs. demand → net position).
2. **Predict grid failures** with a real-time risk score + AI narrative + mitigations.
3. **Autonomously execute peer-to-peer (P2P) energy trading** — surplus houses sell directly
   to deficit neighbors at a dynamic price between solar cost and the grid tariff.
The AI advisor is named the **PowerWorker Agent**.

Real AI: **aicredits.in** (OpenAI-compatible), model **deepseek-chat**. Config in `.env.local`
(`AI_CREDITS_API_KEY`, `AI_CREDITS_MODEL`, `AI_CREDITS_BASE_URL`). Verified live (`/health` → `ai_live:true`).

## Architecture
### Backend (`backend/`, FastAPI, Python 3.14, venv at `backend/.venv`)
- `llms/aicredits_client.py` — `AICreditsClient`: `.chat()` (tool-calling), `.complete()` (narratives), mock fallback.
- `agents/graph.py` — LangGraph: Solar→Battery→House→EV→Grid→Optimizer→**Trading**→**Prediction**.
- `agents/trading_agent.py` — P2P matching + dynamic pricing + `enrich_market_narrative()` (async LLM).
- `agents/prediction_agent.py` — grid-risk scoring + `enrich_prediction_narrative()` (async LLM, JSON).
- `agents/memory.py` — in-memory ledger (trades, risk history, last result) + **cross-cycle market memory** (fill ratio + last clearing price) so the Trading agent adapts pricing across cycles.
- `agents/state.py` — CommunityState + TradeRecord/GridPrediction/HouseNetPosition channels.
- `routers/simulate.py` — POST `/simulate`, WS `/ws/negotiate` (streams agent reasoning + final payload).
- `routers/chat.py` — POST `/chat` (PowerWorker Agent, multilingual native replies, no Sarvam).
- `routers/grid.py` — GET `/grid/status`, `/grid/trade-log`, `/grid/risk-history`, `/grid/summary`.
- Removed: `groq_client.py`, `sarvam_client.py`, `routers/voice.py` (voice dropped per user).
- Run: `cd backend && . .venv/bin/activate && uvicorn main:app --port 8000` (managed as hub process `pw-backend`).

### Frontend (`frontend/`, Next.js 16, React 19, TS, Tailwind v4, r3f, recharts, zustand)
- `src/store/useEnergyStore.ts` — DONE: new types (TradeRecord, GridPrediction, TradingSummary,
  CycleTrades, RiskPoint, HouseNetPosition, AgentType) + fields (trades, gridPrediction,
  tradingSummary, cycleTrades, riskHistory, houseNetPositions, marketNarrative) + `mapSimPayload`
  wired into runSimulation/setScenario/ws-decisions.
- `src/app/layout.tsx`, `src/app/globals.css` — DONE: PowerWorker dark theme + ambient grid backdrop.
- 3D digital twin under `src/components/digitalTwin/` — KEEP (user: don't rewrite; light polish only allowed).

## Contract for subagent-built UI (locked)
- Theme tokens: bg `#060a14`, panel `rgba(15,23,42,0.66)`, border `rgba(56,189,248,0.16)`,
  text `#e7f1ff`, dim `#8091ab`, cyan `#22d3ee`, green `#34d399`, amber `#fbbf24`, red `#fb7185`,
  violet `#a78bfa`, blue `#38bdf8`. Glass panels, neon glow, mono for data, framer-motion, recharts.
- `components/ui/` primitives (agent DesignSystem): Panel, StatCard, Badge, GaugeRing, Ticker, SectionTitle.
- New panels (agent FeaturePanels), default export no props, read store:
  `trading/TradingMarketplace.tsx`, `prediction/GridPredictionPanel.tsx`,
  `topology/MicrogridTopology.tsx`, `agents/AgentConsole.tsx`.

## Status
- [x] Backend AI core (verified live: trades + risk + AI narratives + chat)
- [x] Rebrand backend + package.json + layout metadata + globals theme
- [x] Removed external doc links (frontend README, gitignore comment); voice fully removed
- [x] Store contract extended + `mapSimPayload` wired (runSimulation/setScenario/ws)
- [x] Design system: `components/ui/{Panel,StatCard,Badge,GaugeRing,Ticker,SectionTitle,index}`
- [x] Restyled: ScenarioControls, EnergySliders, ChatPanel (→ PowerWorker Agent, voice removed), AgentOverlay
- [x] Feature panels: TradingMarketplace, GridPredictionPanel, MicrogridTopology, AgentConsole
- [x] Root README.md + this doc

### ▶ NEXT (resume here — NOT started)
1. **Rebuild `src/app/page.tsx`** (still using the legacy white/neo-brutalist styling; does not import new panels).
   New dark command-center shell:
   - Top bar: PowerWorker wordmark + tagline, live backend/AI status dot, chat toggle, scenario badge.
     (Header/footer branding text already updated to PowerWorker.)
   - Left: `<CommunityScene/>` (unchanged 3D). Right/main: tabs — Overview (KPI StatCards from `community`
     + 24h forecast chart + existing house inspector logic), P2P Trading `<TradingMarketplace/>`,
     Grid Risk `<GridPredictionPanel/>`, Microgrid Map `<MicrogridTopology/>`, Agent Console `<AgentConsole/>`.
   - Keep `<ChatPanel/>` slideover via `isChatOpen`. On mount: `useBackendHealth()` + initial `setScenario('normal')`
     (or `runSimulation()`) so panels populate. Use `components/ui` primitives; drop old inline StatCard.
   - Imports: `../components/ui`, `../components/trading/TradingMarketplace`, `../components/prediction/GridPredictionPanel`,
     `../components/topology/MicrogridTopology`, `../components/agents/AgentConsole`.
2. **Light 3D polish** (optional, approved): lighting/material/theme colors only in digitalTwin — no logic.
3. **Verify:** `cd frontend && npm install && npx next build`. Backend runs as hub process `pw-backend` :8000.
4. **Browser smoke test:** :3000 — all 5 scenarios + sliders + chat; confirm trades/risk/map/console populate.

## Known TODO / polish ideas (stretch)
- Stream marketNarrative/prediction via WS too (currently only final decisions frame).
- Per-house trade history drill-down from topology node click.
- Gamified leaderboard of top P2P sellers/savers (data already in trade log).
- Animate KPI deltas between cycles.
- Deploy notes (env for NEXT_PUBLIC_BACKEND_URL).

## Rules in effect (project lint)
- No `: any` / `as any` (use unknown + guards / named types).
- No `ReturnType<typeof fn>` in published contracts (name the type).
- Don't guard `clearTimeout` when body only clears.
