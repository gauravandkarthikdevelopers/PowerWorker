'use client';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useEnergyStore } from '../../store/useEnergyStore';

const T = {
  panel: 'rgba(15,23,42,0.66)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  gridLine: 'rgba(148,163,184,0.18)',
  text: '#e7f1ff',
  textDim: '#8091ab',
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
};

const SLIDER_CONFIG = [
  { key: 'solar'   as const, label: 'SOLAR',   icon: '☀️', color: T.amber },
  { key: 'battery' as const, label: 'BATTERY', icon: '🔋', color: T.green },
  { key: 'grid'    as const, label: 'GRID',    icon: '⚡', color: T.cyan  },
];

export default function EnergySliders() {
  const solarSlider     = useEnergyStore((s) => s.solarSlider);
  const batterySlider   = useEnergyStore((s) => s.batterySlider);
  const gridSlider      = useEnergyStore((s) => s.gridSlider);
  const backendConnected = useEnergyStore((s) => s.backendConnected);
  const setSolarSlider   = useEnergyStore((s) => s.setSolarSlider);
  const setBatterySlider = useEnergyStore((s) => s.setBatterySlider);
  const setGridSlider    = useEnergyStore((s) => s.setGridSlider);

  // Track which sliders were auto-adjusted (show badge briefly)
  const [autoFlags, setAutoFlags] = useState({ solar: false, battery: false, grid: false });

  const values = { solar: solarSlider, battery: batterySlider, grid: gridSlider };
  const prevValues = useRef({ solar: solarSlider, battery: batterySlider, grid: gridSlider });

  useEffect(() => {
    const newAuto = {
      solar:   values.solar   !== prevValues.current.solar,
      battery: values.battery !== prevValues.current.battery,
      grid:    values.grid    !== prevValues.current.grid,
    };
    // Only flag ones that changed WITHOUT a direct user action
    // We detect indirect change by checking if the store update came from auto-compensation:
    // Simplified: flag any that changed
    if (newAuto.solar || newAuto.battery || newAuto.grid) {
      setAutoFlags(newAuto);
      const t = setTimeout(() => setAutoFlags({ solar: false, battery: false, grid: false }), 2000);
      prevValues.current = { ...values };
      return () => clearTimeout(t);
    }
    prevValues.current = { ...values };
  }, [solarSlider, batterySlider, gridSlider]);

  const handleChange = (key: 'solar' | 'battery' | 'grid', pct: number) => {
    if (key === 'solar')   setSolarSlider(pct);
    if (key === 'battery') setBatterySlider(pct);
    if (key === 'grid')    setGridSlider(pct);
  };

  const sliderValues = { solar: solarSlider, battery: batterySlider, grid: gridSlider };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: 'linear-gradient(160deg, rgba(15,23,42,0.78) 0%, rgba(11,17,32,0.72) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(56,189,248,0.14), 0 0 26px rgba(34,211,238,0.14)',
        padding: 14,
        width: 220,
        pointerEvents: 'auto',
      }}
    >
      <style>{`
        .pw-slider { -webkit-appearance: none; appearance: none; }
        .pw-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 15px; height: 15px; border-radius: 50%;
          background: var(--pw-thumb); border: 2px solid #0b1120;
          cursor: pointer; box-shadow: 0 0 10px var(--pw-thumb), 0 0 3px var(--pw-thumb);
          transition: box-shadow 0.15s ease, transform 0.1s ease;
        }
        .pw-slider::-webkit-slider-thumb:hover { transform: scale(1.15); box-shadow: 0 0 16px var(--pw-thumb); }
        .pw-slider::-moz-range-thumb {
          width: 15px; height: 15px; border-radius: 50%;
          background: var(--pw-thumb); border: 2px solid #0b1120; cursor: pointer;
          box-shadow: 0 0 10px var(--pw-thumb);
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: T.textDim,
          textTransform: 'uppercase',
          marginBottom: 14,
          paddingBottom: 8,
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <span style={{ color: T.cyan }}>⚡</span> SUPPLY CONTROLS
      </div>

      {/* Sliders */}
      {SLIDER_CONFIG.map(({ key, label, icon, color }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          {/* Label row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: T.text,
                textTransform: 'uppercase',
              }}
            >
              {icon} {label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {autoFlags[key] && (
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: 7,
                    background: 'rgba(251,191,36,0.16)',
                    color: T.amber,
                    border: '1px solid rgba(251,191,36,0.4)',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                  }}
                >
                  AUTO
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  color,
                  minWidth: 34,
                  textAlign: 'right',
                  textShadow: `0 0 10px ${color}66`,
                }}
              >
                {sliderValues[key]}%
              </span>
            </div>
          </div>

          {/* Range input */}
          <div style={{ position: 'relative' }}>
            <input
              type="range"
              className="pw-slider"
              min={0}
              max={100}
              value={sliderValues[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              style={{
                width: '100%',
                height: 6,
                background: `linear-gradient(to right, ${color} 0%, ${color} ${sliderValues[key]}%, ${T.gridLine} ${sliderValues[key]}%, ${T.gridLine} 100%)`,
                borderRadius: 6,
                outline: 'none',
                cursor: 'pointer',
                '--pw-thumb': color,
              } as CSSProperties}
            />
          </div>
        </div>
      ))}

      {/* Backend connection status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderTop: `1px solid ${T.border}`,
          paddingTop: 9,
          marginTop: 6,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: backendConnected ? T.green : T.red,
            boxShadow: `0 0 8px ${backendConnected ? T.green : T.red}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 8,
            color: T.textDim,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {backendConnected ? 'BACKEND LIVE' : 'MOCK MODE'}
        </span>
      </div>
    </div>
  );
}
