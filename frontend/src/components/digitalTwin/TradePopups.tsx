'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEnergyStore, TradeRecord } from '../../store/useEnergyStore';

// ---------------------------------------------------------------------------
// Floating P2P savings numbers ("damage numbers" for the grid).
//
// A small pool of chips float up + fade from the SELLER house of recent trades
// then recycle to the next trade, staggered so a few are always in flight. The
// per-frame rise/fade is driven by direct DOM/transform mutation (no re-render);
// React state only changes on recycle, when a slot picks up a new trade. Chips
// never intercept pointer events, so the houses stay clickable.
// ---------------------------------------------------------------------------

const DURATION = 2.6; // seconds per float
const RISE = 2.0; // world units risen over the lifetime
const BASE_Y = 1.6; // starting height above the seller house
const MAX_SLOTS = 6;

interface PopupProps {
  slot: number;
  slotCount: number;
  trades: TradeRecord[];
  positions: Map<string, THREE.Vector3>;
  stagger: number;
}

function Popup({ slot, slotCount, trades, positions, stagger }: PopupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const [tradeIdx, setTradeIdx] = useState(slot);

  const trade = trades[tradeIdx % trades.length];
  const pos = positions.get(trade.sellerId);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (startRef.current === null) startRef.current = time + stagger;
    const elapsed = time - startRef.current;
    const div = divRef.current;
    if (elapsed < 0) {
      if (div) div.style.opacity = '0';
      return;
    }
    // Finished (or nowhere to anchor) -> recycle this slot onto the next trade.
    if (elapsed >= DURATION || !pos) {
      startRef.current = time;
      setTradeIdx((i) => (i + slotCount) % trades.length);
      return;
    }
    const p = elapsed / DURATION;
    if (groupRef.current) groupRef.current.position.set(pos.x, pos.y + BASE_Y + p * RISE, pos.z);
    // Quick fade-in, long fade-out.
    if (div) div.style.opacity = String(p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88);
  });

  if (!pos) return null;

  return (
    <group ref={groupRef} position={[pos.x, pos.y + BASE_Y, pos.z]}>
      <Html center occlude={false} zIndexRange={[18, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={divRef}
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '11px',
            lineHeight: '1.2',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            padding: '3px 7px',
            borderRadius: '6px',
            background: 'rgba(6,10,20,0.82)',
            border: '1px solid rgba(52,211,153,0.35)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: '#34d399', fontWeight: 700, textShadow: '0 0 8px rgba(52,211,153,0.6)' }}>
            +₹{Math.round(trade.savingsInr)}
          </span>
          <br />
          <span style={{ color: '#8091ab', fontSize: '9px' }}>{trade.energyKwh.toFixed(1)}kWh</span>
        </div>
      </Html>
    </group>
  );
}

export default function TradePopups() {
  const trades = useEnergyStore((s) => s.trades);
  const houses = useEnergyStore((s) => s.houses);

  const positions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    houses.forEach((h) => map.set(h.id, new THREE.Vector3(h.position[0], h.position[1], h.position[2])));
    return map;
  }, [houses]);

  if (trades.length === 0) return null;

  const slotCount = Math.min(MAX_SLOTS, trades.length);

  return (
    <group>
      {Array.from({ length: slotCount }, (_, i) => (
        <Popup
          key={i}
          slot={i}
          slotCount={slotCount}
          trades={trades}
          positions={positions}
          stagger={i * (DURATION / slotCount)}
        />
      ))}
    </group>
  );
}
