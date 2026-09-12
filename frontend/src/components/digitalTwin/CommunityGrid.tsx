'use client';

import { useEnergyStore } from '../../store/useEnergyStore';
import House from './House';
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { makeGroundTexture, makeAsphaltTexture } from './procTextures';

export default function CommunityGrid() {
  const houses = useEnergyStore((state) => state.houses);
  const selectedEntity = useEnergyStore((state) => state.selectedEntity);
  const setSelectedEntity = useEnergyStore((state) => state.setSelectedEntity);
  const hubActive = selectedEntity?.type === 'hub';

  const groundTexture = useMemo(() => makeGroundTexture(), []);
  const asphaltTexture = useMemo(() => makeAsphaltTexture(), []);
  useEffect(() => () => {
    groundTexture.dispose();
    asphaltTexture.dispose();
  }, [groundTexture, asphaltTexture]);

  // Road coordinates to generate gold dashed lines
  const horizontalDashes = useMemo(() => {
    const arr = [];
    for (let x = -24; x <= 24; x += 4) {
      if (Math.abs(x) > 1) { // leave intersection clear
        arr.push(x);
      }
    }
    return arr;
  }, []);

  const verticalDashes = useMemo(() => {
    const arr = [];
    for (let z = -26; z <= 14; z += 4) {
      if (z < -8 || z > 2) { // leave intersections clear
        arr.push(z);
      }
    }
    return arr;
  }, []);

  // Tree coordinates aligned along the roads (pin-cushion style)
  const treePositions = useMemo((): [number, number, number][] => {
    return [
      // Along main vertical road (x = 0)
      [1.4, 0, -20], [-1.4, 0, -20],
      [1.4, 0, -12], [-1.4, 0, -12],
      [1.4, 0, -4], [-1.4, 0, -4],
      [1.4, 0, 4], [-1.4, 0, 4],
      [1.4, 0, 12], [-1.4, 0, 12],
      
      // Along main horizontal road (z = 0)
      [-22, 0, 1.4], [-22, 0, -1.4],
      [-10, 0, 1.4], [-10, 0, -1.4],
      [-4, 0, 1.4], [-4, 0, -1.4],
      [4, 0, 1.4], [4, 0, -1.4],
      [10, 0, 1.4], [10, 0, -1.4],
      [22, 0, 1.4], [22, 0, -1.4],
    ];
  }, []);

  const hubRingRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (hubActive && hubRingRef.current) {
      const t = state.clock.getElapsedTime();
      hubRingRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
      const mat = hubRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 + Math.sin(t * 3) * 0.25;
    }
  });

  const handleHubSelect = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedEntity(hubActive ? null : { type: 'hub', id: 'agent-core' });
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
    <group>
      {/* Premium dark ground plane — deep navy HUD base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.605, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial map={groundTexture} color="#ffffff" roughness={0.62} metalness={0.35} emissive="#0b1a2b" emissiveIntensity={0.22} />
      </mesh>

      {/* Houses */}
      {houses.map((house) => (
        <House key={house.id} house={house} />
      ))}

      {/* Roads — low-contrast dark slate */}
      {/* Horizontal Main Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
        <planeGeometry args={[60, 2]} />
        <meshStandardMaterial map={asphaltTexture} color="#ffffff" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Vertical Main Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -6]} receiveShadow>
        <planeGeometry args={[2, 44]} />
        <meshStandardMaterial map={asphaltTexture} color="#ffffff" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* East Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16, -0.6, -6]} receiveShadow>
        <planeGeometry args={[2, 44]} />
        <meshStandardMaterial map={asphaltTexture} color="#ffffff" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* West Road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-16, -0.6, -6]} receiveShadow>
        <planeGeometry args={[2, 44]} />
        <meshStandardMaterial map={asphaltTexture} color="#ffffff" roughness={0.7} metalness={0.3} />
      </mesh>

      {/* Dashed Center Lines — faint cyan grid glow */}
      {/* Horizontal Main Road Dashes */}
      {horizontalDashes.map((x) => (
        <mesh key={`h-dash-${x}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.595, 0]}>
          <planeGeometry args={[1.2, 0.08]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
      {/* Vertical Main Road Dashes */}
      {verticalDashes.map((z) => (
        <mesh key={`v-dash-main-${z}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.595, z]}>
          <planeGeometry args={[1.2, 0.08]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
      {/* East Road Dashes */}
      {verticalDashes.map((z) => (
        <mesh key={`v-dash-east-${z}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[16, -0.595, z]}>
          <planeGeometry args={[1.2, 0.08]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
      {/* West Road Dashes */}
      {verticalDashes.map((z) => (
        <mesh key={`v-dash-west-${z}`} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-16, -0.595, z]}>
          <planeGeometry args={[1.2, 0.08]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}

      {/* Foliage — subtle dark-teal canopy lining the roads */}
      {treePositions.map((pos, idx) => (
        <group key={`tree-${idx}`} position={pos}>
          {/* Trunk */}
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
            <meshStandardMaterial color="#0b1a1c" roughness={0.9} />
          </mesh>
          {/* Leaves */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#0f3d38" emissive="#134e4a" emissiveIntensity={0.25} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Central Agent Network Core — glowing cyan hub at the intersection */}
      <group
        position={[0, -0.1, 0]}
        onClick={handleHubSelect}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Base plate */}
        <mesh position={[0, -0.4, 0]}>
          <boxGeometry args={[0.9, 0.1, 0.9]} />
          <meshStandardMaterial color="#0b1322" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Side cylinders */}
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.1, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} emissive="#22d3ee" emissiveIntensity={0.4} />
          </mesh>
        ))}
        {/* Main Body — dark panel */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.8, 0.7, 0.8]} />
          <meshStandardMaterial color="#0e1626" metalness={0.5} roughness={0.35} emissive="#0b3a4a" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.82, 0.4, 0.82]} />
          <meshStandardMaterial color="#111a2b" metalness={0.6} roughness={0.25} />
        </mesh>

        {/* Cyan trim glow frame */}
        <mesh position={[0, 0.05, 0.41]}>
          <planeGeometry args={[0.62, 0.52]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>

        {/* Dark screen face */}
        <mesh position={[0, 0.05, 0.415]}>
          <planeGeometry args={[0.55, 0.45]} />
          <meshBasicMaterial color="#04121a" />
        </mesh>

        {/* Glowing cyan eyes */}
        {[-0.15, 0.15].map((x, i) => (
          <mesh key={i} position={[x, 0.05, 0.42]}>
            <boxGeometry args={[0.1, 0.04, 0.01]} />
            <meshBasicMaterial color="#a5f3fc" toneMapped={false} />
          </mesh>
        ))}

        {/* Core glow light + halo ring */}
        <pointLight color="#22d3ee" intensity={2.2} distance={14} position={[0, 0.4, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.44, 0]}>
          <ringGeometry args={[0.7, 0.85, 48]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>

        {/* Selection highlight ring */}
        {hubActive && (
          <mesh ref={hubRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
            <ringGeometry args={[1.05, 1.35, 64]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* Grid overlay for aesthetic structure */}
      <gridHelper args={[60, 60, '#1d4b60', '#12303f']} position={[0, -0.598, -6]} />
    </group>
  );
}
