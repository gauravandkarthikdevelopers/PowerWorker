'use client';

import { useEnergyStore } from '../../store/useEnergyStore';
import { Html } from '@react-three/drei';

const T = {
  panel: 'rgba(11,17,32,0.86)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  green: '#34d399',
};

const AGENT_ACCENT_COLORS: Record<string, string> = {
  Solar:      '#fbbf24', // amber
  Battery:    '#34d399', // green
  EV:         '#fbbf24', // amber
  Grid:       '#fb7185', // red
  Optimizer:  '#22d3ee', // cyan
  House:      '#38bdf8', // blue
  Trading:    '#a78bfa', // violet
  Prediction: '#38bdf8', // blue
};

export default function AgentOverlay() {
  const agentDecisions = useEnergyStore((state) => state.agentDecisions);
  const recent = agentDecisions.slice(0, 5);

  return (
    <Html pointerEvents="none" position={[-42, 22, -25]} center>
      <div
        style={{
          pointerEvents: 'auto',
          width: 300,
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          background: T.panel,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.45), 0 0 22px rgba(34,211,238,0.18)',
          fontFamily: 'var(--font-geist-mono)',
          overflow: 'hidden',
        }}
      >
        {/* Top highlight line */}
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${T.cyan}, transparent)`,
            opacity: 0.7,
          }}
        />

        {/* Header bar */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: T.text,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: T.cyan }}>◈</span> AGENT NETWORK
          </span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: T.green,
              boxShadow: `0 0 8px ${T.green}`,
              display: 'inline-block',
              animation: 'pw-agent-pulse 1.6s ease-in-out infinite',
            }}
          />
        </div>

        <style>{`
          @keyframes pw-agent-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(0.8); }
          }
        `}</style>

        {/* Decision log entries */}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {recent.length === 0 ? (
            <div
              style={{
                padding: '22px 14px',
                textAlign: 'center',
                fontSize: 10.5,
                color: T.textDim,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Awaiting network negotiation…
            </div>
          ) : (
            recent.map((d, i) => {
              const accent = AGENT_ACCENT_COLORS[d.agent] || T.cyan;
              const isNewest = i === 0;
              const { r, g, b } = toRgb(accent);
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    padding: '10px 14px',
                    borderBottom: i === recent.length - 1 ? 'none' : `1px solid ${T.border}`,
                    background: isNewest
                      ? `linear-gradient(90deg, rgba(${r},${g},${b},0.12), transparent)`
                      : 'transparent',
                    transition: 'background 0.3s ease',
                  }}
                >
                  {/* Left accent bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: accent,
                      boxShadow: isNewest ? `0 0 8px ${accent}` : 'none',
                      opacity: isNewest ? 1 : 0.5,
                    }}
                  />
                  {/* Agent name row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: accent,
                        textShadow: `0 0 10px rgba(${r},${g},${b},0.4)`,
                      }}
                    >
                      {d.agent.toUpperCase()} AGENT
                    </span>
                    <span style={{ fontSize: 8.5, color: T.textDim }}>{d.timestamp}</span>
                  </div>
                  {/* Message */}
                  <p
                    style={{
                      fontSize: 10.5,
                      margin: 0,
                      lineHeight: 1.45,
                      color: isNewest ? T.text : T.textDim,
                    }}
                  >
                    {d.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Html>
  );
}

function toRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
