'use client';

import { useEnergyStore } from '../store/useEnergyStore';
import type { House } from '../store/useEnergyStore';
import CommunityScene from '../components/digitalTwin/CommunityScene';
import { ScenarioControls } from '../components/dashboard/ScenarioControls';
import HeroImpact from '../components/dashboard/HeroImpact';
import StressOverlay from '../components/dashboard/StressOverlay';
import CinematicOverlay from '../components/dashboard/CinematicOverlay';
import EntityInspector from '../components/dashboard/EntityInspector';
import TradingMarketplace from '../components/trading/TradingMarketplace';
import GridPredictionPanel from '../components/prediction/GridPredictionPanel';
import AgentConsole from '../components/agents/AgentConsole';
import MicrogridTopology from '../components/topology/MicrogridTopology';
import P2PSharingPanel from '../components/trading/P2PSharingPanel';
import ChatPanel from '../components/chat/ChatPanel';
import { Badge } from '../components/ui';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { forecast24h } from '../data/mockData';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, ShieldAlert, Cpu, Network, Play, Sparkles, Radio } from 'lucide-react';
import { useBackendHealth } from '../hooks/useBackendHealth';

const T = {
  bgBase: '#060a14',
  bgElevated: '#0b1120',
  panelSolid: '#0e1626',
  panel: 'rgba(15,23,42,0.66)',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  violet: '#a78bfa',
  blue: '#38bdf8',
  mono: 'var(--font-geist-mono)',
  sans: 'var(--font-geist-sans)',
};

const SOLAR_CAPACITY_KWH = 400;
const BATTERY_CAPACITY_KWH = 30;
const GRID_CAPACITY_KW = 200;

const MIN_PANEL = 400;
const DEFAULT_PANEL = 660;

type TabKey = 'overview' | 'trading' | 'p2plive' | 'risk' | 'agents' | 'topology';

const TABS: Array<{ key: TabKey; label: string; icon: typeof Activity }> = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'trading', label: 'P2P Trading', icon: Zap },
  { key: 'p2plive', label: 'P2P Live', icon: Radio },
  { key: 'risk', label: 'Grid Risk', icon: ShieldAlert },
  { key: 'agents', label: 'Agents', icon: Cpu },
  { key: 'topology', label: 'Topology', icon: Network },
];

const SCENARIO_LABEL: Record<string, string> = {
  normal: 'NORMAL OPS',
  cloudCover: 'CLOUD COVER',
  heatwave: 'HEATWAVE',
  gridFailure: 'GRID FAILURE',
  evSurge: 'EV SURGE',
};

