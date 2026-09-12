'use client';

import { motion } from 'framer-motion';

const T = {
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  border: 'rgba(56,189,248,0.16)',
  panelSolid: '#0e1626',
};

interface TickerProps {
  items?: string[];
}

export function Ticker({ items = [] }: TickerProps) {
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 11,
          color: T.textDim,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '8px 14px',
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          background: T.panelSolid,
        }}
      >
        Awaiting live grid telemetry…
      </div>
    );
  }

  // Duplicate the list for a seamless loop.
  const loop = [...items, ...items];

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        background: T.panelSolid,
        boxShadow: `0 0 18px rgba(34,211,238,0.1)`,
        maskImage:
          'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
        WebkitMaskImage:
          'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
      }}
    >
      <motion.div
        style={{ display: 'inline-flex', whiteSpace: 'nowrap', padding: '8px 0' }}
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: Math.max(18, items.length * 6), ease: 'linear', repeat: Infinity }}
      >
        {loop.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 22px',
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 11,
              color: T.text,
              letterSpacing: '0.04em',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: T.cyan,
                boxShadow: `0 0 6px ${T.cyan}`,
                flexShrink: 0,
              }}
            />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default Ticker;
