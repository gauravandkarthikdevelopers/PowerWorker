'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnergyStore } from '../../store/useEnergyStore';

// ---------------------------------------------------------------------------
// PowerWorker ambient motion + outage weather.
//
// Everything here is procedural and non-interactive. It layers living motion
// over the existing static scene: traffic driving the road grid, agent scout
// drones circling overhead, holographic rings pulsing around the central agent
// hub, and — only during a grid outage — procedural rain and lightning (or a
// calm cyan/green island glow when the community islands off-grid). Repeated
// props render through shared/instanced geometry, every material and geometry
// is disposed on unmount, and no mesh intercepts pointer events so the houses
// and assets underneath stay clickable.
// ---------------------------------------------------------------------------

// Never intercept pointer events meant for houses/assets.
const noRaycast: THREE.Object3D['raycast'] = () => {};

// Palette (energy-HUD).
const CYAN = '#22d3ee';
const GREEN = '#34d399';
const AMBER = '#fbbf24';
const VIOLET = '#a78bfa';
const BLUE = '#38bdf8';

// Per-frame scratch; useFrame callbacks run sequentially so sharing is safe.
const SCRATCH_M = new THREE.Matrix4();
const SCRATCH_P = new THREE.Vector3();
const SCRATCH_S = new THREE.Vector3(1, 1, 1);
const IDENTITY_Q = new THREE.Quaternion();

const CAR_Y = -0.3; // road surface ~ -0.55; car body centre sits just above it

// Road centrelines cars follow (see scene geometry facts).
const CAR_LANES: Array<{ a: [number, number]; b: [number, number] }> = [
  { a: [-24, 0], b: [24, 0] }, // horizontal main road (z = 0)
  { a: [0, -26], b: [0, 14] }, // vertical road x = 0
  { a: [16, -26], b: [16, 14] }, // vertical road x = 16
  { a: [-16, -26], b: [-16, 14] }, // vertical road x = -16
];

interface CarDef {
  lane: number;
  reverse: boolean;
  lateral: number; // sideways offset from centreline -> two-way traffic
  speed: number; // units / second
  phase: number; // 0..1 start position along the lane
  color: string; // headlight tint
}

const CAR_DEFS: CarDef[] = [
  { lane: 0, reverse: false, lateral: -0.85, speed: 6.0, phase: 0.0, color: CYAN },
  { lane: 0, reverse: true, lateral: 0.85, speed: 5.0, phase: 0.5, color: AMBER },
  { lane: 0, reverse: false, lateral: -0.85, speed: 4.2, phase: 0.78, color: BLUE },
  { lane: 1, reverse: false, lateral: -0.85, speed: 5.5, phase: 0.2, color: GREEN },
  { lane: 1, reverse: true, lateral: 0.85, speed: 4.6, phase: 0.66, color: VIOLET },
  { lane: 2, reverse: false, lateral: -0.85, speed: 6.4, phase: 0.35, color: BLUE },
  { lane: 3, reverse: true, lateral: 0.85, speed: 5.1, phase: 0.15, color: CYAN },
];

interface CarState {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  length: number;
  perpX: number;
  perpZ: number;
  lateral: number;
  speed: number;
  phase: number;
  quat: THREE.Quaternion;
  hl: Array<[number, number]>; // headlight world-space xz offsets from car centre
}

