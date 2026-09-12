import { create } from 'zustand';
import { generateHouses, scenarioData } from '../data/mockData';

export type ActiveScenario = 'normal' | 'cloudCover' | 'heatwave' | 'gridFailure' | 'evSurge';
export type WsStatus = 'idle' | 'connecting' | 'negotiating' | 'done' | 'error';

export interface House {
  id: string;
  position: [number, number, number];
  energySource: 'renewable' | 'mixed' | 'grid';
  consumption: number;            // kWh
  solarContribution: number;      // %
}

export type AgentType = 'Solar' | 'Battery' | 'EV' | 'Grid' | 'Optimizer' | 'House' | 'Trading' | 'Prediction';

export interface AgentDecision {
  agent: AgentType;
  message: string;
  timestamp: string;
}

export interface TradeRecord {
  id: string;
  sellerId: string;
  buyerId: string;
  sellerNode: string;
  buyerNode: string;
  energyKwh: number;
  pricePerKwh: number;
  gridPricePerKwh: number;
  totalInr: number;
  savingsInr: number;
  reason: string;
  executedAt: string;
}

export interface GridPrediction {
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  horizonHours: number;
  narrative: string;
  recommendedActions: string[];
  factors: string[];
  aiGenerated: boolean;
  generatedAt: string;
}

export interface TradingSummary {
  totalTrades: number;
  totalEnergyKwh: number;
  totalSavingsInr: number;
  gridImportAvoidedKwh: number;
}

export interface CycleTrades {
  count: number;
  energyKwh: number;
  savingsInr: number;
}

export interface RiskPoint {
  timestamp: string;
  riskScore: number;
  riskLevel: string;
}

export interface HouseNetPosition {
  houseId: string;
  node: string;
  netKwh: number;
  role: 'seller' | 'buyer' | 'balanced';
}

export type SelectedEntityType = 'house' | 'solar' | 'battery' | 'ev' | 'hub';
export interface SelectedEntity {
  type: SelectedEntityType;
  id: string;
}

export interface EnergyStore {
  community: {
    solarGeneration: number;      // kWh, 0-500
    batteryLevel: number;         // %, 0-100
    gridImport: number;           // kWh
    evCount: number;              // active EVs charging
    moneySaved: number;           // ₹
    carbonReduced: number;        // kg CO₂
    renewableUsage: number;       // %
  };
  houses: House[];               // array of 50 houses
  activeScenario: ActiveScenario;
  agentDecisions: AgentDecision[];
  selectedHouse: string | null;
  selectedEntity: SelectedEntity | null;

  // Decentralized micro-grid intelligence
  trades: TradeRecord[];
  gridPrediction: GridPrediction | null;
  tradingSummary: TradingSummary;
  cycleTrades: CycleTrades;
  riskHistory: RiskPoint[];
  houseNetPositions: HouseNetPosition[];
  marketNarrative: string;

  // Cinematic / resilience state (drives 3D beams, blackout, hero dashboard)
  blackout: boolean;            // main grid feed lost
  islandMode: boolean;          // community self-powering on solar + battery
  resilienceScore: number;      // 0-100 headline metric
  homesProtected: number;       // homes kept powered during an outage
  stressActive: boolean;        // stress simulation running
  stressPhase: string;          // current cinematic phase label
  stressCaption: string;        // current cinematic caption

  // Sliders and Backend Status
  solarSlider: number;        // 0-100 (%)
  batterySlider: number;      // 0-100 (%)
  gridSlider: number;         // 0-100 (%)
  backendConnected: boolean;
  negotiationStatus: 'idle' | 'connecting' | 'streaming' | 'done' | 'error';
  
  // WebSocket status
  wsStatus: WsStatus;
  
  // Chat panel
  isChatOpen: boolean;
  selectedLanguage: 'english' | 'hindi' | 'telugu' | 'urdu';

