'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  IndianRupee,
  Leaf,
  PlugZap,
  ArrowLeftRight,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import { GaugeRing } from '../ui';

const T = {
  bgBase: '#060a14',
  panelSolid: '#0e1626',
  panel: 'rgba(15,23,42,0.66)',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
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

// Assumed full retail grid tariff used for the "Without PowerWorker" baseline.
const GRID_TARIFF_INR = 12;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

function CountUp({ value, duration = 1400, decimals = 0, prefix = '', suffix = '' }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const target = Number.isFinite(value) ? value : 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const current = from + (target - from) * easeOutCubic(progress);
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [value, duration]);

  const formatted = display.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

interface HeroCard {
  key: string;
  label: string;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  icon: typeof IndianRupee;
  accent: string;
}

export default function HeroImpact() {
  const tradingSummary = useEnergyStore((s) => s.tradingSummary);
  const community = useEnergyStore((s) => s.community);
  const resilienceScore = useEnergyStore((s) => s.resilienceScore);
  const homesProtected = useEnergyStore((s) => s.homesProtected);
  const gridPrediction = useEnergyStore((s) => s.gridPrediction);

  const cards: HeroCard[] = [
    {
      key: 'saved',
      label: 'Money Saved',
      value: tradingSummary.totalSavingsInr,
      decimals: 0,
      prefix: '₹',
      suffix: '',
      icon: IndianRupee,
      accent: T.green,
    },
    {
      key: 'co2',
      label: 'CO₂ Avoided',
      value: community.carbonReduced,
      decimals: 1,
      prefix: '',
      suffix: ' kg',
      icon: Leaf,
      accent: T.cyan,
    },
    {
      key: 'grid',
      label: 'Grid Import Avoided',
      value: tradingSummary.gridImportAvoidedKwh,
      decimals: 0,
      prefix: '',
      suffix: ' kWh',
      icon: PlugZap,
      accent: T.blue,
    },
    {
      key: 'trades',
      label: 'Active P2P Trades',
      value: tradingSummary.totalTrades,
      decimals: 0,
      prefix: '',
      suffix: '',
      icon: ArrowLeftRight,
      accent: T.violet,
    },
  ];

  const resilience = Math.max(0, Math.min(100, resilienceScore));
  const resilienceTone: 'success' | 'warning' | 'danger' =
    resilience >= 75 ? 'success' : resilience >= 50 ? 'warning' : 'danger';
  const resilienceColor =
    resilience >= 75 ? T.green : resilience >= 50 ? T.amber : T.red;

  const withoutCost = tradingSummary.totalEnergyKwh * GRID_TARIFF_INR;
  const withCost = Math.max(0, withoutCost - tradingSummary.totalSavingsInr);
  const savedPct = withoutCost > 0 ? (tradingSummary.totalSavingsInr / withoutCost) * 100 : 0;
  const withPctWidth = withoutCost > 0 ? (withCost / withoutCost) * 100 : 0;

  const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        fontFamily: T.sans,
        color: T.text,
      }}
    >
      {/* Hero KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '18px 18px 16px',
                borderRadius: 16,
                background: `linear-gradient(155deg, ${T.panel}, rgba(6,10,20,0.72))`,
                border: `1px solid ${T.border}`,
                backdropFilter: 'blur(10px)',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 30px rgba(0,0,0,0.35)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 110,
                  height: 110,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${card.accent}22, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: `${card.accent}1f`,
                    border: `1px solid ${card.accent}44`,
                    color: card.accent,
                  }}
                >
                  <Icon size={16} strokeWidth={2.2} />
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10.5,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: T.textDim,
                  }}
                >
                  {card.label}
                </span>
              </div>
              <div
                style={{
                  fontFamily: T.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: T.text,
                  textShadow: `0 0 22px ${card.accent}55`,
                }}
              >
                <CountUp
                  value={card.value}
                  decimals={card.decimals}
                  prefix={card.prefix}
                  suffix={card.suffix}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Resilience gauge + with/without comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 260px) 1fr',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* Resilience gauge card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.32, ease: 'easeOut' }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 18,
            borderRadius: 16,
            background: `linear-gradient(155deg, ${T.panel}, rgba(6,10,20,0.72))`,
            border: `1px solid ${T.border}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <GaugeRing
            value={resilience}
            max={100}
            tone={resilienceTone}
            size={150}
            label="GRID RESILIENCE"
            sublabel="score"
          />
          {gridPrediction && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: resilienceColor,
              }}
            >
              <ShieldCheck size={12} />
              {gridPrediction.riskLevel} risk · {gridPrediction.horizonHours}h horizon
            </div>
          )}
        </motion.div>

        {/* With vs Without */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 18,
            borderRadius: 16,
            background: `linear-gradient(155deg, ${T.panel}, rgba(6,10,20,0.72))`,
            border: `1px solid ${T.border}`,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: T.textDim,
              }}
            >
              With vs Without PowerWorker
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: T.mono,
                fontSize: 12,
                fontWeight: 600,
                color: T.green,
              }}
            >
              <TrendingDown size={13} />
              {savedPct.toFixed(0)}% saved
            </span>
          </div>

          {/* Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.textDim,
                }}
              >
                <span>Without · full grid tariff</span>
                <span style={{ color: T.red, fontWeight: 600 }}>{inr(withoutCost)}</span>
              </div>
              <div
                style={{
                  height: 14,
                  borderRadius: 7,
                  background: 'rgba(148,163,184,0.12)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: withoutCost > 0 ? '100%' : '0%' }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    borderRadius: 7,
                    background: `linear-gradient(90deg, ${T.red}, #f43f5e)`,
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 5,
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.textDim,
                }}
              >
                <span>With · peer-to-peer trading</span>
                <span style={{ color: T.green, fontWeight: 600 }}>{inr(withCost)}</span>
              </div>
              <div
                style={{
                  height: 14,
                  borderRadius: 7,
                  background: 'rgba(148,163,184,0.12)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(withCost > 0 ? 4 : 0, withPctWidth)}%` }}
                  transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    borderRadius: 7,
                    background: `linear-gradient(90deg, ${T.green}, ${T.cyan})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Delta + homes protected */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingTop: 12,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: T.textDim,
                }}
              >
                Community saved
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.green }}>
                {inr(tradingSummary.totalSavingsInr)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: T.textDim,
                }}
              >
                Homes protected in outage
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                  fontSize: 22,
                  fontWeight: 700,
                  color: T.cyan,
                }}
              >
                <ShieldCheck size={18} />
                {homesProtected}/50
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
