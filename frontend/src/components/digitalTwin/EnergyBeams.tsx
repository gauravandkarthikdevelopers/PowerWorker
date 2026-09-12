'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useEnergyStore, TradeRecord, HouseNetPosition } from '../../store/useEnergyStore';
import * as THREE from 'three';

const SELLER_COLOR = new THREE.Color('#34d399'); // surplus / green
const BUYER_COLOR = new THREE.Color('#fbbf24');  // deficit / amber
const MAX_BEAMS = 12;
const MAX_LABELS = 6;
const TUBULAR_SEGMENTS = 48;
const RADIAL_SEGMENTS = 8;

interface BeamProps {
  trade: TradeRecord;
  start: THREE.Vector3;
  end: THREE.Vector3;
  phase: number;
  islandMode: boolean;
  dimmed: boolean;
  showLabel: boolean;
}

function Beam({ trade, start, end, phase, islandMode, dimmed, showLabel }: BeamProps) {
  const flowRef = useRef<THREE.Mesh>(null);
  const flowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tubeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Quadratic arc seller -> buyer with a raised midpoint. In island mode the
  // midpoint is pushed radially outward so the arc visibly avoids the dead
  // central grid hub at the origin (P2P islanding).
  const curve = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y = 4;
    if (islandMode) {
      const outward = new THREE.Vector2(mid.x, mid.z);
      if (outward.lengthSq() < 0.0001) outward.set(1, 0);
      outward.normalize().multiplyScalar(7);
      mid.x += outward.x;
      mid.z += outward.y;
      mid.y = 5.2;
    }
    return new THREE.QuadraticBezierCurve3(start.clone(), mid, end.clone());
  }, [start, end, islandMode]);

  // Tube with baked green->amber gradient vertex colors along its length.
  const geometry = useMemo(() => {
    const g = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, 0.09, RADIAL_SEGMENTS, false);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const ring = RADIAL_SEGMENTS + 1; // vertices per tubular ring
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const t = Math.floor(i / ring) / TUBULAR_SEGMENTS;
      tmp.copy(SELLER_COLOR).lerp(BUYER_COLOR, t);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [curve]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const labelPos = useMemo(() => curve.getPointAt(0.5), [curve]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Energy packet scrolling seller(0) -> buyer(1).
    const t = (time * 0.28 + phase) % 1;
    if (flowRef.current) {
      flowRef.current.position.copy(curve.getPointAt(t));
    }
    if (flowMatRef.current) {
      flowMatRef.current.color.copy(SELLER_COLOR).lerp(BUYER_COLOR, t);
      flowMatRef.current.emissive.copy(flowMatRef.current.color);
      const glow = dimmed ? 0.35 : islandMode ? 3.4 : 1.6;
      flowMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        flowMatRef.current.emissiveIntensity, glow, 0.08,
      );
    }
    const pulse = 0.12 * (Math.sin(time * 3 + phase * 6.28) * 0.5 + 0.5);
    if (tubeMatRef.current) {
      const target = dimmed ? 0.15 : (islandMode ? 0.95 : 0.8) + pulse;
      tubeMatRef.current.opacity = THREE.MathUtils.lerp(tubeMatRef.current.opacity, target, 0.1);
    }
    if (haloMatRef.current) {
      const target = dimmed ? 0.03 : (islandMode ? 0.18 : 0.1) + pulse * 0.4;
      haloMatRef.current.opacity = THREE.MathUtils.lerp(haloMatRef.current.opacity, target, 0.1);
    }
  });

  return (
    <group>
      {/* Soft glow halo */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={haloMatRef}
          vertexColors
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Core gradient tube */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={tubeMatRef}
          vertexColors
          transparent
          opacity={0.8}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Moving energy packet */}
      <mesh ref={flowRef}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial
          ref={flowMatRef}
          color={SELLER_COLOR}
          emissive={SELLER_COLOR}
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      {/* Floating price chip near midpoint */}
      {showLabel && (
        <Html
          position={[labelPos.x, labelPos.y + 0.5, labelPos.z]}
          center
          occlude={false}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '9px',
              lineHeight: '1.25',
              color: '#e7f1ff',
              background: 'rgba(14,22,38,0.92)',
              border: '1px solid rgba(56,189,248,0.16)',
              borderRadius: '5px',
              padding: '3px 6px',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
              opacity: dimmed ? 0.4 : 1,
            }}
          >
            <span style={{ color: '#34d399' }}>₹{trade.pricePerKwh}/kWh</span>
            <br />
            <span style={{ color: '#8091ab' }}>{trade.energyKwh}kWh</span>
          </div>
        </Html>
      )}
    </group>
  );
}

interface NodeRingProps {
  position: THREE.Vector3;
  role: HouseNetPosition['role'];
  phase: number;
  dimmed: boolean;
}

function NodeRing({ position, role, phase, dimmed }: NodeRingProps) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const color = role === 'seller' ? SELLER_COLOR : BUYER_COLOR;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const wave = Math.sin(time * 2.2 + phase * 6.28) * 0.5 + 0.5;
    if (ref.current) {
      const s = 1 + wave * 0.5;
      ref.current.scale.set(s, s, s);
    }
    if (matRef.current) {
      const target = dimmed ? 0.08 : 0.15 + (1 - wave) * 0.35;
      matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, target, 0.12);
    }
  });

  return (
    <mesh ref={ref} position={[position.x, 0.06, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.25, 40]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function EnergyBeams() {
  const houses = useEnergyStore((s) => s.houses);
  const trades = useEnergyStore((s) => s.trades);
  const houseNetPositions = useEnergyStore((s) => s.houseNetPositions);
  const blackout = useEnergyStore((s) => s.blackout);
  const islandMode = useEnergyStore((s) => s.islandMode);

  const positions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    houses.forEach((h) => {
      map.set(h.id, new THREE.Vector3(h.position[0], 1.3, h.position[2]));
    });
    return map;
  }, [houses]);

  const beams = useMemo(() => {
    const out: { trade: TradeRecord; start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    for (const trade of trades) {
      const start = positions.get(trade.sellerId);
      const end = positions.get(trade.buyerId);
      if (start && end) out.push({ trade, start, end });
      if (out.length >= MAX_BEAMS) break;
    }
    return out;
  }, [trades, positions]);

  const rings = useMemo(
    () =>
      houseNetPositions
        .filter((np) => np.role !== 'balanced' && positions.has(np.houseId))
        .map((np) => ({ np, position: positions.get(np.houseId)! })),
    [houseNetPositions, positions],
  );

  const dimmed = blackout && !islandMode;

  if (beams.length === 0 && rings.length === 0) return null;

  return (
    <group>
      {beams.map((b, i) => (
        <Beam
          key={b.trade.id}
          trade={b.trade}
          start={b.start}
          end={b.end}
          phase={i / Math.max(beams.length, 1)}
          islandMode={islandMode}
          dimmed={dimmed}
          showLabel={i < MAX_LABELS}
        />
      ))}
      {rings.map((r, i) => (
        <NodeRing
          key={r.np.houseId}
          position={r.position}
          role={r.np.role}
          phase={i / Math.max(rings.length, 1)}
          dimmed={dimmed}
        />
      ))}
    </group>
  );
}