export default function Home() {
  const community = useEnergyStore((s) => s.community);
  const houses = useEnergyStore((s) => s.houses);
  const activeScenario = useEnergyStore((s) => s.activeScenario);
  const selectedHouse = useEnergyStore((s) => s.selectedHouse);
  const selectedEntity = useEnergyStore((s) => s.selectedEntity);
  const setScenario = useEnergyStore((s) => s.setScenario);
  const isChatOpen = useEnergyStore((s) => s.isChatOpen);
  const setChatOpen = useEnergyStore((s) => s.setChatOpen);
  const backendConnected = useEnergyStore((s) => s.backendConnected);
  const resilienceScore = useEnergyStore((s) => s.resilienceScore);
  const stressActive = useEnergyStore((s) => s.stressActive);
  const runStressSimulation = useEnergyStore((s) => s.runStressSimulation);
  const stopStressSimulation = useEnergyStore((s) => s.stopStressSimulation);
  const runSimulation = useEnergyStore((s) => s.runSimulation);

  const solarSlider = useEnergyStore((s) => s.solarSlider);
  const batterySlider = useEnergyStore((s) => s.batterySlider);
  const gridSlider = useEnergyStore((s) => s.gridSlider);

  useBackendHealth();

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL);

  useEffect(() => {
    setMounted(true);
    runSimulation();
  }, [runSimulation]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const maxPanel = Math.min(window.innerWidth - 360, 1100);
      setPanelWidth(Math.min(Math.max(window.innerWidth - ev.clientX, MIN_PANEL), maxPanel));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const inspectedHouse = useMemo<House | null>(() => {
    if (!selectedHouse) return null;
    return houses.find((h) => h.id === selectedHouse) || null;
  }, [selectedHouse, houses]);

  const perHouseContribution = useMemo(() => {
    if (!inspectedHouse) return null;
    const totalDemand = houses.reduce((sum, h) => sum + h.consumption, 0);
    const demandShare = totalDemand > 0 ? inspectedHouse.consumption / totalDemand : 1 / 50;
    let remaining = inspectedHouse.consumption;
    const solar = Math.min(SOLAR_CAPACITY_KWH * (solarSlider / 100) * demandShare, remaining); remaining -= solar;
    const battery = Math.min(BATTERY_CAPACITY_KWH * (batterySlider / 100) * demandShare, remaining); remaining -= battery;
    const grid = Math.min(GRID_CAPACITY_KW * (gridSlider / 100) * demandShare, remaining); remaining -= grid;
    return {
      solar: Math.round(solar * 100) / 100,
      battery: Math.round(battery * 100) / 100,
      grid: Math.round(grid * 100) / 100,
      unmet: Math.round(Math.max(0, remaining) * 100) / 100,
      total: inspectedHouse.consumption,
    };
  }, [inspectedHouse, solarSlider, batterySlider, gridSlider, houses]);

  const chartData = useMemo(() => {
    let solarArray = forecast24h.solarNormal;
    let demandArray = forecast24h.demandNormal;
    if (activeScenario === 'cloudCover') solarArray = forecast24h.solarCloudy;
    else if (activeScenario === 'heatwave') demandArray = forecast24h.demandHeatwave;
    else if (activeScenario === 'evSurge') demandArray = forecast24h.demandEVSurge;
    else if (activeScenario === 'gridFailure') demandArray = forecast24h.demandNormal.map((v) => Math.round(v * 0.45));
    return forecast24h.hours.map((hour, idx) => ({ hour, generation: solarArray[idx], demand: demandArray[idx] }));
  }, [activeScenario]);

  const resilienceTone = resilienceScore >= 75 ? T.green : resilienceScore >= 50 ? T.amber : T.red;

  if (!mounted) {
    return (
      <div style={{
        display: 'flex', height: '100vh', width: '100vw', alignItems: 'center',
        justifyContent: 'center', background: T.bgBase, color: T.textDim, fontFamily: T.mono, fontSize: 13,
      }}>
        INITIALIZING POWERWORKER…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: T.bgBase }}>

      {/* LEFT — 3D digital twin (fills remaining space; full-width in focus mode) */}
      <div style={{ flex: 1, height: '100%', position: 'relative', minWidth: 0 }}>
        <CommunityScene />
        <StressOverlay />
        <CinematicOverlay />
      </div>

      {/* RIGHT — command center (hidden during stress simulation for a centered, cinematic view) */}
      <AnimatePresence>
        {!stressActive && (
          <motion.aside
            key="console"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 260 }}
            style={{
              width: panelWidth, flexShrink: 0, height: '100vh', background: T.bgBase,
              display: 'flex', flexDirection: 'column', position: 'relative',
              borderLeft: `1px solid ${T.border}`,
            }}
          >
            {/* Drag handle to resize the panel */}
            <div
              onMouseDown={startResize}
              title="Drag to resize"
              style={{
                position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, zIndex: 50,
                cursor: 'col-resize',
              }}
            >
              <div style={{ position: 'absolute', left: 3, top: 0, bottom: 0, width: 2, background: 'transparent' }} />
            </div>

            {/* Top bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderBottom: `1px solid ${T.border}`,
              background: `linear-gradient(180deg, ${T.bgElevated}, ${T.bgBase})`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `radial-gradient(circle at 30% 30%, ${T.cyan}, ${T.blue})`,
                  boxShadow: `0 0 18px ${T.cyan}66`,
                }}>
                  <Zap size={16} color="#04121f" strokeWidth={2.6} />
                </div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: '-0.01em', lineHeight: 1 }}>
                    POWER<span style={{ color: T.cyan }}>WORKER</span>
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textDim, letterSpacing: '0.16em', marginTop: 2 }}>
                    AUTONOMOUS MICRO-GRID OS
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, border: `1px solid ${resilienceTone}55`, background: `${resilienceTone}14` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textDim, letterSpacing: '0.1em' }}>RESILIENCE</span>
                  <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 800, color: resilienceTone }}>{resilienceScore}</span>
                </div>
                <Badge tone={backendConnected ? 'success' : 'neutral'}>{backendConnected ? 'AI LIVE' : 'MOCK'}</Badge>
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderBottom: `1px solid ${T.border}` }}>
              <button
                onClick={() => (stressActive ? stopStressSimulation() : runStressSimulation())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#04121f',
                  background: `linear-gradient(90deg, ${T.cyan}, ${T.green})`,
                  border: 'none', boxShadow: `0 0 18px ${T.cyan}55`,
                }}
              >
                <Play size={13} strokeWidth={2.6} /> Run Stress Simulation
              </button>
              <button
                onClick={() => setChatOpen(!isChatOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: isChatOpen ? '#04121f' : T.text,
                  background: isChatOpen ? T.violet : 'transparent',
                  border: `1px solid ${isChatOpen ? T.violet : T.border}`,
                }}
              >
                <Sparkles size={13} strokeWidth={2.4} /> Ask the Agent
              </button>
              <div style={{ marginLeft: 'auto' }}>
                <Badge tone={activeScenario === 'gridFailure' ? 'danger' : activeScenario === 'heatwave' ? 'warning' : 'info'}>
                  {SCENARIO_LABEL[activeScenario] || activeScenario}
                </Badge>
              </div>
            </div>

            {/* Content: entity inspector takes over when something is selected, else tabbed console */}
            {selectedEntity ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <EntityInspector />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderBottom: `1px solid ${T.border}`, background: T.bgElevated }}>
                  {TABS.map(({ key, label, icon: Icon }) => {
                    const active = tab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setTab(key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '11px 13px', cursor: 'pointer',
                          fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                          color: active ? T.cyan : T.textDim, background: 'transparent', border: 'none',
                          borderBottom: `2px solid ${active ? T.cyan : 'transparent'}`,
                        }}
                      >
                        <Icon size={13} strokeWidth={2.2} /> {label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.16 }}
                    >
                      {tab === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <HeroImpact />
                          <ScenarioControls activeScenario={activeScenario} onScenarioChange={setScenario} />

                          <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 12px 4px' }}>
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
                              24H Community Solar vs Demand
                            </div>
                            <div style={{ height: 200 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={T.cyan} stopOpacity={0.4} />
                                      <stop offset="95%" stopColor={T.cyan} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="demGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={T.amber} stopOpacity={0.3} />
                                      <stop offset="95%" stopColor={T.amber} stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
                                  <XAxis dataKey="hour" stroke={T.textDim} tick={{ fontFamily: T.mono, fontSize: 8, fill: T.textDim }} interval={3} />
                                  <YAxis stroke={T.textDim} tick={{ fontFamily: T.mono, fontSize: 8, fill: T.textDim }} />
                                  <Tooltip contentStyle={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, fontFamily: T.mono, fontSize: 11, color: T.text }} />
                                  <Area type="monotone" dataKey="generation" stroke={T.cyan} strokeWidth={2} fill="url(#genGrad)" dot={false} name="Solar" />
                                  <Area type="monotone" dataKey="demand" stroke={T.amber} strokeWidth={2} fill="url(#demGrad)" dot={false} name="Demand" />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, textAlign: 'center', padding: '4px 0' }}>
                            ▸ Click any house, the solar farm, battery, EV hub, or the agent core in the 3D twin to inspect it
                          </div>
                        </div>
                      )}

                      {tab === 'trading' && <TradingMarketplace />}
                      {tab === 'risk' && <GridPredictionPanel />}
                      {tab === 'agents' && <AgentConsole />}
                      {tab === 'p2plive' && <P2PSharingPanel />}
                      {tab === 'topology' && <MicrogridTopology />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 18px', borderTop: `1px solid ${T.border}`, background: T.bgElevated,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.textDim, letterSpacing: '0.12em' }}>
                POWERWORKER OPERATIONS CONSOLE v2.0
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: backendConnected ? T.green : T.textDim }}>
                {backendConnected ? '● DEEPSEEK AI LIVE' : '○ MOCK MODE'}
              </span>
            </div>

            {/* Chat slideover */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                  style={{
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: '92%', maxWidth: 560, zIndex: 30,
                    background: T.bgBase, borderLeft: `1px solid ${T.borderStrong}`, boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={14} color={T.violet} /> POWERWORKER AGENT
                    </span>
                    <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: T.mono, fontSize: 12 }}>✕</button>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <ChatPanel selectedHouse={inspectedHouse} perHouseContribution={perHouseContribution} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
