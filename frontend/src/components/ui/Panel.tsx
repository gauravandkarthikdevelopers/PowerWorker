'use client';

import { motion } from 'framer-motion';
import { ReactNode, CSSProperties } from 'react';

const T = {
  panel: 'rgba(15,23,42,0.66)',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
};

const ACCENTS: Record<string, string> = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  violet: '#a78bfa',
  blue: '#38bdf8',
};

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  accent?: 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'blue';
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Panel({
  title,
  subtitle,
  icon,
  accent = 'cyan',
  actions,
  children,
  className,
  style,
}: PanelProps) {
  const glow = ACCENTS[accent] || T.cyan;
  const hasHeader = title != null || subtitle != null || icon != null || actions != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
      style={{
        position: 'relative',
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: T.panel,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: `0 8px 30px rgba(0,0,0,0.35), 0 0 22px ${hexToGlow(glow, 0.14)}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Faint top highlight line keyed off accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${glow}, transparent)`,
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
      {/* Corner accent glow */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hexToGlow(glow, 0.18)}, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {icon != null && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  color: glow,
                  background: hexToGlow(glow, 0.12),
                  border: `1px solid ${hexToGlow(glow, 0.35)}`,
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              {title != null && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.text,
                    letterSpacing: '0.01em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle != null && (
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 10,
                    color: T.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: 18, position: 'relative' }}>{children}</div>
    </motion.div>
  );
}

function hexToGlow(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default Panel;