function Cars() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  const cars = useMemo<CarState[]>(() => {
    return CAR_DEFS.map((def) => {
      const lane = CAR_LANES[def.lane];
      const ax = lane.a[0];
      const az = lane.a[1];
      const bx = lane.b[0];
      const bz = lane.b[1];
      const length = Math.hypot(bx - ax, bz - az);
      // Base direction a -> b (used for a stable lane perpendicular).
      const baseDx = (bx - ax) / length;
      const baseDz = (bz - az) / length;
      const dx = def.reverse ? -baseDx : baseDx;
      const dz = def.reverse ? -baseDz : baseDz;
      const ox = def.reverse ? bx : ax;
      const oz = def.reverse ? bz : az;
      // Lane perpendicular (rotate base dir 90deg) so forward/reverse cars sit
      // on physically opposite sides regardless of travel direction.
      const perpX = -baseDz;
      const perpZ = baseDx;
      // Yaw so the car's long (+x local) axis points along travel direction.
      const yaw = Math.atan2(-dz, dx);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      // Two headlights at the front, offset along travel dir + travel perp.
      const tPerpX = -dz;
      const tPerpZ = dx;
      const hl: Array<[number, number]> = [-1, 1].map((s) => [
        dx * 0.82 + tPerpX * 0.26 * s,
        dz * 0.82 + tPerpZ * 0.26 * s,
      ]);
      return { ox, oz, dx, dz, length, perpX, perpZ, lateral: def.lateral, speed: def.speed, phase: def.phase, quat, hl };
    });
  }, []);

  const bodyGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.46, 0.82), []);
  const headGeo = useMemo(() => new THREE.BoxGeometry(0.14, 0.1, 0.09), []);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#18233a', metalness: 0.7, roughness: 0.35, emissive: '#0a1420', emissiveIntensity: 0.15 }),
    [],
  );
  const headMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);

  useEffect(() => {
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [bodyGeo, headGeo, bodyMat, headMat];
    return () => disposables.forEach((d) => d.dispose());
  }, [bodyGeo, headGeo, bodyMat, headMat]);

  // One-time: dynamic matrix usage + per-car headlight tints.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (body) body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (head) {
      head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const color = new THREE.Color();
      cars.forEach((_, i) => {
        color.set(CAR_DEFS[i].color);
        head.setColorAt(i * 2, color);
        head.setColorAt(i * 2 + 1, color);
      });
      if (head.instanceColor) head.instanceColor.needsUpdate = true;
    }
  }, [cars]);

  useFrame((state) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const t = (c.phase + (time * c.speed) / c.length) % 1;
      const dist = t * c.length;
      const cx = c.ox + c.dx * dist + c.perpX * c.lateral;
      const cz = c.oz + c.dz * dist + c.perpZ * c.lateral;
      SCRATCH_P.set(cx, CAR_Y, cz);
      SCRATCH_M.compose(SCRATCH_P, c.quat, SCRATCH_S);
      body.setMatrixAt(i, SCRATCH_M);
      for (let h = 0; h < 2; h++) {
        SCRATCH_P.set(cx + c.hl[h][0], CAR_Y + 0.05, cz + c.hl[h][1]);
        SCRATCH_M.compose(SCRATCH_P, c.quat, SCRATCH_S);
        head.setMatrixAt(i * 2 + h, SCRATCH_M);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, cars.length]} raycast={noRaycast} dispose={null} castShadow />
      <instancedMesh ref={headRef} args={[headGeo, headMat, cars.length * 2]} raycast={noRaycast} dispose={null} />
    </group>
  );
}

interface DroneDef {
  radius: number;
  speed: number;
  base: number; // orbit height
  bob: number; // vertical bob amplitude
  phase: number;
}

const DRONE_DEFS: DroneDef[] = [
  { radius: 10, speed: 0.32, base: 9, bob: 1.1, phase: 0 },
  { radius: 14, speed: -0.24, base: 11, bob: 0.8, phase: 2.1 },
  { radius: 12, speed: 0.28, base: 10, bob: 1.3, phase: 4.2 },
];

const BEAM_HEIGHT = 8;

