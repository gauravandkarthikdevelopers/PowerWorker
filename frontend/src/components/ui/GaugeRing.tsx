'use client';

import { ReactNode, useId } from 'react';
import { motion } from 'framer-motion';

const T = {
  text: '#e7f1ff',
  textDim: '#8091ab',
  track: 'rgba(148,163,184,0.14)',
};

const TONES: Record<string, [string, string]> = {
  success: ['#34d399', '#22d3ee'],
  warning: ['#fbbf24', '#fb923c'],
  danger: ['#fb7185', '#f43f5e'],
  info: ['#22d3ee', '#38bdf8'],
};

interface GaugeRingProps {
  value: number;
  max?: number;
  label?: ReactNode;
  sublabel?: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info';
  size?: number;
}

export function GaugeRing({
  value,
  max = 100,
  label,
  sublabel,
  tone = 'info',
  size = 120,
}: GaugeRingProps) {
  const uid = useId().replace(/[:]/g, '');
  const [from, to] = TONES[tone] || TONES.info;
  const safeMax = max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(1, safeValue / safeMax));

  const stroke = Math.max(6, size * 0.09);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  // 270-degree arc (gap at bottom)
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const dashOffset = arcLength * (1 - pct);
  const rotation = 135; // start at bottom-left

  const displayValue = Number.isInteger(safeValue)
    ? safeValue.toLocaleString('en-IN')
    : safeValue.toLocaleString('en-IN', { maximumFractionDigits: 1 });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: size,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={T.track}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* Value arc */}
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#grad-${uid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${from})` }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: size * 0.24,
              fontWeight: 700,
              color: T.text,
              lineHeight: 1,
              textShadow: `0 0 16px ${from}`,
            }}
          >
            {displayValue}
          </span>
          {sublabel != null && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: size * 0.09,
                color: T.textDim,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {label != null && (
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 10,
            color: T.textDim,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textAlign: 'center',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default GaugeRing;
