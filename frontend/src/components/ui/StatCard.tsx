'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';

const T = {
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  green: '#34d399',
  red: '#fb7185',
};

const ACCENTS: Record<string, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  violet: '#a78bfa',
  blue: '#38bdf8',
};

interface StatCardProps {
  label: ReactNode;
  value: number | string;
  unit?: string;
  accent?: 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'blue';
  icon?: ReactNode;
  sublabel?: ReactNode;
  trend?: { value: number; direction: 'up' | 'down' };
}

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState('0');
  const decimals = Number.isInteger(value) ? 0 : Math.min(2, (String(value).split('.')[1] || '').length);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => {
        setDisplay(
          v.toLocaleString('en-IN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        );
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{display}</span>;
}

export function StatCard({ label, value, unit, accent = 'cyan', icon, sublabel, trend }: StatCardProps) {
  const glow = ACCENTS[accent] || T.cyan;
  const { r, g, b } = toRgb(glow);
  const numeric = typeof value === 'number' ? value : Number(value);
  const isNumeric = typeof value === 'number' || (value !== '' && !Number.isNaN(numeric));
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      style={{
        position: 'relative',
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        background: `linear-gradient(160deg, ${T.panelSolid}, rgba(15,23,42,0.72))`,
        padding: '14px 16px',
        overflow: 'hidden',
        boxShadow: `0 6px 22px rgba(0,0,0,0.32)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${glow}, transparent)`,
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -30,
          right: -20,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${r},${g},${b},0.16), transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 10,
            color: T.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        {icon != null && (
          <span style={{ color: glow, display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginTop: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 26,
            fontWeight: 700,
            color: T.text,
            lineHeight: 1,
            textShadow: `0 0 18px rgba(${r},${g},${b},0.35)`,
          }}
        >
          {isNumeric ? <AnimatedNumber value={numeric} /> : value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: 12,
              color: T.textDim,
              fontWeight: 500,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {(sublabel != null || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {trend && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: trend.direction === 'up' ? T.green : T.red,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {trend.direction === 'up' ? '▲' : '▼'} {Math.abs(trend.value)}%
            </span>
          )}
          {sublabel != null && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 10,
                color: T.textDim,
                letterSpacing: '0.04em',
              }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </motion.div>
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

export default StatCard;