function Drones() {
  const groupRefs = useRef<Array<THREE.Group | null>>([]);

  const chassisGeo = useMemo(() => new THREE.BoxGeometry(0.55, 0.09, 0.55), []);
  const orbGeo = useMemo(() => new THREE.IcosahedronGeometry(0.16, 0), []);
  const beamGeo = useMemo(() => new THREE.ConeGeometry(0.55, BEAM_HEIGHT, 14, 1, true), []);
  const chassisMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0e1626', metalness: 0.6, roughness: 0.4, emissive: '#0b2233', emissiveIntensity: 0.4 }),
    [],
  );
  // Shared blinking orb + beam materials so all scout drones pulse in unison.
  const orbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#062028', emissive: new THREE.Color(CYAN), emissiveIntensity: 2.5, toneMapped: false }), []);
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [chassisGeo, orbGeo, beamGeo, chassisMat, orbMat, beamMat];
    return () => disposables.forEach((d) => d.dispose());
  }, [chassisGeo, orbGeo, beamGeo, chassisMat, orbMat, beamMat]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < DRONE_DEFS.length; i++) {
      const d = DRONE_DEFS[i];
      const g = groupRefs.current[i];
      if (!g) continue;
      const angle = time * d.speed + d.phase;
      g.position.set(Math.cos(angle) * d.radius, d.base + Math.sin(time * 0.6 + d.phase) * d.bob, Math.sin(angle) * d.radius);
      g.rotation.y = angle;
    }
    // Blinking cyan pulse shared across the scout drones.
    const blink = 0.35 + 0.65 * Math.abs(Math.sin(time * 3.4));
    orbMat.emissiveIntensity = 1.5 + blink * 3.5;
    beamMat.opacity = 0.05 + blink * 0.09;
  });

  return (
    <group>
      {DRONE_DEFS.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <mesh geometry={chassisGeo} material={chassisMat} raycast={noRaycast} />
          <mesh geometry={orbGeo} material={orbMat} position={[0, -0.1, 0]} raycast={noRaycast} />
          {/* Faint downward scout beam (apex at drone, widening to ground). */}
          <mesh geometry={beamGeo} material={beamMat} position={[0, -BEAM_HEIGHT / 2, 0]} raycast={noRaycast} />
        </group>
      ))}
    </group>
  );
}

interface RingDef {
  radius: number;
  tilt: number;
  speed: number;
  color: string;
}

const HUB_RINGS: RingDef[] = [
  { radius: 2.6, tilt: 1.2, speed: 0.5, color: CYAN },
  { radius: 3.15, tilt: 1.45, speed: -0.34, color: VIOLET },
  { radius: 3.7, tilt: 0.9, speed: 0.66, color: BLUE },
];

