'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, Sun, Zap } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import { Panel, Badge } from '../ui';

const T = {
  bgBase: '#060a14',
  bgElevated: '#0b1120',
  panel: 'rgba(15,23,42,0.66)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  gridLine: 'rgba(148,163,184,0.08)',
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

const VW = 640;
const VH = 540;
const CX = 320;
const CY = 292;
const SOLAR = { x: 320, y: 58 };

// concentric ring plan (sums to 50 for a full community)
const RINGS: Array<{ r: number; count: number }> = [
  { r: 96, count: 10 },
  { r: 158, count: 16 },
  { r: 222, count: 24 },
];

interface NodePos {
  x: number;
  y: number;
}

type Role = 'seller' | 'buyer' | 'balanced';

const roleColor = (role: Role | undefined): string => {
  if (role === 'seller') return T.green;
  if (role === 'buyer') return T.red;
  return T.textDim;
};

export default function MicrogridTopology() {
  const houses = useEnergyStore((s) => s.houses);
  const houseNetPositions = useEnergyStore((s) => s.houseNetPositions);
  const trades = useEnergyStore((s) => s.trades);
  const selectedHouse = useEnergyStore((s) => s.selectedHouse);
  const setSelectedHouse = useEnergyStore((s) => s.setSelectedHouse);

  const houseList = Array.isArray(houses) ? houses : [];
  const netPositions = Array.isArray(houseNetPositions) ? houseNetPositions : [];
  const tradeList = Array.isArray(trades) ? trades : [];

  // id -> screen coordinate
  const positions = useMemo(() => {
    const map = new Map<string, NodePos>();
    let idx = 0;
    for (const ring of RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const house = houseList[idx];
        if (!house) break;
        // offset each ring's starting angle for a woven look
        const angle = (i / ring.count) * Math.PI * 2 - Math.PI / 2 + (ring.r * 0.01);
        map.set(house.id, {
          x: CX + Math.cos(angle) * ring.r,
          y: CY + Math.sin(angle) * ring.r,
        });
        idx++;
      }
    }
    // any remaining houses beyond ring capacity -> outer scatter ring
    let extra = 0;
    const remaining = houseList.length - idx;
    while (idx < houseList.length) {
      const house = houseList[idx];
      const angle = (extra / Math.max(1, remaining)) * Math.PI * 2 - Math.PI / 2;
      map.set(house.id, {
        x: CX + Math.cos(angle) * 275,
        y: CY + Math.sin(angle) * 275,
      });
      idx++;
      extra++;
    }
    return map;
  }, [houseList]);

  const roleById = useMemo(() => {
    const map = new Map<string, { role: Role; netKwh: number }>();
    for (const n of netPositions) {
      map.set(n.houseId, { role: n.role as Role, netKwh: n.netKwh });
    }
    return map;
  }, [netPositions]);

  const maxAbsNet = useMemo(() => {
    let m = 0;
    for (const n of netPositions) {
      const a = Math.abs(n.netKwh || 0);
      if (a > m) m = a;
    }
    return m || 1;
  }, [netPositions]);

  const sellerCount = netPositions.filter((n) => n.role === 'seller').length;
  const buyerCount = netPositions.filter((n) => n.role === 'buyer').length;

  // active energy flows (limit for perf)
  const flows = useMemo(() => {
    return tradeList
      .slice(0, 26)
      .map((t, i) => {
        const from = positions.get(t.sellerId);
        const to = positions.get(t.buyerId);
        if (!from || !to) return null;
        return { id: t.id || `${t.sellerId}-${t.buyerId}-${i}`, from, to, i };
      })
      .filter((f): f is { id: string; from: NodePos; to: NodePos; i: number } => f !== null);
  }, [tradeList, positions]);

  const empty = houseList.length === 0;

  return (
    <Panel
      title="Micro-grid Topology"
      subtitle="Hyper-local monitoring map"
      accent="cyan"
      icon={<Network size={16} />}
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          <Badge tone="success">{sellerCount} sellers</Badge>
          <Badge tone="danger">{buyerCount} buyers</Badge>
        </div>
      }
    >
      {empty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '46px 16px',
            color: T.textDim,
            fontFamily: T.mono,
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.5 }}>🗺️</div>
          <div style={{ fontSize: 13, letterSpacing: '0.06em' }}>No nodes online</div>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', position: 'relative' }}>
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <defs>
                <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={T.cyan} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                </radialGradient>
                <radialGradient id="solarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={T.amber} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* faint ring guides */}
              {RINGS.map((ring) => (
                <circle
                  key={ring.r}
                  cx={CX}
                  cy={CY}
                  r={ring.r}
                  fill="none"
                  stroke={T.gridLine}
                  strokeWidth={1}
                />
              ))}

              {/* spokes from hub to every node */}
              {houseList.map((h) => {
                const pos = positions.get(h.id);
                if (!pos) return null;
                return (
                  <line
                    key={`spoke-${h.id}`}
                    x1={CX}
                    y1={CY}
                    x2={pos.x}
                    y2={pos.y}
                    stroke={T.gridLine}
                    strokeWidth={0.75}
                  />
                );
              })}

              {/* solar feed line */}
              <line
                x1={SOLAR.x}
                y1={SOLAR.y}
                x2={CX}
                y2={CY}
                stroke={T.amber}
                strokeOpacity={0.25}
                strokeWidth={2}
                strokeDasharray="4 6"
              />

              {/* active P2P energy flows */}
              {flows.map((f) => (
                <g key={`flow-${f.id}`}>
                  <line
                    x1={f.from.x}
                    y1={f.from.y}
                    x2={f.to.x}
                    y2={f.to.y}
                    stroke={T.violet}
                    strokeOpacity={0.35}
                    strokeWidth={1.4}
                  />
                  <motion.circle
                    r={3.2}
                    fill={T.violet}
                    initial={{ cx: f.from.x, cy: f.from.y, opacity: 0 }}
                    animate={{
                      cx: [f.from.x, f.to.x],
                      cy: [f.from.y, f.to.y],
                      opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: (f.i % 8) * 0.18,
                    }}
                  />
                </g>
              ))}

              {/* SOLAR source node */}
              <circle cx={SOLAR.x} cy={SOLAR.y} r={34} fill="url(#solarGlow)" />
              <circle
                cx={SOLAR.x}
                cy={SOLAR.y}
                r={16}
                fill={T.panelSolid}
                stroke={T.amber}
                strokeWidth={1.5}
              />
              <text
                x={SOLAR.x}
                y={SOLAR.y - 24}
                textAnchor="middle"
                fill={T.amber}
                style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.1em' }}
              >
                SOLAR
              </text>

              {/* GRID hub */}
              <circle cx={CX} cy={CY} r={46} fill="url(#hubGlow)" />
              <motion.circle
                cx={CX}
                cy={CY}
                r={22}
                fill={T.panelSolid}
                stroke={T.cyan}
                strokeWidth={2}
                animate={{ strokeOpacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <text
                x={CX}
                y={CY + 4}
                textAnchor="middle"
                fill={T.cyan}
                style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}
              >
                GRID
              </text>

              {/* house nodes */}
              {houseList.map((h) => {
                const pos = positions.get(h.id);
                if (!pos) return null;
                const np = roleById.get(h.id);
                const color = roleColor(np?.role);
                const mag = np ? Math.abs(np.netKwh || 0) / maxAbsNet : 0;
                const r = 4.5 + mag * 6;
                const isSelected = selectedHouse === h.id;
                return (
                  <g
                    key={h.id}
                    onClick={() => setSelectedHouse(h.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r + 6}
                        fill="none"
                        stroke={T.cyan}
                        strokeWidth={1.5}
                        strokeOpacity={0.9}
                      />
                    )}
                    {np?.role && np.role !== 'balanced' && (
                      <motion.circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill={color}
                        fillOpacity={0.18}
                        animate={{ r: [r, r + 5, r], fillOpacity: [0.18, 0, 0.18] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={r}
                      fill={color}
                      stroke={T.bgElevated}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* legend */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <LegendDot color={T.green} label="Seller (surplus)" />
            <LegendDot color={T.red} label="Buyer (deficit)" />
            <LegendDot color={T.textDim} label="Balanced" />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: T.mono,
                fontSize: 11,
                color: T.textDim,
                letterSpacing: '0.06em',
              }}
            >
              <Zap size={12} color={T.violet} /> {flows.length} active flows
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: T.mono,
                fontSize: 11,
                color: T.textDim,
                letterSpacing: '0.06em',
              }}
            >
              <Sun size={12} color={T.amber} /> {houseList.length} nodes
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: T.mono,
        fontSize: 11,
        color: T.textDim,
        letterSpacing: '0.06em',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
