'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ShieldAlert, CheckCircle2, Activity, AlertTriangle, Clock } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import { Panel, Badge, GaugeRing, SectionTitle } from '../ui';

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

type GaugeTone = 'success' | 'warning' | 'danger' | 'info';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const riskColor = (level: string | undefined): string => {
  switch (level) {
    case 'low':
      return T.green;
    case 'moderate':
      return T.amber;
    case 'high':
      return T.red;
    case 'critical':
      return T.red;
    default:
      return T.textDim;
  }
};

type PanelAccent = 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'blue';

const accentName = (level: string | undefined): PanelAccent => {
  switch (level) {
    case 'low':
      return 'green';
    case 'moderate':
      return 'amber';
    case 'high':
    case 'critical':
      return 'red';
    default:
      return 'blue';
  }
};

const gaugeTone = (level: string | undefined): GaugeTone => {
  switch (level) {
    case 'low':
      return 'success';
    case 'moderate':
      return 'warning';
    case 'high':
    case 'critical':
      return 'danger';
    default:
      return 'info';
  }
};

const badgeTone = (level: string | undefined): BadgeTone => {
  switch (level) {
    case 'low':
      return 'success';
    case 'moderate':
      return 'warning';
    case 'high':
    case 'critical':
      return 'danger';
    default:
      return 'neutral';
  }
};

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

interface RiskChartPoint {
  t: string;
  score: number;
}

export default function GridPredictionPanel() {
  const gridPrediction = useEnergyStore((s) => s.gridPrediction);
  const riskHistory = useEnergyStore((s) => s.riskHistory);

  const history: RiskChartPoint[] = useMemo(() => {
    const rows = Array.isArray(riskHistory) ? riskHistory : [];
    return rows.map((r) => ({
      t: fmtTime(r.timestamp),
      score: typeof r.riskScore === 'number' ? Math.round(r.riskScore) : 0,
    }));
  }, [riskHistory]);

  if (!gridPrediction) {
    return (
      <Panel title="Grid Failure Prediction" accent="blue" icon={<ShieldAlert size={16} />}>
        <div
          style={{
            textAlign: 'center',
            padding: '46px 16px',
            color: T.textDim,
            fontFamily: T.mono,
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.5 }}>🛰️</div>
          <div style={{ fontSize: 13, letterSpacing: '0.06em' }}>
            Awaiting prediction model
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
            Run a scenario to generate a grid-risk forecast
          </div>
        </div>
      </Panel>
    );
  }

  const p = gridPrediction;
  const level = p.riskLevel;
  const alert = level === 'high' || level === 'critical';
  const accent = riskColor(level);
  const actions = Array.isArray(p.recommendedActions) ? p.recommendedActions : [];
  const factors = Array.isArray(p.factors) ? p.factors : [];
  const score = typeof p.riskScore === 'number' ? Math.round(p.riskScore) : 0;

  return (
    <Panel
      title="Grid Failure Prediction"
      subtitle="Early-warning intelligence"
      accent={accentName(level)}
      icon={<ShieldAlert size={16} />}
      actions={
        <Badge tone={badgeTone(level)}>
          {(level || 'unknown').toUpperCase()} RISK
        </Badge>
      }
      style={
        alert
          ? { boxShadow: `0 0 30px ${accent}55, 0 8px 30px rgba(0,0,0,0.35)` }
          : undefined
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(160px, 200px) 1fr',
          gap: 18,
          alignItems: 'center',
        }}
      >
        {/* Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <motion.div
            animate={
              alert
                ? { scale: [1, 1.04, 1], filter: ['brightness(1)', 'brightness(1.25)', 'brightness(1)'] }
                : {}
            }
            transition={alert ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <GaugeRing
              value={score}
              max={100}
              label="RISK SCORE"
              sublabel={`${p.horizonHours ?? 0}h horizon`}
              tone={gaugeTone(level)}
              size={168}
            />
          </motion.div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: T.mono,
              fontSize: 10,
              color: T.textDim,
              letterSpacing: '0.08em',
            }}
          >
            <Clock size={11} /> FORECAST {p.horizonHours ?? 0}H · {fmtTime(p.generatedAt)}
          </div>
        </div>

        {/* Narrative + factors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <SectionTitle icon={<Activity size={12} />}>Analysis</SectionTitle>
              {p.aiGenerated && <Badge tone="info">AI-analyzed</Badge>}
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: T.text,
              }}
            >
              {p.narrative || 'No narrative available.'}
            </p>
          </div>

          {factors.length > 0 && (
            <div>
              <SectionTitle>Contributing factors</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {factors.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: T.mono,
                      fontSize: 11,
                      color: T.text,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${T.border}`,
                      background: 'rgba(56,189,248,0.06)',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommended actions */}
      {actions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle icon={<CheckCircle2 size={12} />}>Recommended actions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {actions.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: 'rgba(10,16,30,0.5)',
                }}
              >
                <span style={{ color: accent, marginTop: 1, flexShrink: 0 }}>
                  {alert ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                </span>
                <span style={{ fontFamily: T.sans, fontSize: 13, color: T.text, lineHeight: 1.5 }}>
                  {a}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Risk history sparkline */}
      {history.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle icon={<Activity size={12} />}>Risk trend</SectionTitle>
          <div style={{ width: '100%', height: 120, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={T.gridLine} vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: T.textDim, fontSize: 9, fontFamily: T.mono }}
                  stroke={T.border}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: T.textDim, fontSize: 9, fontFamily: T.mono }}
                  stroke={T.border}
                  tickLine={false}
                  width={34}
                />
                <Tooltip
                  contentStyle={{
                    background: T.panelSolid,
                    border: `1px solid ${T.borderStrong}`,
                    borderRadius: 10,
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.text,
                  }}
                  labelStyle={{ color: T.textDim }}
                  formatter={(v) => [String(v), 'risk']}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={accent}
                  strokeWidth={2}
                  fill="url(#riskGrad)"
                  isAnimationActive
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}
