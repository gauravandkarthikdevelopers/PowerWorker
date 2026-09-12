'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import CommunityGrid from './CommunityGrid';
import SceneProps from './SceneProps';
import WorldMotion from './WorldMotion';
import TradePopups from './TradePopups';
import CameraDirector from './CameraDirector';
import SolarFarm from './SolarFarm';
import Battery from './Battery';
import EVZone from './EVZone';
import EnergyFlow from './EnergyFlow';
import EnergyBeams from './EnergyBeams';
import ScenarioEffects from './ScenarioEffects';
import AgentOverlay from './AgentOverlay';
import EnergySliders from '../dashboard/EnergySliders';
import { useEnergyStore } from '../../store/useEnergyStore';
export default function CommunityScene() {
  const blackout = useEnergyStore((s) => s.blackout);
  const stressActive = useEnergyStore((s) => s.stressActive);
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '500px',
      background: blackout ? '#02040a' : '#060a14',
      overflow: 'hidden',
    }}>
      {!stressActive && (
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: '10',
        pointerEvents: 'none',
      }}>
        <EnergySliders />
      </div>
      )}

      {/* R3F Canvas */}
      <Canvas
        shadows
        camera={{ position: [-28, 19, 30], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Floating Agent Messages Panel (Anchored to world space coordinates) */}
        <AgentOverlay />

        {/* Dynamic environmental weather effects & lights */}
        <ScenarioEffects />

        {/* 50 House Community Grid Layout */}
        <CommunityGrid />

        {/* Ambient skyline, renewables & street life framing the community */}
        <SceneProps />

        {/* Solar Farm panel array */}
        <SolarFarm />

        {/* Cylinder battery storage */}
        <Battery />

        {/* EV Parking bays */}
        <EVZone />

        {/* Animated particle flows */}
        <EnergyFlow />

        {/* Cinematic P2P trade beams, price tags & node rings */}
        <EnergyBeams />

        {/* Ambient motion: driving cars, drones, hub holo-rings, outage weather */}
        <WorldMotion />

        {/* Floating ₹ savings popups from selling houses */}
        <TradePopups />

        {/* Cinematic auto-camera during the stress simulation */}
        <CameraDirector />

        {/* Camera interaction controls */}
        {!stressActive && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={10}
            maxDistance={65}
            target={[0, 0, 0]}
          />
        )}
      </Canvas>

      {/* Floating Camera Help Tip Overlay - Neo-Brutalist Reskinned */}
      {!stressActive && (
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        pointerEvents: 'none',
        background: 'rgba(6,10,20,0.78)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(56,189,248,0.22)',
        padding: '6px 12px',
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '9px',
        fontWeight: 'bold',
        color: '#8091ab',
        borderRadius: '8px',
        letterSpacing: '0.05em',
        boxShadow: '0 0 20px rgba(0,0,0,0.4)',
      }}>
        DRAG TO ROTATE • PINCH TO ZOOM • RIGHT-CLICK DRAG TO PAN
      </div>
      )}
    </div>
  );
}
