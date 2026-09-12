'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, IndianRupee, TrendingUp, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';
import type { TradeRecord } from '../../store/useEnergyStore';
import { Panel, StatCard, Badge, Ticker, SectionTitle } from '../ui';

const T = {
  bgBase: '#060a14',
  bgElevated: '#0b1120',
  panel: 'rgba(15,23,42,0.66)',
  panelSolid: '#0e1626',
  border: 'rgba(56,189,248,0.16)',
  borderStrong: 'rgba(56,189,248,0.40)',
  gridLine: 'rgba(148,163,184,0.08)',
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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const fmtNum = (n: number | undefined | null, digits = 0) => {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
};

const nodeLabel = (id: string | undefined, fallback: string | undefined) => {
  if (fallback && fallback.trim().length) return fallback;
  if (!id) return '—';
  return id.replace(/^house-/, 'H-');
};

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

function TradeRow({ trade, index }: { trade: TradeRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const grid = trade.gridPricePerKwh || 0;
  const p2p = trade.pricePerKwh || 0;
  const discount = grid > 0 ? Math.max(0, Math.round(((grid - p2p) / grid) * 100)) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.02 }}
      onClick={() => setOpen((o) => !o)}
      style={{
        cursor: 'pointer',
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: 'rgba(10,16,30,0.55)',
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* seller -> buyer flow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 190px', minWidth: 0 }}>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 12,
              color: T.green,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {nodeLabel(trade.sellerId, trade.sellerNode)}
          </span>
          <motion.span
            animate={{ x: [0, 5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', color: T.violet }}
          >
            <ArrowRight size={16} />
          </motion.span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 12,
              color: T.red,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {nodeLabel(trade.buyerId, trade.buyerNode)}
          </span>
        </div>

        {/* energy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 78 }}>
          <Zap size={13} color={T.amber} />
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>
            {fmtNum(trade.energyKwh, 1)} <span style={{ color: T.textDim }}>kWh</span>
          </span>
        </div>

        {/* price vs grid */}
        <div style={{ minWidth: 120, textAlign: 'right' }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.cyan }}>
            ₹{fmtNum(p2p, 2)}
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              color: T.textDim,
              textDecoration: 'line-through',
              marginLeft: 6,
            }}
          >
            ₹{fmtNum(grid, 2)}
          </span>
          {discount > 0 && (
            <span style={{ marginLeft: 6 }}>
              <Badge tone="success">-{discount}%</Badge>
            </span>
          )}
        </div>

        {/* savings */}
        <div style={{ minWidth: 96, textAlign: 'right' }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.green, fontWeight: 600 }}>
            +₹{fmtNum(trade.savingsInr, 2)}
          </span>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, letterSpacing: '0.08em' }}>
            {fmtTime(trade.executedAt)}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && trade.reason && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px dashed ${T.border}`,
                fontFamily: T.sans,
                fontSize: 12,
                color: T.textDim,
                lineHeight: 1.5,
              }}
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: 6, color: T.violet }} />
              {trade.reason}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TradingMarketplace() {
  const trades = useEnergyStore((s) => s.trades);
  const tradingSummary = useEnergyStore((s) => s.tradingSummary);
  const cycleTrades = useEnergyStore((s) => s.cycleTrades);
  const marketNarrative = useEnergyStore((s) => s.marketNarrative);

  const [fullLedger, setFullLedger] = useState<TradeRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const summary = tradingSummary || {
    totalTrades: 0,
    totalEnergyKwh: 0,
    totalSavingsInr: 0,
    gridImportAvoidedKwh: 0,
  };
  const cycle = cycleTrades || { count: 0, energyKwh: 0, savingsInr: 0 };

  const liveTrades = Array.isArray(trades) ? trades : [];
  const displayTrades = fullLedger ?? liveTrades;

  const tickerItems = useMemo(
    () =>
      liveTrades
        .slice(0, 12)
        .map(
          (t) =>
            `${nodeLabel(t.sellerId, t.sellerNode)} → ${nodeLabel(t.buyerId, t.buyerNode)}  ·  ${fmtNum(
              t.energyKwh,
              1,
            )} kWh  ·  saved ₹${fmtNum(t.savingsInr, 2)}`,
        ),
    [liveTrades],
  );

  const loadFullLedger = async () => {
    if (loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/grid/trade-log?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const pick = (v: unknown): TradeRecord[] => {
        if (Array.isArray(v)) return v as TradeRecord[];
        if (v && typeof v === 'object') {
          const obj = v as Record<string, unknown>;
          if (Array.isArray(obj.trades)) return obj.trades as TradeRecord[];
          if (Array.isArray(obj.tradeLog)) return obj.tradeLog as TradeRecord[];
        }
        return [];
      };
      setFullLedger(pick(data));
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        <StatCard
          label="Total Trades"
          value={fmtNum(summary.totalTrades)}
          accent="violet"
          icon={<Layers size={16} />}
          sublabel={`+${fmtNum(cycle.count)} this cycle`}
        />
        <StatCard
          label="Energy Traded"
          value={fmtNum(summary.totalEnergyKwh, 1)}
          unit="kWh"
          accent="amber"
          icon={<Zap size={16} />}
          sublabel={`+${fmtNum(cycle.energyKwh, 1)} kWh cycle`}
        />
        <StatCard
          label="Community Savings"
          value={`₹${fmtNum(summary.totalSavingsInr)}`}
          accent="green"
          icon={<IndianRupee size={16} />}
          sublabel={`+₹${fmtNum(cycle.savingsInr)} cycle`}
        />
        <StatCard
          label="Grid Import Avoided"
          value={fmtNum(summary.gridImportAvoidedKwh, 1)}
          unit="kWh"
          accent="cyan"
          icon={<TrendingUp size={16} />}
          sublabel="peak demand offset"
        />
      </div>

      {/* AI market commentary banner */}
      {marketNarrative && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'relative',
            borderRadius: 16,
            border: `1px solid ${T.borderStrong}`,
            background: 'linear-gradient(120deg, rgba(167,139,250,0.14), rgba(34,211,238,0.06))',
            padding: '14px 16px',
            boxShadow: '0 0 22px rgba(167,139,250,0.18)',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Badge tone="info">AI</Badge>
            <SectionTitle icon={<Sparkles size={12} />}>Market Intelligence</SectionTitle>
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: T.sans,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: T.text,
            }}
          >
            {marketNarrative}
          </p>
          <motion.div
            aria-hidden
            animate={{ x: ['-30%', '130%'] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '30%',
              height: '100%',
              background:
                'linear-gradient(90deg, transparent, rgba(167,139,250,0.12), transparent)',
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      )}

      {/* Live ticker */}
      {tickerItems.length > 0 && <Ticker items={tickerItems} />}

      {/* Trade ledger */}
      <Panel
        title="P2P Trade Ledger"
        subtitle={fullLedger ? 'Full historical log' : 'Live cycle feed'}
        accent="violet"
        icon={<Layers size={16} />}
        actions={
          <button
            onClick={fullLedger ? () => setFullLedger(null) : loadFullLedger}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${T.borderStrong}`,
              background: 'rgba(56,189,248,0.08)',
              color: T.cyan,
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <motion.span
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
              style={{ display: 'inline-flex' }}
            >
              <RefreshCw size={13} />
            </motion.span>
            {fullLedger ? 'Show live' : loading ? 'Loading…' : 'Load full ledger'}
          </button>
        }
      >
        {loadError && (
          <div
            style={{
              marginBottom: 10,
              fontFamily: T.mono,
              fontSize: 11,
              color: T.red,
            }}
          >
            ⚠ {loadError}
          </div>
        )}

        {displayTrades.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: T.textDim,
              fontFamily: T.mono,
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.5 }}>⚡</div>
            <div style={{ fontSize: 13, letterSpacing: '0.06em' }}>
              No trades yet — run a scenario
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, opacity: 0.7 }}>
              Agents will negotiate P2P trades during peak demand
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            <AnimatePresence initial={false}>
              {displayTrades.map((t, i) => (
                <TradeRow key={t.id || `${t.sellerId}-${t.buyerId}-${i}`} trade={t} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </Panel>
    </div>
  );
}
