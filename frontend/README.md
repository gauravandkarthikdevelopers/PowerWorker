# PowerWorker — Frontend

Real-time command center for the PowerWorker autonomous micro-grid: 3D digital twin, P2P energy
trading marketplace, grid-failure prediction, and the PowerWorker Agent advisor.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. The backend must be running on port 8000 (see `../backend`).

Set `NEXT_PUBLIC_BACKEND_URL` to point at a non-local backend if needed.

## Structure

- `src/app/page.tsx` — command-center shell (tabbed dashboard + 3D twin + chat slideover)
- `src/store/useEnergyStore.ts` — zustand store + backend wiring
- `src/components/ui/` — design-system primitives
- `src/components/trading|prediction|topology|agents/` — feature panels
- `src/components/digitalTwin/` — react-three-fiber 3D scene
