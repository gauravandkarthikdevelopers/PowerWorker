'use client';

import { motion } from 'framer-motion';
import { ActiveScenario } from '../../store/useEnergyStore';

const T = {
  panel: 'rgba(15,23,42,0.66)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
};

const SCENARIOS = [
  { id: 'normal',      label: 'NORMAL',    icon: '☀️',  accent: '#34d399' },
  { id: 'cloudCover',  label: 'CLOUD',     icon: '☁️',  accent: '#8091ab' },
  { id: 'heatwave',    label: 'HEATWAVE',  icon: '🔥',  accent: '#fbbf24' },
  { id: 'gridFailure', label: 'OUTAGE',    icon: '⚡',  accent: '#fb7185' },
  { id: 'evSurge',     label: 'EV SURGE',  icon: '🚗',  accent: '#a78bfa' },
] as const;

interface ScenarioControlsProps {
  activeScenario: ActiveScenario;
  onScenarioChange: (s: ActiveScenario) => void;
}

function toRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function ScenarioControls({ activeScenario, onScenarioChange }: ScenarioControlsProps) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.panel,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        padding: 16,
      }}
    >
      {/* Section header */}
      <p
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: T.textDim,
          textTransform: 'uppercase',
          margin: '0 0 12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: T.cyan,
            boxShadow: `0 0 8px ${T.cyan}`,
          }}
        />
        SCENARIO SIMULATOR
      </p>

      {/* 5 scenario buttons in a row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {SCENARIOS.map((s) => {
          const isActive = activeScenario === s.id;
          const { r, g, b } = toRgb(s.accent);
          return (
            <motion.button
              key={s.id}
              onClick={() => onScenarioChange(s.id as ActiveScenario)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                padding: '11px 4px',
                borderRadius: 12,
                border: isActive
                  ? `1px solid rgba(${r},${g},${b},0.7)`
                  : `1px solid ${T.border}`,
                background: isActive
                  ? `linear-gradient(160deg, rgba(${r},${g},${b},0.24), rgba(${r},${g},${b},0.08))`
                  : T.panelSolid,
                color: isActive ? T.text : T.textDim,
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 8.5,
                fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'color 0.15s ease, background 0.15s ease, border 0.15s ease',
                outline: 'none',
                boxShadow: isActive
                  ? `0 0 18px rgba(${r},${g},${b},0.35), inset 0 0 12px rgba(${r},${g},${b},0.12)`
                  : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  filter: isActive ? 'none' : 'grayscale(0.4)',
                  opacity: isActive ? 1 : 0.85,
                }}
              >
                {s.icon}
              </span>
              <span style={{ color: isActive ? s.accent : T.textDim }}>{s.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