function HubRings() {
  const ringRefs = useRef<Array<THREE.Group | null>>([]);
  const pulseRef = useRef<THREE.Mesh>(null);
  const pulseMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const ringGeos = useMemo(() => HUB_RINGS.map((r) => new THREE.TorusGeometry(r.radius, 0.045, 8, 72)), []);
  const ringMats = useMemo(
    () =>
      HUB_RINGS.map(
        (r) =>
          new THREE.MeshBasicMaterial({
            color: r.color,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [],
  );
  const pulseGeo = useMemo(() => new THREE.RingGeometry(2.3, 2.62, 64), []);

  useEffect(() => {
    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [...ringGeos, ...ringMats, pulseGeo];
    return () => disposables.forEach((d) => d.dispose());
  }, [ringGeos, ringMats, pulseGeo]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    for (let i = 0; i < HUB_RINGS.length; i++) {
      const g = ringRefs.current[i];
      if (g) g.rotation.y = time * HUB_RINGS[i].speed;
    }
    // Rising ring pulse: expands + climbs + fades on a loop.
    const p = (time * 0.4) % 1;
    if (pulseRef.current) {
      pulseRef.current.position.y = 0.2 + p * 4.2;
      const s = 0.6 + p * 1.6;
      pulseRef.current.scale.set(s, s, s);
    }
    if (pulseMatRef.current) pulseMatRef.current.opacity = (1 - p) * 0.6;
  });

  return (
    <group>
      {HUB_RINGS.map((r, i) => (
        <group
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
        >
          <mesh geometry={ringGeos[i]} material={ringMats[i]} rotation={[r.tilt, 0, 0]} raycast={noRaycast} />
        </group>
      ))}
      <mesh ref={pulseRef} geometry={pulseGeo} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <meshBasicMaterial
          ref={pulseMatRef}
          color={CYAN}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const RAIN_COUNT = 440;
const RAIN_TOP = 15;
const RAIN_FLOOR = -0.5;

function Rain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(0.02, 0.7, 0.02), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#7db4dc', transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }),
    [],
  );

  const drops = useMemo(() => {
    const xs = new Float32Array(RAIN_COUNT);
    const zs = new Float32Array(RAIN_COUNT);
    const ys = new Float32Array(RAIN_COUNT);
    const spd = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      xs[i] = -30 + Math.random() * 60;
      zs[i] = -28 + Math.random() * 46;
      ys[i] = RAIN_FLOOR + Math.random() * (RAIN_TOP - RAIN_FLOOR);
      spd[i] = 14 + Math.random() * 10;
    }
    return { xs, zs, ys, spd };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const step = Math.min(delta, 0.05);
    for (let i = 0; i < RAIN_COUNT; i++) {
      drops.ys[i] -= drops.spd[i] * step;
      if (drops.ys[i] < RAIN_FLOOR) drops.ys[i] = RAIN_TOP + Math.random() * 3;
      SCRATCH_P.set(drops.xs[i], drops.ys[i], drops.zs[i]);
      SCRATCH_M.compose(SCRATCH_P, IDENTITY_Q, SCRATCH_S);
      mesh.setMatrixAt(i, SCRATCH_M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geo, mat, RAIN_COUNT]} raycast={noRaycast} dispose={null} />;
}

const BOLT_POINTS = 11;

// Candidate strike bases (grid / substation area and near the central hub).
const BOLT_BASES: Array<[number, number]> = [
  [26, 12],
  [28, -4],
  [0, 0],
  [12, -6],
];

function Lightning() {
  const nextRef = useRef(1);
  const endRef = useRef(0);

  const bolt = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(BOLT_POINTS * 3);
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);
    const material = new THREE.LineBasicMaterial({ color: '#dbeafe', transparent: true, opacity: 0.95, toneMapped: false });
    const line = new THREE.Line(geometry, material);
    line.raycast = noRaycast;
    line.visible = false;
    line.frustumCulled = false;
    return { line, geometry, material, positions };
  }, []);

  const flashRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    return () => {
      bolt.geometry.dispose();
      bolt.material.dispose();
    };
  }, [bolt]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (time > nextRef.current) {
      // New strike: build a fresh jagged bolt from sky to a grid base.
      const base = BOLT_BASES[Math.floor(Math.random() * BOLT_BASES.length)];
      const topX = base[0] + (Math.random() - 0.5) * 4;
      const topZ = base[1] + (Math.random() - 0.5) * 4;
      for (let i = 0; i < BOLT_POINTS; i++) {
        const f = i / (BOLT_POINTS - 1);
        const y = 16 - f * 16.4;
        const jitter = (1 - f) * 2.2;
        bolt.positions[i * 3] = THREE.MathUtils.lerp(topX, base[0], f) + (Math.random() - 0.5) * jitter;
        bolt.positions[i * 3 + 1] = y;
        bolt.positions[i * 3 + 2] = THREE.MathUtils.lerp(topZ, base[1], f) + (Math.random() - 0.5) * jitter;
      }
      const posAttr = bolt.geometry.getAttribute('position') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      if (flashRef.current) flashRef.current.position.set(base[0], 6, base[1]);
      endRef.current = time + 0.16;
      nextRef.current = time + 2 + Math.random() * 4;
    }
    const active = time < endRef.current;
    bolt.line.visible = active;
    // Flicker the bolt + flash while the strike is live.
    const flick = active ? 0.5 + 0.5 * Math.sin(time * 90) : 0;
    bolt.material.opacity = active ? 0.6 + flick * 0.4 : 0;
    if (flashRef.current) flashRef.current.intensity = active ? 4 + flick * 8 : 0;
  });

  return (
    <group>
      <primitive object={bolt.line} />
      <pointLight ref={flashRef} color="#cfe4ff" intensity={0} distance={40} decay={1.2} />
    </group>
  );
}

function IslandGlow() {
  const geo = useMemo(() => new THREE.CircleGeometry(22, 72), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#2fe0bf',
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((state) => {
    mat.opacity = 0.06 + (0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * 1.1)) * 0.07;
  });

  return <mesh geometry={geo} material={mat} position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast} />;
}

export default function WorldMotion() {
  const blackout = useEnergyStore((s) => s.blackout);
  const islandMode = useEnergyStore((s) => s.islandMode);
  const stormy = blackout && !islandMode;

  return (
    <group>
      <Cars />
      <Drones />
      <HubRings />
      {stormy && <Rain />}
      {stormy && <Lightning />}
      {islandMode && <IslandGlow />}
    </group>
  );
}
