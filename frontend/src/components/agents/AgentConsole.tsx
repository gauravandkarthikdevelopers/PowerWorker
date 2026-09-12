'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Play, Radio } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import type { AgentType } from '../../store/useEnergyStore';
import { Panel } from '../ui';

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

const AGENT_COLOR: Record<string, string> = {
  Solar: T.amber,
  Battery: T.green,
  EV: T.amber,
  Grid: T.cyan,
  Optimizer: T.cyan,
  House: T.textDim,
  Trading: T.violet,
  Prediction: T.blue,
};

const AGENT_ICON: Record<string, string> = {
  Solar: '☀',
  Battery: '🔋',
  EV: '🚗',
  Grid: '⚡',
  Optimizer: '⚙',
  House: '🏠',
  Trading: '💱',
  Prediction: '🔮',
};

const agentColor = (agent: string): string => AGENT_COLOR[agent] || T.textDim;
const agentIcon = (agent: string): string => AGENT_ICON[agent] || '◆';

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export default function AgentConsole() {
  const agentDecisions = useEnergyStore((s) => s.agentDecisions);
  const wsStatus = useEnergyStore((s) => s.wsStatus);
  const negotiationStatus = useEnergyStore((s) => s.negotiationStatus);
  const triggerNegotiation = useEnergyStore((s) => s.triggerNegotiation);

  const [filter, setFilter] = useState<AgentType | 'All'>('All');

  const decisions = Array.isArray(agentDecisions) ? agentDecisions : [];

  const streaming =
    negotiationStatus === 'streaming' || String(wsStatus) === 'streaming';

  // agent types present, preserving a stable canonical order
  const CANONICAL: AgentType[] = [
    'Solar',
    'Battery',
    'EV',
    'Grid',
    'Optimizer',
    'House',
    'Trading',
    'Prediction',
  ];
  const presentTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const d of decisions) seen.add(d.agent);
    return CANONICAL.filter((t) => seen.has(t));
  }, [decisions]);

  const filtered = useMemo(
    () => (filter === 'All' ? decisions : decisions.filter((d) => d.agent === filter)),
    [decisions, filter],
  );

  return (
    <Panel
      title="Autonomous Agent Console"
      subtitle="Live reasoning feed"
      accent="violet"
      icon={<Cpu size={16} />}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {streaming && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: '0.1em',
                color: T.green,
              }}
            >
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'inline-flex' }}
              >
                <Radio size={12} />
              </motion.span>
              STREAMING
            </span>
          )}
          <button
            onClick={() => triggerNegotiation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${T.borderStrong}`,
              background: 'rgba(167,139,250,0.12)',
              color: T.violet,
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Play size={12} /> Run Agent Cycle
          </button>
        </div>
      }
    >
      {/* filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <FilterChip
          label="All"
          color={T.cyan}
          active={filter === 'All'}
          onClick={() => setFilter('All')}
        />
        {presentTypes.map((t) => (
          <FilterChip
            key={t}
            label={t}
            color={agentColor(t)}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '44px 16px',
            color: T.textDim,
            fontFamily: T.mono,
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.5 }}>🤖</div>
          <div style={{ fontSize: 13, letterSpacing: '0.06em' }}>
            {decisions.length === 0
              ? 'Agents idle — run a cycle to begin'
              : 'No decisions for this filter'}
          </div>
        </div>
      ) : (
        <div
          style={{
            maxHeight: 440,
            overflowY: 'auto',
            paddingRight: 4,
            position: 'relative',
          }}
        >
          {/* timeline rail */}
          <div
            style={{
              position: 'absolute',
              left: 17,
              top: 4,
              bottom: 4,
              width: 1,
              background: T.border,
            }}
          />
          <AnimatePresence initial={false}>
            {filtered.map((d, i) => {
              const color = agentColor(d.agent);
              return (
                <motion.div
                  key={`${d.timestamp}-${d.agent}-${i}`}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.02 }}
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 10,
                    position: 'relative',
                  }}
                >
                  {/* avatar */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: T.panelSolid,
                      border: `1.5px solid ${color}`,
                      boxShadow: `0 0 12px ${color}44`,
                      fontSize: 15,
                      zIndex: 1,
                    }}
                  >
                    {agentIcon(d.agent)}
                  </div>

                  {/* body */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: 12,
                      border: `1px solid ${T.border}`,
                      borderLeft: `2px solid ${color}`,
                      background: 'rgba(10,16,30,0.55)',
                      padding: '8px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color,
                        }}
                      >
                        {d.agent}
                      </span>
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 9,
                          color: T.textDim,
                          letterSpacing: '0.06em',
                          flexShrink: 0,
                        }}
                      >
                        {fmtTime(d.timestamp)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: T.sans,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: T.text,
                      }}
                    >
                      {d.message}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Panel>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${active ? color : T.border}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : T.textDim,
        fontFamily: T.mono,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </button>
  );
}
