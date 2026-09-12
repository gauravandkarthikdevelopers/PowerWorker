'use client';

import { ReactNode } from 'react';

const TONES: Record<string, string> = {
  neutral: '#8091ab',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#fb7185',
  info: '#22d3ee',
};

interface BadgeProps {
  children?: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const color = TONES[tone] || TONES.neutral;
  const { r, g, b } = toRgb(color);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        fontFamily: 'var(--font-geist-mono)',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        background: `rgba(${r},${g},${b},0.12)`,
        border: `1px solid rgba(${r},${g},${b},0.4)`,
        boxShadow: `0 0 12px rgba(${r},${g},${b},0.18)`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
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

export default Badge;
