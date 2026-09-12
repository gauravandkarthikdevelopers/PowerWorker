'use client';

import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEnergyStore, House as HouseType } from '../../store/useEnergyStore';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { acquireHouseTextures, releaseHouseTextures } from './procTextures';

interface HouseProps {
  house: HouseType;
}

export default function House({ house }: HouseProps) {
  const meshRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const selectedHouse = useEnergyStore((state) => state.selectedHouse);
  const setSelectedHouse = useEnergyStore((state) => state.setSelectedHouse);
  const [hovered, setHovered] = useState(false);

  const textures = useMemo(() => acquireHouseTextures(), []);
  useEffect(() => () => releaseHouseTextures(), []);

  const isSelected = selectedHouse === house.id;

  // Animate hover/selection scales in useFrame for maximum smoothness (60fps)
  useFrame((state) => {
    if (meshRef.current) {
      const targetScale = isSelected ? 1.15 : hovered ? 1.08 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      
      // Floating animation when selected
      if (isSelected) {
        meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 4) * 0.08 + 0.1;
      } else {
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, 0.1);
      }
    }

    if (glowRef.current && isSelected) {
      const t = state.clock.getElapsedTime();
      const pulseOpacity = 0.12 + Math.sin(t * 4) * 0.06;
      const pulseScale = 1.05 + Math.sin(t * 4) * 0.03;
      if (glowRef.current.material) {
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = pulseOpacity;
      }
      glowRef.current.scale.set(pulseScale, pulseScale, pulseScale);
    }
  });


  // Smart-meter status LED color matching the energy feed:
  // Renewable = Teal Green (#28A745), Mixed = Warm Amber (#FFC107), Grid = Crimson (#DC2626)
  const getStatusColor = () => {
    switch (house.energySource) {
      case 'renewable':
        return '#34d399';
      case 'mixed':
        return '#fbbf24';
      case 'grid':
        return '#fb7185';
      default:
        return '#8091ab';
    }
  };

  const statusColor = getStatusColor();

  // Unified click handler to ensure selection works on either mesh
  const handleSelect = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedHouse(isSelected ? null : house.id);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const houseNumber = house.id.split('-')[1] || '0';

  return (
    <group
      ref={meshRef}
      position={[house.position[0], house.position[1], house.position[2]]}
    >
      {/* House Body — modern dark panel with energy-source trim */}
      <mesh
        castShadow
        receiveShadow
        onClick={handleSelect}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          map={textures.wall}
          color="#ffffff"
          roughness={0.6}
          metalness={0.3}
          emissive={statusColor}
          emissiveMap={textures.windows}
          emissiveIntensity={isSelected ? 1.4 : hovered ? 1.0 : 0.7}
        />
      </mesh>

      {/* Flat Slanted Roof slab */}
      <mesh
        position={[0, 0.65, 0]}
        castShadow
        onClick={handleSelect}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[1.3, 0.15, 1.3]} />
        <meshStandardMaterial
          map={textures.roof}
          color="#ffffff"
          roughness={0.7}
          metalness={0.25}
          emissive={statusColor}
          emissiveIntensity={isSelected ? 0.4 : hovered ? 0.2 : 0.06}
        />
      </mesh>

      {/* Smart Meter status LED on the front wall (visualizes feed type dynamically) */}
      <mesh 
        position={[0, 0.15, 0.61]}
        onClick={handleSelect}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial 
          color={statusColor} 
          emissive={statusColor}
          emissiveIntensity={isSelected ? 4.5 : hovered ? 3.0 : 1.0}
        />
      </mesh>

      {/* Minimalist Door slot */}
      <mesh position={[-0.3, -0.3, 0.605]}>
        <planeGeometry args={[0.25, 0.5]} />
          <meshStandardMaterial color="#0a1220" roughness={1.0} />
      </mesh>

      {/* Outline highlight (Gives Digital Twin aesthetic on hover/select) */}
      {(hovered || isSelected) && (
        <lineSegments position={[0, 0, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1.25, 1.25, 1.25)]} />
          <lineBasicMaterial
            color={isSelected ? '#22d3ee' : statusColor}
            linewidth={2}
          />
        </lineSegments>
      )}

      {/* Glow Effect when selected */}
      {isSelected && (
        <mesh ref={glowRef}>
          <boxGeometry args={[1.22, 1.22, 1.22]} />
          <meshBasicMaterial 
            color={statusColor} 
            transparent 
            opacity={0.15} 
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.59, 0]}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      {/* Floating label above the house */}
      {isSelected && (
        <Html pointerEvents="none" position={[0, 1.45, 0]} center distanceFactor={15}>
          <div style={{
            background: 'rgba(11,17,32,0.85)',
            color: '#e7f1ff',
            border: '1px solid rgba(56,189,248,0.4)',
            padding: '4px 9px',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '9px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            borderRadius: '6px',
            boxShadow: '0 0 14px rgba(34,211,238,0.35)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
            }} />
            H-{houseNumber} Selected
          </div>
        </Html>
      )}
    </group>
  );
}
