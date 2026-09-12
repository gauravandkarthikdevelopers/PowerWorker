'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEnergyStore } from '../../store/useEnergyStore';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { makeBatteryRibTexture } from './procTextures';

interface ChargePulseRingProps {
  index: number;
  color: string;
  isCharging: boolean;
}

function ChargePulseRing({ index, color, isCharging }: ChargePulseRingProps) {
  const ref = useRef<THREE.Mesh>(null);
  const offset = index * (1 / 3);
  
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.getElapsedTime() * 0.4 + offset) % 1);
    ref.current.position.y = isCharging ? (t * 6) - 3 : (3 - t * 6);
    if (ref.current.material) {
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.75;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.7, 2.0, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Battery() {
  const batteryLevel = useEnergyStore((s) => s.community.batteryLevel);
  const activeScenario = useEnergyStore((s) => s.activeScenario);
  const innerRef = useRef<THREE.Mesh>(null);
  const selectedEntity = useEnergyStore((s) => s.selectedEntity);
  const setSelectedEntity = useEnergyStore((s) => s.setSelectedEntity);
  const active = selectedEntity?.type === 'battery';
  const ribTexture = useMemo(() => makeBatteryRibTexture(), []);
  useEffect(() => () => ribTexture.dispose(), [ribTexture]);
  
  const isCharging = activeScenario === 'normal' || activeScenario === 'heatwave';
  const coreColor = batteryLevel > 60 ? '#34d399' : batteryLevel > 30 ? '#fbbf24' : '#fb7185';
  const maxCoreHeight = 6.0;

  useFrame(() => {
    if (!innerRef.current) return;
    const target = (batteryLevel / 100);
    
    // Smooth transition
    innerRef.current.scale.y += (target - innerRef.current.scale.y) * 0.04;
    innerRef.current.position.y = (innerRef.current.scale.y * maxCoreHeight) / 2 + 0.1;
    
    if (innerRef.current.material) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      mat.color.set(coreColor);
      mat.emissive.set(coreColor);
      mat.emissiveIntensity = active ? 1.8 : 0.9;
    }
  });

  const handleSelect = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedEntity(active ? null : { type: 'battery', id: 'community-battery' });
  };
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
  };

  return (
    <group
      position={[28, 0, -10]}
      onClick={handleSelect}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Concrete base pad */}
      <mesh receiveShadow position={[0, -4.1, 0]}>
        <boxGeometry args={[6, 0.1, 6]} />
        <meshStandardMaterial color="#0b1322" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Selection highlight ring */}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.0, 0]}>
          <ringGeometry args={[3.4, 3.9, 64]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.75} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      {/* Glass outer shell */}
      <mesh>
        <cylinderGeometry args={[2.2, 2.2, 8, 32]} />
        <meshPhysicalMaterial
          color="#a5f3fc"
          transparent
          opacity={0.08}
          roughness={0}
          metalness={0.1}
          transmission={0.92}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Charcoal metal caps */}
      {[4.15, -4.15].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[2.3, 2.3, 0.3, 32]} />
          <meshStandardMaterial map={ribTexture} color="#ffffff" metalness={0.95} roughness={0.35} />
        </mesh>
      ))}

      {/* Glowing inner core */}
      <mesh ref={innerRef} position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[1.6, 1.6, maxCoreHeight, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={0.9}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Point light to project glow */}
      <pointLight color={coreColor} intensity={3.5} distance={15} position={[0, 0, 0]} />

      {/* Charge/discharge pulse rings */}
      {[0, 1, 2].map((i) => (
        <ChargePulseRing key={i} index={i} color={coreColor} isCharging={isCharging} />
      ))}

      {/* Neo-brutalist HTML label */}
      <Html pointerEvents="none" position={[0, 5.5, 0]} center>
        <div style={{
          pointerEvents: 'auto',
          background: 'rgba(11,17,32,0.85)',
          border: '1px solid rgba(52,211,153,0.45)',
          padding: '4px 10px',
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '10px',
          fontWeight: 700,
          color: '#e7f1ff',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderRadius: '6px',
          boxShadow: '0 0 14px rgba(52,211,153,0.3)',
          backdropFilter: 'blur(6px)',
        }}>
          BATTERY — {batteryLevel}%
        </div>
      </Html>
    </group>
  );
}