  setScenario: (s: ActiveScenario) => void;
  setSelectedHouse: (id: string | null) => void;
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  updateCommunity: (data: Partial<EnergyStore['community']>) => void;
  triggerMockDecision: (agent: AgentDecision['agent'], message: string) => void;
  triggerNegotiation: () => void;
  _runMockNegotiation: () => void;

  setSolarSlider: (pct: number) => void;
  setBatterySlider: (pct: number) => void;
  setGridSlider: (pct: number) => void;
  setBackendConnected: (v: boolean) => void;
  setWsStatus: (status: WsStatus) => void;
  setChatOpen: (open: boolean) => void;
  setLanguage: (lang: 'english' | 'hindi' | 'telugu' | 'urdu') => void;
  runSimulation: () => Promise<void>;
  runStressSimulation: () => void;
  stopStressSimulation: () => void;
  setBlackout: (v: boolean) => void;
}

const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
};

const getWsUrl = () => {
  if (typeof window !== 'undefined') {
    return `ws://${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_WS_URL || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
};

const SCENARIO_BACKEND_MAP: Record<string, string | null> = {
  normal:      null,
  cloudCover:  'cloud_cover',
  heatwave:    'heatwave',
  gridFailure: 'grid_failure',
  evSurge:     'ev_surge',
};

const SCENARIO_METRICS = scenarioData;

const SOLAR_CAPACITY_KWH = 400;   // max solar at 100% slider
const BATTERY_CAPACITY_KWH = 30;  // max battery discharge per cycle at 100%
const GRID_CAPACITY_KW = 200;     // max grid import at 100%

let simulationTimeout: number | null = null;
let stressTimers: number[] = [];

const EMPTY_TRADING_SUMMARY: TradingSummary = {
  totalTrades: 0,
  totalEnergyKwh: 0,
  totalSavingsInr: 0,
  gridImportAvoidedKwh: 0,
};

// Shape of the JSON returned by POST /simulate and the ws "decisions" frame.
interface SimPayload {
  community_metrics?: EnergyStore['community'];
  trades?: TradeRecord[];
  gridPrediction?: GridPrediction | null;
  tradingSummary?: TradingSummary;
  cycleTrades?: CycleTrades;
  riskHistory?: RiskPoint[];
  houseNetPositions?: HouseNetPosition[];
  marketNarrative?: string;
}

// Map a /simulate (or ws "decisions") payload onto the store's grid-intelligence
// fields. Only overwrites what the payload actually provides.
const mapSimPayload = (raw: unknown): Partial<EnergyStore> => {
  const patch: Partial<EnergyStore> = {};
  if (typeof raw !== 'object' || raw === null) return patch;
  // Trusted first-party backend JSON; validate each field before use.
  const data = raw as SimPayload;
  if (data.community_metrics) patch.community = data.community_metrics;
  if (Array.isArray(data.trades)) patch.trades = data.trades;
  if ('gridPrediction' in data) patch.gridPrediction = data.gridPrediction ?? null;
  if (data.tradingSummary) patch.tradingSummary = data.tradingSummary;
  if (data.cycleTrades) patch.cycleTrades = data.cycleTrades;
  if (Array.isArray(data.riskHistory)) patch.riskHistory = data.riskHistory;
  if (Array.isArray(data.houseNetPositions)) patch.houseNetPositions = data.houseNetPositions;
  if (typeof data.marketNarrative === 'string') patch.marketNarrative = data.marketNarrative;
  return patch;
};

// --- Mock generators / derivations (fallback so visuals never go empty) ---
const P2P_DISCOUNT = 0.62; // peer price = 62% of the grid tariff
const GRID_PRICE: Record<string, number> = {
  normal: 8.5, cloudCover: 9.5, heatwave: 12.0, evSurge: 10.5, gridFailure: 15.0,
};
const RESILIENCE_BASE: Record<string, number> = {
  normal: 88, cloudCover: 74, heatwave: 61, evSurge: 68, gridFailure: 43,
};

const nodeOf = (id: string) => id.replace(/^house-/, 'H-');

const genMockTrades = (houses: House[], scenario: string) => {
  const gridPrice = GRID_PRICE[scenario] ?? 8.5;
  const sellers = houses.filter((h) => h.energySource === 'renewable' || h.solarContribution >= 60);
  const buyers = houses.filter((h) => h.energySource === 'grid' || h.solarContribution <= 30);
  const n = Math.min(12, Math.max(sellers.length, 1), Math.max(buyers.length, 1));
  const trades: TradeRecord[] = [];
  const now = new Date();
  for (let i = 0; i < n && sellers.length && buyers.length; i++) {
    const s = sellers[i % sellers.length];
    const b = buyers[i % buyers.length];
    if (!s || !b || s.id === b.id) continue;
    const energyKwh = Math.round((2 + Math.random() * 6) * 10) / 10;
    const pricePerKwh = Math.round(gridPrice * P2P_DISCOUNT * 100) / 100;
    const savingsInr = Math.round((gridPrice - pricePerKwh) * energyKwh);
    trades.push({
      id: `TRX-${i}-${s.id}`,
      sellerId: s.id, buyerId: b.id,
      sellerNode: nodeOf(s.id), buyerNode: nodeOf(b.id),
      energyKwh, pricePerKwh, gridPricePerKwh: gridPrice,
      totalInr: Math.round(pricePerKwh * energyKwh), savingsInr,
      reason: `${nodeOf(s.id)} exported ${energyKwh} kWh surplus solar to ${nodeOf(b.id)}`,
      executedAt: now.toISOString(),
    });
  }
  const houseNetPositions: HouseNetPosition[] = houses.map((h) => {
    const role: HouseNetPosition['role'] =
      (h.energySource === 'renewable' || h.solarContribution >= 60) ? 'seller'
      : (h.energySource === 'grid' || h.solarContribution <= 30) ? 'buyer' : 'balanced';
    const mag = Math.round((1 + Math.random() * 4) * 10) / 10;
    const netKwh = role === 'seller' ? mag : role === 'buyer' ? -mag : 0;
    return { houseId: h.id, node: nodeOf(h.id), netKwh, role };
  });
  const totalEnergyKwh = Math.round(trades.reduce((a, t) => a + t.energyKwh, 0) * 10) / 10;
  const totalSavingsInr = trades.reduce((a, t) => a + t.savingsInr, 0);
  const tradingSummary: TradingSummary = {
    totalTrades: trades.length, totalEnergyKwh, totalSavingsInr, gridImportAvoidedKwh: totalEnergyKwh,
  };
  const cycleTrades: CycleTrades = { count: trades.length, energyKwh: totalEnergyKwh, savingsInr: totalSavingsInr };
  return { trades, houseNetPositions, tradingSummary, cycleTrades };
};

const genMockPrediction = (scenario: string): GridPrediction => {
  const riskMap: Record<string, number> = { normal: 12, cloudCover: 26, heatwave: 39, evSurge: 32, gridFailure: 78 };
  const riskScore = riskMap[scenario] ?? 15;
  const riskLevel: GridPrediction['riskLevel'] =
    riskScore >= 70 ? 'critical' : riskScore >= 45 ? 'high' : riskScore >= 25 ? 'moderate' : 'low';
  return {
    riskScore, riskLevel, horizonHours: 6,
    narrative: 'Local supply and battery reserves assessed across the community; agents monitoring net positions and grid dependency.',
    recommendedActions: ['Maintain battery reserve above 15%', 'Pre-stage P2P contracts ahead of the peak window'],
    factors: [`scenario:${scenario}`], aiGenerated: false, generatedAt: new Date().toISOString(),
  };
};

const deriveResilience = (
  prediction: GridPrediction | null, blackout: boolean, islandMode: boolean, scenario: string,
): number => {
  let score = prediction ? 100 - prediction.riskScore : (RESILIENCE_BASE[scenario] ?? 80);
  if (blackout && islandMode) score = Math.max(score, 58);
  else if (blackout) score = Math.min(score, 28);
  return Math.round(Math.max(0, Math.min(100, score)));
};

export const useEnergyStore = create<EnergyStore>((set, get) => {
  const initialHouses = generateHouses();
  const initialScenario = 'normal';
  const initialData = scenarioData[initialScenario];
    const initialMock = genMockTrades(initialHouses, initialScenario);
    const initialPrediction = genMockPrediction(initialScenario);

  return {
    community: {
      solarGeneration: initialData.solarGeneration,
      batteryLevel: initialData.batteryLevel,
      gridImport: initialData.gridImport,
      evCount: initialData.evCount,
      moneySaved: initialData.moneySaved,
      carbonReduced: initialData.carbonReduced,
      renewableUsage: initialData.renewableUsage,
    },
    houses: initialHouses,
    activeScenario: initialScenario,
    agentDecisions: initialData.agentDecisions,
    selectedHouse: null,
    selectedEntity: null,

    trades: initialMock.trades,
    gridPrediction: initialPrediction,
    tradingSummary: initialMock.tradingSummary,
    cycleTrades: initialMock.cycleTrades,
    riskHistory: [{ timestamp: new Date().toISOString(), riskScore: initialPrediction.riskScore, riskLevel: initialPrediction.riskLevel }],
    houseNetPositions: initialMock.houseNetPositions,
    marketNarrative: 'Community running on rooftop solar surplus; P2P trades balancing local demand.',

    // Cinematic / resilience state
    blackout: false,
    islandMode: false,
    resilienceScore: deriveResilience(initialPrediction, false, false, initialScenario),
    homesProtected: 50,
    stressActive: false,
    stressPhase: '',
    stressCaption: '',
    
    // Initial values
    solarSlider: 100,
    batterySlider: 68,       // matches initialData.batteryLevel
    gridSlider: 50,
    backendConnected: false,
    negotiationStatus: 'idle' as const,
    wsStatus: 'idle',
    isChatOpen: false,
    selectedLanguage: 'english',

    setWsStatus: (status) => set({ wsStatus: status }),
    setChatOpen: (open) => set({ isChatOpen: open }),
    setLanguage: (lang) => set({ selectedLanguage: lang }),
    setBackendConnected: (connected) => set({ backendConnected: connected }),

    runSimulation: async () => {
      clearTimeout(simulationTimeout ?? undefined);
      simulationTimeout = window.setTimeout(async () => {
        const { activeScenario, solarSlider, batterySlider, gridSlider } = get();
        try {
          const response = await fetch(`${getBackendUrl()}/simulate`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              scenario: activeScenario,
              solar_pct: solarSlider,
              battery_pct: batterySlider,
              grid_pct: gridSlider
            }),
            signal:  AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const data = await response.json();
            set({ ...mapSimPayload(data), backendConnected: true });
          }
        } catch (err) {
          set({ backendConnected: false });
        }
      }, 300);
    },

    setBlackout: (v) => set((state) => ({
      blackout: v,
      resilienceScore: deriveResilience(state.gridPrediction, v, state.islandMode, state.activeScenario),
    })),

    runStressSimulation: () => {
      get().stopStressSimulation();
      const steps: Array<[number, () => void]> = [
        [0, () => {
          set({ stressActive: true, stressPhase: 'NOMINAL', stressCaption: 'PowerWorker online — 50 homes, autonomous agents monitoring hyper-local generation.', blackout: false, islandMode: false, homesProtected: 50 });
          get().setScenario('normal');
        }],
        [5000, () => {
          set({ stressPhase: 'PEAK DEMAND', stressCaption: '☀️ Heatwave — demand spiking. TradingAgent ramping peer-to-peer trades to hold the grid.' });
          get().setScenario('heatwave');
        }],
        [12000, () => {
          set({ stressPhase: 'FORESIGHT', stressCaption: '⚠️ PredictionAgent: grid-failure risk 87% within ~6 min — pre-charging the community battery now.', resilienceScore: 41 });
        }],
        [19000, () => {
          set({ stressPhase: 'OUTAGE', stressCaption: '🚨 GRID DOWN — main feed lost. Autonomous islanding sequence initiated.', blackout: true, islandMode: false, homesProtected: 0 });
          get().setScenario('gridFailure');
        }],
        [23500, () => {
          set({ stressPhase: 'SELF-HEAL', stressCaption: '🛡️ Islanded — battery + rooftop solar backing all 50 homes. P2P power rerouting around the dead feeder.', blackout: true, islandMode: true, homesProtected: 50, resilienceScore: 63 });
        }],
        [31000, () => {
          set({ stressPhase: 'RECOVERED', stressCaption: '✅ Grid restored — 0 homes lost power. The community rode through the outage autonomously.', blackout: false, islandMode: false, homesProtected: 50 });
          get().setScenario('normal');
        }],
        [37000, () => {
          const { tradingSummary, community } = get();
          set({ stressPhase: 'IMPACT', stressCaption: `💰 ₹${tradingSummary.totalSavingsInr.toLocaleString('en-IN')} saved · ${community.carbonReduced} kg CO₂ avoided · outage survived.`, resilienceScore: 88 });
        }],
        [44000, () => {
          set({ stressActive: false, stressPhase: '', stressCaption: '' });
        }],
      ];
      steps.forEach(([ms, fn]) => stressTimers.push(window.setTimeout(fn, ms)));
    },

    stopStressSimulation: () => {
      stressTimers.forEach((t) => clearTimeout(t));
      stressTimers = [];
      set({ stressActive: false, stressPhase: '', stressCaption: '', blackout: false, islandMode: false });
    },

    setSolarSlider: (pct) => {
      set((state) => {
        const solarSupply = SOLAR_CAPACITY_KWH * (pct / 100);
        const totalDemand = state.houses.reduce((s, h) => s + h.consumption, 0);
        const deficit = Math.max(0, totalDemand - solarSupply);

        let newBattery = state.batterySlider;
        let newGrid = state.gridSlider;

        if (deficit > 0) {
          // Battery compensates first, up to 100%
          const batteryNeeded = (deficit / BATTERY_CAPACITY_KWH) * 100;
          newBattery = Math.min(100, Math.max(newBattery, Math.ceil(batteryNeeded)));
          const batteryCovers = BATTERY_CAPACITY_KWH * (newBattery / 100);
          const remaining = Math.max(0, deficit - batteryCovers);
          if (remaining > 0) {
            const gridNeeded = (remaining / GRID_CAPACITY_KW) * 100;
            newGrid = Math.min(100, Math.max(newGrid, Math.ceil(gridNeeded)));
          }
        }

        return { solarSlider: pct, batterySlider: newBattery, gridSlider: newGrid };
      });
      get().runSimulation();
    },

    setBatterySlider: (pct) => {
      set((state) => {
        const solarSupply = SOLAR_CAPACITY_KWH * (state.solarSlider / 100);
        const batterySupply = BATTERY_CAPACITY_KWH * (pct / 100);
        const totalDemand = state.houses.reduce((s, h) => s + h.consumption, 0);
        const deficit = Math.max(0, totalDemand - solarSupply - batterySupply);

        let newGrid = state.gridSlider;
        if (deficit > 0) {
          const gridNeeded = (deficit / GRID_CAPACITY_KW) * 100;
          newGrid = Math.min(100, Math.max(newGrid, Math.ceil(gridNeeded)));
        }

        return { batterySlider: pct, gridSlider: newGrid };
      });
      get().runSimulation();
    },

    setGridSlider: (pct) => {
      set((state) => {
        const solarSupply = SOLAR_CAPACITY_KWH * (state.solarSlider / 100);
        const gridSupply = GRID_CAPACITY_KW * (pct / 100);
        const totalDemand = state.houses.reduce((s, h) => s + h.consumption, 0);
        const deficit = Math.max(0, totalDemand - solarSupply - gridSupply);

        let newBattery = state.batterySlider;
        if (deficit > 0) {
          const batteryNeeded = (deficit / BATTERY_CAPACITY_KWH) * 100;
          newBattery = Math.min(100, Math.max(newBattery, Math.ceil(batteryNeeded)));
        }

        return { gridSlider: pct, batterySlider: newBattery };
      });
      get().runSimulation();
    },

    setScenario: async (scenario) => {
      set({ activeScenario: scenario });

      // Update houses attributes based on scenario for visual effect (keep original logic)
      const state = get();
      const updatedHouses = state.houses.map((house) => {
        let consumption = house.consumption;
        let solarContribution = house.solarContribution;
        let energySource = house.energySource;

        if (scenario === 'cloudCover') {
          if (house.energySource === 'renewable') {
            solarContribution = parseFloat((25 + Math.random() * 15).toFixed(1));
            energySource = 'mixed';
          } else if (house.energySource === 'mixed') {
            solarContribution = parseFloat((5 + Math.random() * 10).toFixed(1));
            energySource = 'grid';
          }
        } else if (scenario === 'heatwave') {
          consumption = parseFloat((house.consumption * 1.6).toFixed(1));
          if (house.energySource === 'renewable') {
            solarContribution = parseFloat((60 + Math.random() * 20).toFixed(1));
            energySource = 'mixed';
          }
        } else if (scenario === 'gridFailure') {
          if (house.energySource === 'grid') {
            consumption = parseFloat((house.consumption * 0.1).toFixed(1));
          } else if (house.energySource === 'mixed') {
            consumption = parseFloat((house.consumption * 0.5).toFixed(1));
            solarContribution = 100;
          }
        } else if (scenario === 'evSurge') {
          if (house.energySource === 'grid') {
            consumption = parseFloat((house.consumption * 0.9).toFixed(1));
          }
        } else {
          if (house.id) {
            const original = initialHouses.find((h) => h.id === house.id);
            if (original) {
              consumption = original.consumption;
              solarContribution = original.solarContribution;
              energySource = original.energySource;
            }
          }
        }

        return {
          ...house,
          consumption,
          solarContribution,
          energySource,
        };
      });

      set({ houses: updatedHouses });

      // Update community metrics from backend (with fallback to mockData)
      try {
        const response = await fetch(`${getBackendUrl()}/simulate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            scenario,
            solar_pct: state.solarSlider,
            battery_pct: state.batterySlider,
            grid_pct: state.gridSlider
          }),
          signal:  AbortSignal.timeout(5000),  // 5s timeout
        });

        if (response.ok) {
          const data = await response.json();
          set((prev) => {
            const patch = mapSimPayload(data);
            const pred = patch.gridPrediction ?? prev.gridPrediction;
            return {
              ...patch,
              community: { ...prev.community, ...(patch.community ?? {}) },
              resilienceScore: deriveResilience(pred, prev.blackout, prev.islandMode, scenario),
              backendConnected: true,
            };
          });
          return;
        }
      } catch (err) {
        set({ backendConnected: false });
      }

      // Fallback: use existing mockData scenario metrics
      const scenarioMetrics = SCENARIO_METRICS[scenario];
      const mock = genMockTrades(get().houses, scenario);
      const pred = genMockPrediction(scenario);
      set((state) => ({
        community: { ...state.community, ...(scenarioMetrics ?? {}) },
        trades: mock.trades,
        houseNetPositions: mock.houseNetPositions,
        tradingSummary: mock.tradingSummary,
        cycleTrades: mock.cycleTrades,
        gridPrediction: pred,
        riskHistory: [{ timestamp: new Date().toISOString(), riskScore: pred.riskScore, riskLevel: pred.riskLevel }, ...state.riskHistory].slice(0, 30),
        resilienceScore: deriveResilience(pred, state.blackout, state.islandMode, scenario),
      }));
    },

    setSelectedHouse: (id) => set({
      selectedHouse: id,
      selectedEntity: id ? { type: 'house', id } : null,
    }),

    setSelectedEntity: (entity) => set({
      selectedEntity: entity,
      selectedHouse: entity && entity.type === 'house' ? entity.id : null,
    }),

    updateCommunity: (data) => set((state) => ({
      community: { ...state.community, ...data },
    })),

    triggerMockDecision: (agent, message) => set((state) => {
      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const newDecision: AgentDecision = { agent, message, timestamp };
      return {
        agentDecisions: [newDecision, ...state.agentDecisions].slice(0, 20),
      };
    }),

    triggerNegotiation: () => {
      const { activeScenario, solarSlider, batterySlider, gridSlider } = get();
      const BACKEND_WS = getWsUrl();

      set({ negotiationStatus: 'connecting', agentDecisions: [] });

      let ws: WebSocket;
      try {
        ws = new WebSocket(`${BACKEND_WS}/ws/negotiate`);
      } catch {
        // WebSocket constructor can throw on bad URL — fall back
        get()._runMockNegotiation();
        return;
      }

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          get()._runMockNegotiation();
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        set({ negotiationStatus: 'streaming' });
        ws.send(JSON.stringify({
          scenario: activeScenario,
          solar_pct: solarSlider,
          battery_pct: batterySlider,
          grid_pct: gridSlider,
        }));
      };

      ws.onmessage = (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
        } catch {
          return;
        }
        if (typeof parsed !== 'object' || parsed === null) return;
        const frame = parsed as Record<string, unknown>;
        const type = typeof frame.type === 'string' ? frame.type : '';

        if (type === 'log') {
          const allowed: AgentType[] = ['Solar', 'Battery', 'EV', 'Grid', 'Optimizer', 'House', 'Trading', 'Prediction'];
          const agentRaw = typeof frame.agent === 'string' ? frame.agent : 'Optimizer';
          const agent: AgentType = allowed.includes(agentRaw as AgentType) ? (agentRaw as AgentType) : 'Optimizer';
          const message = typeof frame.message === 'string' ? frame.message : '';
          const timestamp = typeof frame.timestamp === 'string' ? frame.timestamp : new Date().toLocaleTimeString();
          set((state) => ({
            agentDecisions: [{ agent, message, timestamp }, ...state.agentDecisions].slice(0, 40),
          }));
        }

        if (type === 'decisions') {
          set((prev) => {
            const patch = mapSimPayload(frame);
            return { ...patch, community: { ...prev.community, ...(patch.community ?? {}) }, backendConnected: true };
          });
        }

        if (type === 'done') {
          set({ negotiationStatus: 'done' });
          ws.close();
          window.setTimeout(() => set({ negotiationStatus: 'idle' }), 3000);
        }

        if (type === 'error') {
          set({ negotiationStatus: 'error' });
          ws.close();
          window.setTimeout(() => set({ negotiationStatus: 'idle' }), 3000);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        get()._runMockNegotiation();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        const { negotiationStatus } = get();
        if (negotiationStatus === 'connecting' || negotiationStatus === 'streaming') {
          get()._runMockNegotiation();
        }
      };
    },

    // Internal fallback — not exposed in interface but add to store:
    _runMockNegotiation: () => {
      const { activeScenario } = get();
      const decisions = scenarioData[activeScenario].agentDecisions;
      set({ negotiationStatus: 'streaming', agentDecisions: [] });
      decisions.forEach((decision, index) => {
        setTimeout(() => {
          set((state) => ({
            agentDecisions: [
              { ...decision, timestamp: new Date().toLocaleTimeString() },
              ...state.agentDecisions,
            ].slice(0, 8),
            negotiationStatus: index === decisions.length - 1 ? 'done' : 'streaming',
          }));
        }, index * 900);
      });
      setTimeout(() => set({ negotiationStatus: 'idle' }), decisions.length * 900 + 3000);
    },
  };
});
