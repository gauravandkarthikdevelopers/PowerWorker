'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, IndianRupee, ArrowLeftRight, Radio, TrendingDown } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import type { TradeRecord } from '../../store/useEnergyStore';
import { StatCard, SectionTitle, Badge } from '../ui';

const T = {
  bgBase: '#060a14',
  bgElevated: '#0b1120',
  panelSolid: '#0e1626',
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

interface Line {
  side: 'seller' | 'buyer';
  text: string;
}

// Derive a short, deterministic agent-to-agent negotiation transcript from a
// settled trade. Shows how the Seller and Buyer agents reached the price.
const buildTranscript = (t: TradeRecord): Line[] => {
  const grid = t.gridPricePerKwh;
  const price = t.pricePerKwh;
  const sellerAsk = Math.round(price * 1.08 * 100) / 100;
  return [
    { side: 'seller', text: `I have ${t.energyKwh} kWh of surplus rooftop solar this cycle.` },
    { side: 'buyer', text: `The grid tariff is ₹${grid.toFixed(2)}/kWh right now — steep. Your rate?` },
    { side: 'seller', text: `I can release it at ₹${sellerAsk.toFixed(2)}/kWh, still worth my while.` },
    { side: 'buyer', text: `Meet me at ₹${price.toFixed(2)} — that saves me ₹${t.savingsInr.toLocaleString('en-IN')}.` },
    { side: 'seller', text: `Deal. Transmitting ${t.energyKwh} kWh now. ⚡` },
  ];
};

function Bubble({ line, seller, buyer, index }: { line: Line; seller: string; buyer: string; index: number }) {
  const isSeller = line.side === 'seller';
  const accent = isSeller ? T.green : T.amber;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.6, duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: isSeller ? 'flex-start' : 'flex-end', marginBottom: 8 }}
    >
      <span style={{ fontFamily: T.mono, fontSize: 8.5, color: accent, letterSpacing: '0.08em', marginBottom: 3 }}>
        {isSeller ? `🟢 SELLER AGENT · ${seller}` : `🟡 BUYER AGENT · ${buyer}`}
      </span>
      <div style={{
        maxWidth: '82%', padding: '8px 11px', borderRadius: 12,
        borderTopLeftRadius: isSeller ? 2 : 12, borderTopRightRadius: isSeller ? 12 : 2,
        background: `${accent}18`, border: `1px solid ${accent}55`,
        fontFamily: T.mono, fontSize: 10.5, color: T.text, lineHeight: 1.45,
      }}>
        {line.text}
      </div>
    </motion.div>
  );
}

export default function P2PSharingPanel() {
  const trades = useEnergyStore((s) => s.trades);
  const tradingSummary = useEnergyStore((s) => s.tradingSummary);
  const marketNarrative = useEnergyStore((s) => s.marketNarrative);

  const [featIdx, setFeatIdx] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const avgDiscount = useMemo(() => {
    if (!trades.length) return 0;
    const sum = trades.reduce((a, t) => a + (t.gridPricePerKwh > 0 ? (t.gridPricePerKwh - t.pricePerKwh) / t.gridPricePerKwh : 0), 0);
    return Math.round((sum / trades.length) * 100);
  }, [trades]);

  const maxKwh = useMemo(() => trades.reduce((m, t) => Math.max(m, t.energyKwh), 0.01), [trades]);

  // Auto-cycle the featured negotiation so the panel feels alive.
  useEffect(() => {
    if (trades.length < 2) return;
    const id = window.setInterval(() => setFeatIdx((i) => (i + 1) % trades.length), 7000);
    return () => window.clearInterval(id);
  }, [trades.length]);

  if (!trades.length) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: T.mono, fontSize: 12, color: T.textDim }}>
        No active P2P settlements this cycle — local generation is covering local demand.
      </div>
    );
  }

  const featured = trades[featIdx % trades.length];
  const transcript = buildTranscript(featured);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live sharing metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Power Shared" value={tradingSummary.totalEnergyKwh} unit="kWh" accent="cyan" icon={<Zap size={13} />} />
        <StatCard label="Active Trades" value={tradingSummary.totalTrades} unit="" accent="violet" icon={<ArrowLeftRight size={13} />} />
        <StatCard label="Community Saved" value={tradingSummary.totalSavingsInr} unit="₹" accent="green" icon={<IndianRupee size={13} />} />
        <StatCard label="Avg Discount" value={avgDiscount} unit="% vs grid" accent="amber" icon={<TrendingDown size={13} />} />
      </div>

      {/* Featured live negotiation */}
      <div style={{ background: T.panelSolid, border: `1px solid ${T.borderStrong}`, borderRadius: 14, padding: 14, boxShadow: `0 0 30px ${T.cyan}12` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionTitle icon={<ArrowLeftRight size={12} />}>Live Agent Negotiation</SectionTitle>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: T.mono, fontSize: 8.5, color: T.cyan }}>
            <Radio size={10} /> AUTONOMOUS
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={featured.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <Badge tone="success">{featured.sellerNode}</Badge>
              <ArrowLeftRight size={13} color={T.textDim} />
              <Badge tone="warning">{featured.buyerNode}</Badge>
            </div>
            {transcript.map((line, i) => (
              <Bubble key={i} line={line} seller={featured.sellerNode} buyer={featured.buyerNode} index={i} />
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: transcript.length * 0.6 + 0.2 }}
              style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}
            >
              <span style={{
                fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#04121f', background: T.green, padding: '5px 14px', borderRadius: 999,
                boxShadow: `0 0 18px ${T.green}66`,
              }}>
                ✓ DEAL · {featured.energyKwh} kWh @ ₹{featured.pricePerKwh.toFixed(2)}/kWh
              </span>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* All live power flows */}
      <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
        <SectionTitle icon={<Zap size={12} />}>Live Power Flows ({trades.length})</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trades.slice(0, 12).map((t) => {
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} style={{ border: `1px solid ${isOpen ? T.borderStrong : T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.green, minWidth: 42 }}>{t.sellerNode}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(148,163,184,0.12)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (t.energyKwh / maxKwh) * 100)}%`, background: `linear-gradient(90deg, ${T.green}, ${T.amber})`, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.amber, minWidth: 42, textAlign: 'right' }}>{t.buyerNode}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.cyan, minWidth: 58, textAlign: 'right' }}>{t.energyKwh} kWh</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textDim, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', borderTop: `1px solid ${T.border}`, background: T.bgElevated }}
                    >
                      <div style={{ padding: '10px 12px' }}>
                        {buildTranscript(t).map((line, i) => (
                          <div key={i} style={{ marginBottom: 5, fontFamily: T.mono, fontSize: 9.5, color: line.side === 'seller' ? T.green : T.amber }}>
                            <strong>{line.side === 'seller' ? t.sellerNode : t.buyerNode}:</strong>{' '}
                            <span style={{ color: T.text }}>{line.text}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: 6, fontFamily: T.mono, fontSize: 9, color: T.textDim }}>
                          Saved ₹{t.savingsInr.toLocaleString('en-IN')} vs ₹{t.gridPricePerKwh.toFixed(2)}/kWh grid tariff.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {marketNarrative && (
        <div style={{ background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
          <SectionTitle icon={<Radio size={12} />}>Market Narrative (AI)</SectionTitle>
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.text, lineHeight: 1.5, margin: 0 }}>{marketNarrative}</p>
        </div>
      )}
    </div>
  );
}
