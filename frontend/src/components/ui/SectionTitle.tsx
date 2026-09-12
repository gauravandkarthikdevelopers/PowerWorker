'use client';

import { ReactNode } from 'react';

const T = {
  textDim: '#8091ab',
  cyan: '#22d3ee',
  border: 'rgba(56,189,248,0.16)',
};

interface SectionTitleProps {
  children?: ReactNode;
  icon?: ReactNode;
}

export function SectionTitle({ children, icon }: SectionTitleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}
    >
      {icon != null && (
        <span style={{ color: T.cyan, display: 'inline-flex', fontSize: 12 }}>{icon}</span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10.5,
          fontWeight: 600,
          color: T.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${T.border}, transparent)`,
        }}
      />
    </div>
  );
}

export default SectionTitle;
