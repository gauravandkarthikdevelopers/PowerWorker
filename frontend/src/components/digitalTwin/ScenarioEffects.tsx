'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEnergyStore } from '../../store/useEnergyStore';
import * as THREE from 'three';

// Cinematic light tints for the blackout / self-heal sequence.
const WHITE = new THREE.Color('#ffffff');
const ISLAND_TINT = new THREE.Color('#5eead4');   // calm cyan-green self-powered glow
const BLACKOUT_TINT = new THREE.Color('#334155'); // cold desaturated dark

export default function ScenarioEffects() {
  const activeScenario = useEnergyStore((s) => s.activeScenario);
  const blackout = useEnergyStore((s) => s.blackout);
  const islandMode = useEnergyStore((s) => s.islandMode);
  const { scene } = useThree();
  
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const emergencyLightRef = useRef<THREE.PointLight>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const shockMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const islandGlowRef = useRef<THREE.PointLight>(null);

  // Initialize scene properties once on mount to avoid WebGL lost context / rendering race conditions
  useEffect(() => {
    scene.background = new THREE.Color('#060a14');
    scene.fog = new THREE.FogExp2('#070d18', 0.0055);
  }, [scene]);

  // Memoize scenario targets
  const SCENARIO_CONFIG = useMemo(() => ({
    normal: {
      background: new THREE.Color('#060a14'),   // deep energy-HUD base
      fogColor:   new THREE.Color('#0a1220'),
      fogDensity: 0.006,
      ambientIntensity: 0.6,
      sunColor:   new THREE.Color('#dce8ff'),   // cool cinematic key light
      sunIntensity: 1.15,
    },
    cloudCover: {
      background: new THREE.Color('#0a1018'),
      fogColor:   new THREE.Color('#0e1420'),
      fogDensity: 0.02,
      ambientIntensity: 0.45,
      sunColor:   new THREE.Color('#8fa4c4'),
      sunIntensity: 0.5,
    },
    heatwave: {
      background: new THREE.Color('#140d08'),   // warm dark amber haze
      fogColor:   new THREE.Color('#1a1008'),
      fogDensity: 0.008,
      ambientIntensity: 0.7,
      sunColor:   new THREE.Color('#ff9a4d'),
      sunIntensity: 1.45,
    },
    gridFailure: {
      background: new THREE.Color('#0a0608'),   // cold red-tinged dark
      fogColor:   new THREE.Color('#0e070a'),
      fogDensity: 0.02,
      ambientIntensity: 0.35,
      sunColor:   new THREE.Color('#ff8080'),
      sunIntensity: 0.4,
    },
    evSurge: {
      background: new THREE.Color('#0a0a16'),   // violet-tinged dark
      fogColor:   new THREE.Color('#0e0e1c'),
      fogDensity: 0.007,
      ambientIntensity: 0.6,
      sunColor:   new THREE.Color('#c9b6ff'),
      sunIntensity: 1.0,
    },
  }), []);

  const gridHealthy = activeScenario !== 'gridFailure';
  const substationColor = gridHealthy ? '#34d399' : '#fb7185';

  // Smooth lerping of lighting and fog properties in rendering loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const target = SCENARIO_CONFIG[activeScenario] || SCENARIO_CONFIG.normal;

    // Blackout / self-heal overrides the scenario light targets.
    let ambientTarget = target.ambientIntensity;
    let sunTarget = target.sunIntensity;
    let tint = WHITE;
    if (blackout && !islandMode) {
      // Scene plunges dark with an irregular electrical flicker.
      const flicker = Math.sin(time * 24) > 0.6 ? 0.22 : 0;
      ambientTarget = 0.12 + flicker;
      sunTarget = 0.04 + flicker * 0.5;
      tint = BLACKOUT_TINT;
    } else if (islandMode) {
      // Community self-powered: partial, calmer restore with a green/cyan tint.
      ambientTarget = 0.72;
      sunTarget = 0.34;
      tint = ISLAND_TINT;
    }

    // 1. Lerp ambient light intensity + cinematic tint
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, ambientTarget, 0.06);
      ambientRef.current.color.lerp(tint, 0.04);
    }

    // 2. Lerp sun light properties
    if (sunRef.current) {
      sunRef.current.intensity = THREE.MathUtils.lerp(sunRef.current.intensity, sunTarget, 0.06);
      sunRef.current.color.lerp(blackout || islandMode ? tint : target.sunColor, 0.04);
    }

    // 3. Lerp scene background color directly on the attached instance
    if (scene.background && scene.background instanceof THREE.Color) {
      scene.background.lerp(target.background, 0.03);
    }

    // 4. Lerp scene fog properties directly on the attached instance
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(target.fogColor, 0.03);
      scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, target.fogDensity, 0.03);
    }

    // 5. Emergency light flash rotation when grid failure active
    if (emergencyLightRef.current) {
      if (activeScenario === 'gridFailure') {
        emergencyLightRef.current.intensity = (Math.sin(time * 6) * 0.4 + 0.6) * 3.0;
        emergencyLightRef.current.position.x = Math.sin(time * 3) * 3;
        emergencyLightRef.current.position.z = -26 + Math.cos(time * 3) * 3;
      } else {
        emergencyLightRef.current.intensity = 0;
      }
    }

    // 6. Expanding red shockwave ring on the ground while the grid is down.
    if (shockRef.current && shockMatRef.current) {
      const active = blackout && !islandMode;
      shockRef.current.visible = active;
      if (active) {
        const cycle = (time % 2) / 2; // 0..1 loop every 2s
        const s = 1 + cycle * 20;
        shockRef.current.scale.set(s, s, s);
        shockMatRef.current.opacity = (1 - cycle) * 0.55;
      }
    }

    // 7. Calm green/cyan self-powered glow when the community islands.
    if (islandGlowRef.current) {
      islandGlowRef.current.intensity = THREE.MathUtils.lerp(
        islandGlowRef.current.intensity, islandMode ? 2.4 : 0, 0.05,
      );
    }
  });

  return (
    <group>
      {/* High-key ambient and sun lights */}
      <ambientLight ref={ambientRef} color="#ffffff" intensity={0.6} />
      <directionalLight
        ref={sunRef}
        castShadow
        position={[20, 35, 20]}
        color="#dce8ff"
        intensity={1.0}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />

      {/* Physical Substation Mesh (Grid Connector Hub) */}
      <group position={[0, 0, -26]}>
        {/* Gravel base */}
        <mesh receiveShadow position={[0, -0.6, 0]}>
          <boxGeometry args={[6, 0.1, 5]} />
          <meshStandardMaterial color="#0b1322" roughness={0.9} metalness={0.2} />
        </mesh>

        {/* Substation transformer unit box */}
        <mesh castShadow position={[0, 0.4, 0]}>
          <boxGeometry args={[1.8, 1.2, 1.8]} />
          <meshStandardMaterial color="#212121" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Dynamic Health Status Indicator Light */}
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color={substationColor} />
        </mesh>

        {/* Substation cooling coils */}
        <mesh position={[1.0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.2, 0.8, 1.4]} />
          <meshStandardMaterial color="#212121" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[-1.0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.2, 0.8, 1.4]} />
          <meshStandardMaterial color="#212121" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* Substation Power Transmission Poles */}
        <group position={[0, 0.6, -1.8]}>
          <mesh castShadow position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.14, 3.0]} />
            <meshStandardMaterial color="#212121" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 2.5, 0]}>
            <boxGeometry args={[2.5, 0.08, 0.08]} />
            <meshStandardMaterial color="#212121" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 1.8, 0]}>
            <boxGeometry args={[2.0, 0.08, 0.08]} />
            <meshStandardMaterial color="#212121" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Emergency flashing red light on grid failure */}
      <pointLight
        ref={emergencyLightRef}
        color="#DC2626"
        intensity={0}
        distance={25}
        position={[0, 1.5, -26]}
      />

      {/* Expanding red shockwave ring emitted from origin during blackout */}
      <mesh ref={shockRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} visible={false}>
        <ringGeometry args={[0.8, 1.15, 64]} />
        <meshBasicMaterial
          ref={shockMatRef}
          color="#fb7185"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Calm self-powered glow when islanding */}
      <pointLight ref={islandGlowRef} color="#5eead4" intensity={0} distance={70} position={[0, 6, 0]} />
    </group>
  );
}
