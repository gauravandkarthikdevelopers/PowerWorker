'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnergyStore } from '../../store/useEnergyStore';

// Per-phase cinematic camera keyframes (position + look-at target) with an
// optional slow orbit speed. Drives the camera automatically during the
// Stress Simulation so the demo films itself.
interface Shot {
  pos: [number, number, number];
  tgt: [number, number, number];
  orbit: number;
}

const SHOTS: Record<string, Shot> = {
  NOMINAL:       { pos: [-30, 24, 34], tgt: [0, 0, 0], orbit: 0.05 },
  'PEAK DEMAND': { pos: [-16, 13, 22], tgt: [-4, 1, -2], orbit: 0.03 },
  FORESIGHT:     { pos: [12, 11, 18], tgt: [0, 1, 0], orbit: 0.02 },
  OUTAGE:        { pos: [3, 5, 12], tgt: [0, 1, 0], orbit: 0 },
  'SELF-HEAL':   { pos: [-9, 9, 16], tgt: [0, 2, 0], orbit: 0.035 },
  RECOVERED:     { pos: [-20, 16, 26], tgt: [0, 1, 0], orbit: 0.05 },
  IMPACT:        { pos: [-28, 26, 34], tgt: [0, 0, 0], orbit: 0.07 },
};

export default function CameraDirector() {
  const stressActive = useEnergyStore((s) => s.stressActive);
  const stressPhase = useEnergyStore((s) => s.stressPhase);
  const { camera } = useThree();

  const clock = useRef(0);
  const desiredPos = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    if (!stressActive) {
      clock.current = 0;
      return;
    }
    clock.current += delta;
    const shot = SHOTS[stressPhase.toUpperCase()] ?? SHOTS.NOMINAL;
    const [x, y, z] = shot.pos;
    const ang = clock.current * shot.orbit;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    desiredPos.current.set(x * cos - z * sin, y, x * sin + z * cos);
    camera.position.lerp(desiredPos.current, Math.min(1, delta * 1.4));
    target.current.lerp(new THREE.Vector3(shot.tgt[0], shot.tgt[1], shot.tgt[2]), Math.min(1, delta * 2));
    camera.lookAt(target.current);
  });

  return null;
}
