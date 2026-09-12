'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnergyStore } from '../../store/useEnergyStore';

// ---------------------------------------------------------------------------
// PowerWorker ambient scene dressing.
//
// Everything here is procedural, static and non-interactive: it frames the
// existing 50-house community with a skyline, renewables and street life
// without touching the houses, roads, beams, hub or store contracts. Repeated
// props (streetlights, cars, trees, hedges, horizon towers) render through a
// single shared InstancedMesh each; geometries, materials and textures are
// memoized and disposed on unmount. During a blackout the man-made lighting
// dims while the wind-turbine tip lights (renewables) keep glowing.
// ---------------------------------------------------------------------------

interface Placement {
  pos: [number, number, number];
  rotY?: number;
  scale?: number | [number, number, number];
}

// Ambient props never intercept pointer events meant for houses/assets.
const noRaycast: THREE.Object3D['raycast'] = () => {};

// Randomised lit/unlit window grid, drawn once to an offscreen canvas and used
// as an emissiveMap so only the panes glow in the material's emissive colour.
function makeWindowGridTexture(cols: number, rows: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for procedural texture');
  }
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  const marginX = size * 0.1;
  const marginY = size * 0.08;
  const cellW = (size - marginX * 2) / cols;
  const cellH = (size - marginY * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() > 0.32;
      ctx.fillStyle = lit ? '#ffffff' : '#0b0f16';
      const x = marginX + c * cellW + cellW * 0.16;
      const y = marginY + r * cellH + cellH * 0.16;
      ctx.fillRect(x, y, cellW * 0.68, cellH * 0.68);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Shared reusable instanced renderer: one draw call for many identical props.
function InstanceCloud({
  geometry,
  material,
  items,
  castShadow = false,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      p.set(it.pos[0], it.pos[1], it.pos[2]);
      e.set(0, it.rotY ?? 0, 0);
      q.setFromEuler(e);
      if (typeof it.scale === 'number') s.setScalar(it.scale);
      else if (it.scale) s.set(it.scale[0], it.scale[1], it.scale[2]);
      else s.set(1, 1, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      raycast={noRaycast}
      dispose={null}
    />
  );
}

interface BuildingSpec {
  pos: [number, number];
  size: [number, number, number]; // width, height, depth
  tint: string;
  solar?: boolean;
  aviation?: boolean;
}

const GROUND_Y = -0.6;

export default function SceneProps() {
  const blackout = useEnergyStore((s) => s.blackout);
  const dim = blackout ? 0.15 : 1;

  // -- Landmark skyline buildings placed clear of houses (x[-22,10] z[-22,14]),
  //    roads and the side assets (solar[-32,-15], battery[28,-10], EV[0,20]). --
  const buildings: BuildingSpec[] = useMemo(
    () => [
      // Northern skyline strip (beyond the top row of houses).
      { pos: [-22, -28], size: [3, 10, 3], tint: '#38bdf8' },
      { pos: [-13, -31], size: [3.4, 13, 3.2], tint: '#22d3ee', aviation: true },
      { pos: [-2, -27], size: [4, 7, 3.6], tint: '#a78bfa', solar: true },
      { pos: [8, -30], size: [3.2, 11, 3.2], tint: '#38bdf8', solar: true },
      { pos: [18, -32], size: [3.6, 15, 3.6], tint: '#22d3ee', aviation: true },
      // Eastern depth blocks.
      { pos: [31, -22], size: [3, 9, 3], tint: '#38bdf8' },
      { pos: [32, 3], size: [3.2, 8, 3.2], tint: '#a78bfa', solar: true },
    ],
    [],
  );

  // Per-building emissive window map (crisp 1:1 grid sized to the facade).
  const buildingTex = useMemo(
    () =>
      buildings.map((b) =>
        makeWindowGridTexture(
          Math.max(2, Math.round(b.size[0] / 0.85)),
          Math.max(3, Math.round(b.size[1] / 1.05)),
        ),
      ),
    [buildings],
  );

  // Shared geometries + materials for the instanced street life & greenery.
  const assets = useMemo(() => {
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 3, 6);
    const lampGeo = new THREE.BoxGeometry(0.34, 0.14, 0.34);
    const carBodyGeo = new THREE.BoxGeometry(1.6, 0.5, 0.82);
    const carCabinGeo = new THREE.BoxGeometry(0.85, 0.38, 0.72);
    const headlightGeo = new THREE.BoxGeometry(0.12, 0.1, 0.06);
    const trunkGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.7, 6);
    const leafGeo = new THREE.IcosahedronGeometry(0.36, 0);
    const hedgeGeo = new THREE.BoxGeometry(1.6, 0.5, 0.5);
    const benchSeatGeo = new THREE.BoxGeometry(1.0, 0.08, 0.34);
    const benchBackGeo = new THREE.BoxGeometry(1.0, 0.3, 0.06);
    const horizonGeo = new THREE.BoxGeometry(1, 1, 1);

    const poleMat = new THREE.MeshStandardMaterial({ color: '#263247', metalness: 0.6, roughness: 0.4 });
    const lampWarmMat = new THREE.MeshStandardMaterial({ color: '#2a2410', emissive: '#fbbf24', emissiveIntensity: 1.6 });
    const lampCyanMat = new THREE.MeshStandardMaterial({ color: '#0d2630', emissive: '#22d3ee', emissiveIntensity: 1.4 });
    const carBodyMat = new THREE.MeshStandardMaterial({ color: '#223049', metalness: 0.7, roughness: 0.35, emissive: '#0a1420', emissiveIntensity: 0.1 });
    const carCabinMat = new THREE.MeshStandardMaterial({ color: '#0e1626', metalness: 0.5, roughness: 0.2, emissive: '#0b2233', emissiveIntensity: 0.18 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: '#dbeafe', toneMapped: false });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#0b1a1c', roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#0f3d38', emissive: '#134e4a', emissiveIntensity: 0.25, roughness: 0.85 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: '#123a30', emissive: '#0f3d38', emissiveIntensity: 0.15, roughness: 0.9 });
    const benchMat = new THREE.MeshStandardMaterial({ color: '#1b2740', metalness: 0.4, roughness: 0.6 });
    const horizonMat = new THREE.MeshStandardMaterial({ color: '#0a1120', emissive: '#141d33', emissiveIntensity: 0.18, roughness: 1 });
    const aviationMat = new THREE.MeshStandardMaterial({ color: '#2a0a10', emissive: '#fb7185', emissiveIntensity: 6 });

    const trash: Array<THREE.BufferGeometry | THREE.Material> = [
      poleGeo, lampGeo, carBodyGeo, carCabinGeo, headlightGeo, trunkGeo, leafGeo,
      hedgeGeo, benchSeatGeo, benchBackGeo, horizonGeo,
      poleMat, lampWarmMat, lampCyanMat, carBodyMat, carCabinMat, headlightMat,
      trunkMat, leafMat, hedgeMat, benchMat, horizonMat, aviationMat,
    ];

    return {
      poleGeo, lampGeo, carBodyGeo, carCabinGeo, headlightGeo, trunkGeo, leafGeo,
      hedgeGeo, benchSeatGeo, benchBackGeo, horizonGeo,
      poleMat, lampWarmMat, lampCyanMat, carBodyMat, carCabinMat, headlightMat,
      trunkMat, leafMat, hedgeMat, benchMat, horizonMat, aviationMat,
      trash,
    };
  }, []);

  // Dispose shared assets + building textures once, on unmount.
  useEffect(() => {
    const textures = buildingTex;
    const trash = assets.trash;
    return () => {
      textures.forEach((t) => t.dispose());
      trash.forEach((d) => d.dispose());
    };
  }, [assets, buildingTex]);

  // Man-made lighting responds to the blackout; renewables stay lit.
  useEffect(() => {
    assets.lampWarmMat.emissiveIntensity = 1.6 * dim;
    assets.lampCyanMat.emissiveIntensity = 1.4 * dim;
    assets.carCabinMat.emissiveIntensity = 0.18 * dim;
  }, [assets, dim]);

  // ---- Instanced placement sets --------------------------------------------
  const placements = useMemo(() => {
    // Streetlights lining the road edges (skipping the central hub).
    const lampBases: [number, number][] = [];
    for (const x of [-28, -20, -12, 12, 20, 28]) {
      lampBases.push([x, 1.7], [x, -1.7]);
    }
    for (const z of [-22, -14, 10, 16]) {
      lampBases.push([-17.7, z], [17.7, z]);
    }
    const poleItems: Placement[] = lampBases.map(([x, z]) => ({ pos: [x, GROUND_Y + 1.5, z] }));
    const lampWarmItems: Placement[] = [];
    const lampCyanItems: Placement[] = [];
    lampBases.forEach(([x, z], i) => {
      const head: Placement = { pos: [x, GROUND_Y + 3.05, z] };
      if (i % 3 === 0) lampCyanItems.push(head);
      else lampWarmItems.push(head);
    });

    // Parked / idle cars in peripheral gaps.
    const cars: Array<{ x: number; z: number; rotY: number }> = [
      { x: -26, z: 3, rotY: 0 },
      { x: -26.6, z: -2.5, rotY: 0 },
      { x: 24, z: 4, rotY: Math.PI },
      { x: 24.6, z: -3, rotY: Math.PI },
      { x: -18, z: -24.5, rotY: Math.PI / 2 },
      { x: -6, z: -24, rotY: Math.PI / 2 },
      { x: 10, z: -25, rotY: Math.PI / 2 },
      { x: -30, z: 10, rotY: 0 },
      { x: 30, z: -6, rotY: Math.PI },
      { x: -24, z: 19, rotY: 0 },
    ];
    const carBodyItems: Placement[] = cars.map((c) => ({ pos: [c.x, GROUND_Y + 0.25, c.z], rotY: c.rotY }));
    const carCabinItems: Placement[] = cars.map((c) => ({ pos: [c.x, GROUND_Y + 0.6, c.z], rotY: c.rotY }));
    const headlightItems: Placement[] = [];
    for (const c of cars) {
      const cos = Math.cos(c.rotY);
      const sin = Math.sin(c.rotY);
      for (const s of [-1, 1]) {
        const lx = 0.78;
        const lz = 0.26 * s;
        const dx = lx * cos + lz * sin;
        const dz = -lx * sin + lz * cos;
        headlightItems.push({ pos: [c.x + dx, GROUND_Y + 0.28, c.z + dz], rotY: c.rotY });
      }
    }

    // Extra greenery filling the empty margins.
    const treeBases: [number, number][] = [
      [-30, -4], [-30, -22], [30, -16], [30, 12], [-8, 17], [8, 17],
      [-14, 18], [14, 18], [-33, 0], [33, -2], [-33, -24], [33, -24],
      [-4, -24], [22, -18], [-26, -18],
    ];
    const trunkItems: Placement[] = treeBases.map(([x, z]) => ({ pos: [x, GROUND_Y + 0.35, z] }));
    const leafItems: Placement[] = treeBases.map(([x, z], i) => ({
      pos: [x, GROUND_Y + 0.85, z],
      rotY: i * 0.7,
      scale: 0.85 + (i % 3) * 0.18,
    }));

    const hedges: Placement[] = [
      { pos: [-28, GROUND_Y + 0.25, 9] },
      { pos: [-28, GROUND_Y + 0.25, 3] },
      { pos: [-24, GROUND_Y + 0.25, 6], rotY: Math.PI / 2 },
      { pos: [22, GROUND_Y + 0.25, 10] },
      { pos: [6, GROUND_Y + 0.25, 15] },
      { pos: [-6, GROUND_Y + 0.25, 15] },
    ];

    const benchBases: [number, number][] = [[-25.2, 6], [22, 6], [-6, 16], [6, 16], [12, 10]];
    const benchSeatItems: Placement[] = benchBases.map(([x, z]) => ({ pos: [x, GROUND_Y + 0.35, z] }));
    const benchBackItems: Placement[] = benchBases.map(([x, z]) => ({ pos: [x, GROUND_Y + 0.55, z - 0.14] }));

    // Distant silhouette towers forming a faint skyline ring for depth.
    const horizonItems: Placement[] = [];
    const ringCount = 20;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2;
      const radius = 44 + ((i * 7) % 5);
      const h = 6 + ((i * 37) % 13);
      const w = 1.4 + ((i * 13) % 4) * 0.4;
      horizonItems.push({
        pos: [Math.cos(a) * radius, GROUND_Y + h / 2, Math.sin(a) * radius],
        rotY: a,
        scale: [w, h, w],
      });
    }

    return {
      poleItems, lampWarmItems, lampCyanItems,
      carBodyItems, carCabinItems, headlightItems,
      trunkItems, leafItems, hedges, benchSeatItems, benchBackItems, horizonItems,
    };
  }, []);

  // Wind turbines on the south-west edge (clear of houses & the EV zone).
  const turbines: Array<[number, number]> = useMemo(() => [[-30, 26], [-22, 32], [-12, 30]], []);
  const rotorRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const rotors = rotorRefs.current;
    for (let i = 0; i < rotors.length; i++) {
      const r = rotors[i];
      if (r) r.rotation.z = t * (0.5 + i * 0.14);
    }
    // Slow-blinking aviation beacons on the tallest towers (stay lit as backup).
    assets.aviationMat.emissiveIntensity = 1.5 + (0.5 + 0.5 * Math.sin(t * 3.2)) * 7;
  });

  return (
    <group>
      {/* Landmark buildings */}
      {buildings.map((b, i) => {
        const [w, h, d] = b.size;
        return (
          <group key={`bldg-${i}`} position={[b.pos[0], GROUND_Y, b.pos[1]]}>
            <mesh position={[0, h / 2, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial
                color="#0e1626"
                roughness={0.7}
                metalness={0.35}
                emissive={b.tint}
                emissiveMap={buildingTex[i]}
                emissiveIntensity={1.1 * dim}
              />
            </mesh>
            {/* Roof cap */}
            <mesh position={[0, h + 0.11, 0]} raycast={noRaycast}>
              <boxGeometry args={[w + 0.18, 0.22, d + 0.18]} />
              <meshStandardMaterial color="#0b1322" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Rooftop solar (prosumer theme) */}
            {b.solar && (
              <mesh position={[0, h + 0.28, 0]} rotation={[-Math.PI / 6, 0, 0]} raycast={noRaycast}>
                <boxGeometry args={[w * 0.55, 0.05, d * 0.5]} />
                <meshStandardMaterial color="#08151f" metalness={0.5} roughness={0.25} emissive="#22d3ee" emissiveIntensity={0.5 * dim} />
              </mesh>
            )}
            {/* Aviation beacon */}
            {b.aviation && (
              <mesh position={[0, h + 0.4, 0]} raycast={noRaycast} material={assets.aviationMat}>
                <sphereGeometry args={[0.13, 10, 10]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Community Center */}
      <group position={[-28, GROUND_Y, 6]}>
        <mesh position={[0, 2, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[6, 4, 5]} />
          <meshStandardMaterial color="#0e1a24" metalness={0.4} roughness={0.5} emissive="#34d399" emissiveIntensity={0.25 * dim} />
        </mesh>
        {/* Glass frontage */}
        <mesh position={[0, 1.4, 2.53]} raycast={noRaycast}>
          <planeGeometry args={[5.2, 2.2]} />
          <meshStandardMaterial color="#04121a" emissive="#38bdf8" emissiveIntensity={0.6 * dim} metalness={0.2} roughness={0.1} />
        </mesh>
        {/* Green sign bar */}
        <mesh position={[0, 4.25, 2.4]} raycast={noRaycast}>
          <boxGeometry args={[4, 0.3, 0.16]} />
          <meshStandardMaterial color="#0a2a1e" emissive="#34d399" emissiveIntensity={1.4 * dim} />
        </mesh>
        <pointLight position={[0, 3, 4]} color="#34d399" intensity={dim * 1.1} distance={12} />
      </group>

      {/* DISCOM substation with amber warning beacon */}
      <group position={[26, GROUND_Y, 12]}>
        <mesh position={[0, 0.9, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[3, 1.8, 3]} />
          <meshStandardMaterial color="#161f30" metalness={0.5} roughness={0.5} emissive="#3a2a08" emissiveIntensity={0.18 * dim} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 1.95, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.34, 0.34, 0.9, 10]} />
            <meshStandardMaterial color="#243149" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        {/* Warning beacon (backup-lit even during outage) */}
        <mesh position={[0, 2.65, 0]} raycast={noRaycast}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshStandardMaterial color="#3a2a00" emissive="#fbbf24" emissiveIntensity={3.2} />
        </mesh>
        <pointLight position={[0, 2.9, 0]} color="#fbbf24" intensity={0.9} distance={8} />
      </group>

      {/* Wind turbines with rotating blades + cyan tip lights */}
      {turbines.map(([x, z], i) => (
        <group key={`turbine-${i}`} position={[x, GROUND_Y, z]}>
          <mesh position={[0, 4.5, 0]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.18, 0.32, 9, 10]} />
            <meshStandardMaterial color="#1b2740" metalness={0.6} roughness={0.35} emissive="#0b2233" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 9, -0.1]} raycast={noRaycast}>
            <boxGeometry args={[0.5, 0.5, 1.1]} />
            <meshStandardMaterial color="#223049" metalness={0.6} roughness={0.3} />
          </mesh>
          <group
            ref={(el) => {
              rotorRefs.current[i] = el;
            }}
            position={[0, 9, 0.6]}
          >
            <mesh raycast={noRaycast}>
              <sphereGeometry args={[0.18, 10, 10]} />
              <meshStandardMaterial color="#2a3a55" metalness={0.7} roughness={0.25} />
            </mesh>
            {[0, 1, 2].map((b) => (
              <group key={b} rotation={[0, 0, (b * Math.PI * 2) / 3]}>
                <mesh position={[0, 1.6, 0]} raycast={noRaycast}>
                  <boxGeometry args={[0.14, 3.2, 0.05]} />
                  <meshStandardMaterial color="#dce7ff" metalness={0.3} roughness={0.45} emissive="#1a2a3a" emissiveIntensity={0.15} />
                </mesh>
                <mesh position={[0, 3.2, 0]} raycast={noRaycast}>
                  <sphereGeometry args={[0.07, 8, 8]} />
                  <meshBasicMaterial color="#22d3ee" toneMapped={false} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      ))}

      {/* Streetlights */}
      <InstanceCloud geometry={assets.poleGeo} material={assets.poleMat} items={placements.poleItems} />
      <InstanceCloud geometry={assets.lampGeo} material={assets.lampWarmMat} items={placements.lampWarmItems} />
      <InstanceCloud geometry={assets.lampGeo} material={assets.lampCyanMat} items={placements.lampCyanItems} />

      {/* Parked cars */}
      <InstanceCloud geometry={assets.carBodyGeo} material={assets.carBodyMat} items={placements.carBodyItems} castShadow />
      <InstanceCloud geometry={assets.carCabinGeo} material={assets.carCabinMat} items={placements.carCabinItems} />
      <InstanceCloud geometry={assets.headlightGeo} material={assets.headlightMat} items={placements.headlightItems} />

      {/* Extra greenery */}
      <InstanceCloud geometry={assets.trunkGeo} material={assets.trunkMat} items={placements.trunkItems} />
      <InstanceCloud geometry={assets.leafGeo} material={assets.leafMat} items={placements.leafItems} />
      <InstanceCloud geometry={assets.hedgeGeo} material={assets.hedgeMat} items={placements.hedges} />

      {/* Benches */}
      <InstanceCloud geometry={assets.benchSeatGeo} material={assets.benchMat} items={placements.benchSeatItems} />
      <InstanceCloud geometry={assets.benchBackGeo} material={assets.benchMat} items={placements.benchBackItems} />

      {/* Distant skyline ring for depth */}
      <InstanceCloud geometry={assets.horizonGeo} material={assets.horizonMat} items={placements.horizonItems} />
    </group>
  );
}
