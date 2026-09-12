'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEnergyStore } from '../../store/useEnergyStore';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { makeSolarCellTexture } from './procTextures';

export default function SolarFarm() {
  const solarGen = useEnergyStore((s) => s.community.solarGeneration);
  const activeScenario = useEnergyStore((s) => s.activeScenario);
  const selectedEntity = useEnergyStore((s) => s.selectedEntity);
  const setSelectedEntity = useEnergyStore((s) => s.setSelectedEntity);
  const active = selectedEntity?.type === 'solar';
  
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate relative glow intensity based on solar output (0 - 500 kWh scale)
  const glowIntensity = Math.max((solarGen / 500) * 1.8, 0.1);

  const cellTexture = useMemo(() => makeSolarCellTexture(), []);

  // Shared material for panels - extremely performant
  const panelMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: cellTexture,
    emissive: '#22d3ee',
    emissiveIntensity: 0.1,
    metalness: 0.6,
    roughness: 0.25,
  }), [cellTexture]);

  // Support structure material - brutalist charcoal metal
  const supportMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#212121',
    metalness: 0.9,
    roughness: 0.2,
  }), []);

  // Panel layout coordinates (relative to the Solar Farm center)
  const panels = useMemo(() => {
    const arr = [];
    const rows = 3;
    const cols = 4;
    const spacingX = 2.0;
    const spacingZ = 2.2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        arr.push({
          id: `panel-${r}-${c}`,
          x: (c - (cols - 1) / 2) * spacingX,
          z: (r - (rows - 1) / 2) * spacingZ,
        });
      }
    }
    return arr;
  }, []);

  useEffect(() => () => {
    cellTexture.dispose();
    panelMaterial.dispose();
    supportMaterial.dispose();
  }, [cellTexture, panelMaterial, supportMaterial]);

  useFrame(({ clock }) => {
    // Pulse panel material emissive intensity
    const pulse = Math.sin(clock.getElapsedTime() * 1.2) * 0.12;
    panelMaterial.emissiveIntensity = glowIntensity + pulse + (active ? 0.8 : 0);

    // Rotate panels slightly to track simulated sun
    if (groupRef.current) {
      const angle = Math.sin(clock.getElapsedTime() * 0.08) * 0.1;
      groupRef.current.children.forEach((child) => {
        if (child.name === 'panel-tilt') {
          child.rotation.x = -Math.PI / 6 + angle;
        }
      });
    }
  });

  const handleSelect = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedEntity(active ? null : { type: 'solar', id: 'solar-farm' });
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
      ref={groupRef}
      position={[-32, 0.1, -15]}
      onClick={handleSelect}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Concrete base pad */}
      <mesh receiveShadow position={[0, -0.65, 0]}>
        <boxGeometry args={[9, 0.1, 7]} />
        <meshStandardMaterial color="#0b1322" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Selection highlight ring */}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
          <ringGeometry args={[5.4, 5.9, 64]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      {/* Grid of solar panels */}
      {panels.map((panel) => (
        <group key={panel.id} position={[panel.x, 0, panel.z]} name="panel-tilt" rotation={[-Math.PI / 6, 0, 0]}>
          {/* Metal Stand support */}
          <mesh castShadow position={[0, -0.4, -0.2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.6]} />
            <primitive object={supportMaterial} attach="material" />
          </mesh>
          <mesh castShadow position={[0, -0.2, 0.2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3]} />
            <primitive object={supportMaterial} attach="material" />
          </mesh>

          {/* Panel Support Frame */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[1.5, 0.05, 1.2]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>

          {/* PV Cell Surface */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <planeGeometry args={[1.4, 1.1]} />
            <primitive object={panelMaterial} attach="material" />
          </mesh>

          {/* Dynamic Grid lines overlay on the PV surface */}
          <mesh position={[0, 0.051, 0]}>
            <planeGeometry args={[1.38, 1.08]} />
            <meshBasicMaterial 
              color="#fbbf24"
              transparent 
              opacity={activeScenario === 'cloudCover' ? 0.05 : 0.18} 
              wireframe 
            />
          </mesh>
        </group>
      ))}

      {/* Point light above farm — orange tinted */}
      <pointLight position={[0, 8, 0]} color="#22d3ee" intensity={glowIntensity * 4} distance={22} />

      {/* Neo-brutalist HTML Label */}
      <Html position={[0, 7, 0]} center pointerEvents="none">
        <div style={{
          background: 'rgba(11,17,32,0.85)',
          border: '1px solid rgba(34,211,238,0.4)',
          padding: '4px 10px',
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '10px',
          fontWeight: 700,
          color: '#e7f1ff',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderRadius: '6px',
          boxShadow: '0 0 14px rgba(34,211,238,0.3)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'auto',
        }}>
          ⚡ SOLAR FARM — {solarGen} KWH
        </div>
      </Html>
    </group>
  );
}
