'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Radio } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';

const T = {
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

const PHASES = [
  'NOMINAL',
  'PEAK DEMAND',
  'FORESIGHT',
  'OUTAGE',
  'SELF-HEAL',
  'RECOVERED',
  'IMPACT',
] as const;

const PHASE_COLOR: Record<string, string> = {
  NOMINAL: T.green,
  'PEAK DEMAND': T.amber,
  FORESIGHT: T.violet,
  OUTAGE: T.red,
  'SELF-HEAL': T.cyan,
  RECOVERED: T.blue,
  IMPACT: T.green,
};

export default function StressOverlay() {
  const stressActive = useEnergyStore((s) => s.stressActive);
  const stressPhase = useEnergyStore((s) => s.stressPhase);
  const stressCaption = useEnergyStore((s) => s.stressCaption);

  if (!stressActive) return null;

  const activePhase = stressPhase.toUpperCase();
  const activeIndex = PHASES.findIndex((p) => p === activePhase);
  const accent = PHASE_COLOR[activePhase] || T.cyan;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        fontFamily: T.sans,
      }}
    >
      {/* Phase tracker — vertical list, top-left */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '14px 14px',
          borderRadius: 12,
          background: 'rgba(6,10,20,0.62)',
          border: `1px solid ${T.border}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: T.textDim,
            marginBottom: 2,
          }}
        >
          Stress Simulation
        </span>
        {PHASES.map((phase, i) => {
          const isActive = i === activeIndex;
          const isDone = activeIndex >= 0 && i < activeIndex;
          const color = PHASE_COLOR[phase] || T.cyan;
          return (
            <div
              key={phase}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isActive ? 1 : isDone ? 0.7 : 0.32,
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isActive || isDone ? color : 'rgba(148,163,184,0.4)',
                  boxShadow: isActive ? `0 0 10px ${color}` : 'none',
                }}
              >
                {isActive && (
                  <motion.span
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: color,
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.text : T.textDim,
                }}
              >
                {phase}
              </span>
            </div>
          );
        })}
      </div>

      {/* Caption bar — bottom center */}
      <div
        style={{
          position: 'absolute',
          bottom: 34,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(720px, 82%)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'rgba(6,10,20,0.78)',
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 40px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.05)`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Scanline accent */}
        <div style={{ position: 'relative', height: 3, background: 'rgba(148,163,184,0.12)' }}>
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '55%',
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 20px',
          }}
        >
          {/* Phase pill */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 999,
              background: `${accent}1f`,
              border: `1px solid ${accent}66`,
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accent,
              textShadow: `0 0 12px ${accent}88`,
            }}
          >
            <Radio size={13} />
            {stressPhase}
          </span>

          {/* Animated caption */}
          <div style={{ position: 'relative', flex: 1, minHeight: 22 }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={stressCaption}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                  margin: 0,
                  fontFamily: T.sans,
                  fontSize: 15,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: T.text,
                  textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                }}
              >
                {stressCaption}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
