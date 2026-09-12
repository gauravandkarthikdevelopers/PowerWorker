'use client';

import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Home, Sun, BatteryCharging, Car, Cpu, X, ArrowRightLeft } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import { StatCard, Badge, SectionTitle } from '../ui';

const T = {
  bgBase: '#060a14',
  bgElevated: '#0b1120',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
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

const shell = (title: ReactNode, subtitle: ReactNode, icon: ReactNode, accent: string, onClose: () => void, body: ReactNode) => (
  <motion.div
    initial={{ opacity: 0, x: 14 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 14 }}
    transition={{ duration: 0.18 }}
    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
      background: `linear-gradient(135deg, ${accent}22, ${T.panelSolid})`, border: `1px solid ${accent}55`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}22`, border: `1px solid ${accent}66`, color: accent, boxShadow: `0 0 18px ${accent}44`,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.textDim, letterSpacing: '0.1em', marginTop: 3 }}>{subtitle}</div>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}
        aria-label="Close inspector"
      >
        <X size={14} />
      </button>
    </div>
    {body}
  </motion.div>
);

const bar = (label: string, kwh: number, total: number, color: string) => {
  const pct = total > 0 ? Math.min(100, (kwh / total) * 100) : 0;
  return (
    <div key={label} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 10, color: T.textDim, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{kwh.toFixed(2)} kWh</span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
};

export default function EntityInspector() {
  const selectedEntity = useEnergyStore((s) => s.selectedEntity);
  const setSelectedEntity = useEnergyStore((s) => s.setSelectedEntity);
  const houses = useEnergyStore((s) => s.houses);
  const community = useEnergyStore((s) => s.community);
  const houseNetPositions = useEnergyStore((s) => s.houseNetPositions);
  const trades = useEnergyStore((s) => s.trades);
  const tradingSummary = useEnergyStore((s) => s.tradingSummary);
  const agentDecisions = useEnergyStore((s) => s.agentDecisions);
  const resilienceScore = useEnergyStore((s) => s.resilienceScore);
  const marketNarrative = useEnergyStore((s) => s.marketNarrative);
  const solarSlider = useEnergyStore((s) => s.solarSlider);
  const batterySlider = useEnergyStore((s) => s.batterySlider);
  const gridSlider = useEnergyStore((s) => s.gridSlider);

  const house = useMemo(() => {
    if (selectedEntity?.type !== 'house') return null;
    return houses.find((h) => h.id === selectedEntity.id) || null;
  }, [selectedEntity, houses]);

  const houseData = useMemo(() => {
    if (!house) return null;
    const totalDemand = houses.reduce((sum, h) => sum + h.consumption, 0);
    const share = totalDemand > 0 ? house.consumption / totalDemand : 1 / 50;
    let remaining = house.consumption;
    const solar = Math.min(SOLAR_CAPACITY_KWH * (solarSlider / 100) * share, remaining); remaining -= solar;
    const battery = Math.min(BATTERY_CAPACITY_KWH * (batterySlider / 100) * share, remaining); remaining -= battery;
    const grid = Math.min(GRID_CAPACITY_KW * (gridSlider / 100) * share, remaining); remaining -= grid;
    const net = houseNetPositions.find((p) => p.houseId === house.id) || null;
    const exported = trades.filter((t) => t.sellerId === house.id);
    const imported = trades.filter((t) => t.buyerId === house.id);
    return {
      solar, battery, grid, unmet: Math.max(0, remaining),
      role: net?.role ?? 'balanced',
      netKwh: net?.netKwh ?? 0,
      exportedKwh: exported.reduce((s, t) => s + t.energyKwh, 0),
      exportedInr: exported.reduce((s, t) => s + t.savingsInr, 0),
      importedKwh: imported.reduce((s, t) => s + t.energyKwh, 0),
      tradeCount: exported.length + imported.length,
    };
  }, [house, houses, houseNetPositions, trades, solarSlider, batterySlider, gridSlider]);

  if (!selectedEntity) return null;
  const close = () => setSelectedEntity(null);

  if (selectedEntity.type === 'house' && house && houseData) {
    const roleTone = houseData.role === 'seller' ? 'success' : houseData.role === 'buyer' ? 'danger' : 'info';
    return shell(
      house.id.replace(/^house-/, 'House H-'),
      `${house.energySource.toUpperCase()} NODE · HYPER-LOCAL TELEMETRY`,
      <Home size={20} />, T.cyan, close,
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatCard label="Consumption" value={house.consumption} unit="kWh" accent="cyan" />
          <StatCard label="Solar Share" value={house.solarContribution} unit="%" accent="green" />
          <StatCard label="Net Position" value={Math.abs(houseData.netKwh)} unit="kWh" accent={houseData.role === 'seller' ? 'green' : 'red'} />
          <StatCard label="P2P Trades" value={houseData.tradeCount} unit="" accent="violet" />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={roleTone}>{houseData.role}</Badge>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
            {houseData.role === 'seller' ? 'exports surplus solar' : houseData.role === 'buyer' ? 'buys from neighbors' : 'self-balanced'}
          </span>
        </div>
        <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <SectionTitle icon={<ArrowRightLeft size={12} />}>Supply Breakdown</SectionTitle>
          {bar('☀ Solar', houseData.solar, house.consumption, T.cyan)}
          {bar('🔋 Battery', houseData.battery, house.consumption, T.green)}
          {bar('⚡ Grid', houseData.grid, house.consumption, T.red)}
          {houseData.unmet > 0.01 && bar('⚠ Unmet', houseData.unmet, house.consumption, T.amber)}
        </div>
        <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <SectionTitle icon={<ArrowRightLeft size={12} />}>P2P Activity</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
            <div>Exported <span style={{ color: T.green, fontWeight: 700 }}>{houseData.exportedKwh.toFixed(1)} kWh</span></div>
            <div>Earned <span style={{ color: T.green, fontWeight: 700 }}>₹{houseData.exportedInr.toLocaleString('en-IN')}</span></div>
            <div>Imported <span style={{ color: T.amber, fontWeight: 700 }}>{houseData.importedKwh.toFixed(1)} kWh</span></div>
            <div>Source <span style={{ color: T.text, fontWeight: 700 }}>{house.energySource}</span></div>
          </div>
        </div>
      </>,
    );
  }

  if (selectedEntity.type === 'solar') {
    const cap = SOLAR_CAPACITY_KWH * (solarSlider / 100);
    const sellers = houseNetPositions.filter((p) => p.role === 'seller').length;
    const exportedKwh = houseNetPositions.reduce((s, p) => s + (p.netKwh > 0 ? p.netKwh : 0), 0);
    return shell(
      'Community Solar Farm', 'HYPER-LOCAL GENERATION', <Sun size={20} />, T.amber, close,
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Generating Now" value={community.solarGeneration} unit="kWh" accent="amber" />
        <StatCard label="Capacity @ slider" value={Math.round(cap)} unit="kWh" accent="cyan" />
        <StatCard label="Renewable Usage" value={community.renewableUsage} unit="%" accent="green" />
        <StatCard label="Prosumer Sellers" value={sellers} unit="homes" accent="violet" />
        <StatCard label="Surplus Exported" value={Math.round(exportedKwh)} unit="kWh" accent="green" />
        <StatCard label="Grid Import" value={community.gridImport} unit="kWh" accent="red" />
      </div>,
    );
  }

  if (selectedEntity.type === 'battery') {
    const avail = BATTERY_CAPACITY_KWH * (batterySlider / 100);
    const soc = community.batteryLevel;
    return shell(
      'Community Battery', 'DISPATCHABLE STORAGE', <BatteryCharging size={20} />, T.green, close,
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="State of Charge" value={soc} unit="%" accent={soc > 40 ? 'green' : soc > 15 ? 'amber' : 'red'} />
        <StatCard label="Bank Capacity" value={BATTERY_CAPACITY_KWH} unit="kWh" accent="cyan" />
        <StatCard label="Available Discharge" value={Math.round(avail * 10) / 10} unit="kWh" accent="green" />
        <StatCard label="Reserve Floor" value={15} unit="%" accent="amber" />
      </div>,
    );
  }

  if (selectedEntity.type === 'ev') {
    return shell(
      'EV Charging Hub', 'FLEXIBLE DEMAND', <Car size={20} />, T.violet, close,
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Active Charging" value={community.evCount} unit="EVs" accent="violet" />
        <StatCard label="Fleet Size" value={10} unit="EVs" accent="cyan" />
        <StatCard label="V2G Eligible" value={Math.max(0, 10 - community.evCount)} unit="EVs" accent="green" />
        <StatCard label="Shiftable Load" value={community.evCount * 4} unit="kW" accent="amber" />
      </div>,
    );
  }

  // hub
  return shell(
    'Agent Network Core', 'AUTONOMOUS COORDINATION', <Cpu size={20} />, T.cyan, close,
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Active Agents" value={8} unit="" accent="cyan" />
        <StatCard label="Decisions Logged" value={agentDecisions.length} unit="" accent="violet" />
        <StatCard label="Grid Resilience" value={resilienceScore} unit="/100" accent={resilienceScore >= 75 ? 'green' : resilienceScore >= 50 ? 'amber' : 'red'} />
        <StatCard label="P2P Trades" value={tradingSummary.totalTrades} unit="" accent="green" />
      </div>
      {marketNarrative && (
        <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <SectionTitle icon={<Cpu size={12} />}>Market Narrative</SectionTitle>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.text, lineHeight: 1.5, margin: 0 }}>{marketNarrative}</p>
        </div>
      )}
    </>,
  );
}
