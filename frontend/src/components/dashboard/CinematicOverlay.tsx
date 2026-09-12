'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useEnergyStore } from '../../store/useEnergyStore';

const T = {
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#fb7185',
  violet: '#a78bfa',
  blue: '#38bdf8',
  text: '#e7f1ff',
  textDim: '#8091ab',
  mono: 'var(--font-geist-mono)',
  sans: 'var(--font-geist-sans)',
};

interface Flash {
  text: string;
  color: string;
}

const FLASH: Record<string, Flash> = {
  'PEAK DEMAND': { text: '⚡ PEAK DEMAND SURGE', color: T.amber },
  FORESIGHT: { text: '⚠ GRID FAILURE PREDICTED', color: T.violet },
  OUTAGE: { text: '🚨 GRID DOWN', color: T.red },
  'SELF-HEAL': { text: '🛡 ISLAND MODE ENGAGED', color: T.cyan },
  RECOVERED: { text: '✅ GRID RESTORED', color: T.green },
  IMPACT: { text: '📊 MISSION IMPACT', color: T.green },
};

// --- Synth SFX (Web Audio, no assets) ---
const playTone = (ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, peak: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
};

const PHASE_SFX: Record<string, (ctx: AudioContext) => void> = {
  'PEAK DEMAND': (ctx) => { playTone(ctx, 440, 0, 0.18, 'sawtooth', 0.12); playTone(ctx, 660, 0.12, 0.2, 'sawtooth', 0.1); },
  FORESIGHT: (ctx) => { playTone(ctx, 520, 0, 0.15, 'triangle', 0.12); playTone(ctx, 520, 0.22, 0.15, 'triangle', 0.12); },
  OUTAGE: (ctx) => { playTone(ctx, 180, 0, 0.5, 'square', 0.16); playTone(ctx, 120, 0.05, 0.6, 'sawtooth', 0.12); },
  'SELF-HEAL': (ctx) => { playTone(ctx, 330, 0, 0.2, 'sine', 0.12); playTone(ctx, 440, 0.16, 0.2, 'sine', 0.12); playTone(ctx, 660, 0.32, 0.3, 'sine', 0.12); },
  RECOVERED: (ctx) => { playTone(ctx, 523, 0, 0.18, 'sine', 0.13); playTone(ctx, 784, 0.16, 0.28, 'sine', 0.13); },
  IMPACT: (ctx) => { playTone(ctx, 659, 0, 0.16, 'sine', 0.13); playTone(ctx, 988, 0.15, 0.16, 'sine', 0.13); playTone(ctx, 1319, 0.3, 0.4, 'sine', 0.13); },
};

export default function CinematicOverlay() {
  const stressActive = useEnergyStore((s) => s.stressActive);
  const stressPhase = useEnergyStore((s) => s.stressPhase);

  const [flash, setFlash] = useState<{ text: string; color: string; key: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Timecode while the simulation runs
  useEffect(() => {
    if (!stressActive) { setSeconds(0); return; }
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [stressActive]);

  // Phase-change flash + SFX
  useEffect(() => {
    const key = stressPhase.toUpperCase();
    const f = FLASH[key];
    if (stressActive && f) {
      setFlash({ text: f.text, color: f.color, key: Date.now() });
      const clear = window.setTimeout(() => setFlash(null), 2200);
      if (!mutedRef.current) {
        try {
          if (!audioRef.current) {
            audioRef.current = new AudioContext();
          }
          const ctx = audioRef.current;
          const sfx = PHASE_SFX[key];
          if (ctx && sfx) {
            if (ctx.state === 'suspended') void ctx.resume();
            sfx(ctx);
          }
        } catch {
          // audio not available — ignore
        }
      }
      return () => window.clearTimeout(clear);
    }
  }, [stressPhase, stressActive]);

  if (!stressActive) return null;

  const isOutage = stressPhase.toUpperCase() === 'OUTAGE';
  const isIntro = stressPhase.toUpperCase() === 'NOMINAL';
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 22, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.55) 100%)' }} />
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, transparent 1px, transparent 3px)', opacity: 0.5 }} />

      {/* Outage red-alert pulse */}
      <AnimatePresence>
        {isOutage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.0, 0.5, 0.15, 0.5, 0.15] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(251,113,133,0.28) 100%)' }}
          />
        )}
      </AnimatePresence>

      {/* REC + timecode */}
      <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
        <motion.span
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ width: 9, height: 9, borderRadius: '50%', background: T.red, display: 'inline-block', boxShadow: `0 0 10px ${T.red}` }}
        />
        <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: '0.1em' }}>REC</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, letterSpacing: '0.1em' }}>{mm}:{ss}</span>
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        style={{
          position: 'absolute', top: 12, right: 16, pointerEvents: 'auto', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
          background: 'rgba(6,10,20,0.7)', border: `1px solid rgba(56,189,248,0.25)`, color: T.textDim,
          fontFamily: T.mono, fontSize: 9.5,
        }}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />} {muted ? 'MUTED' : 'SFX'}
      </button>

      {/* Epic intro title */}
      <AnimatePresence>
        {isIntro && (
          <motion.div
            initial={{ opacity: 0, scale: 1.15, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(6px)' }}
            transition={{ duration: 0.8 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
          >
            <div style={{ fontFamily: T.sans, fontSize: 52, fontWeight: 900, letterSpacing: '-0.02em', color: T.text, textShadow: `0 0 40px ${T.cyan}88`, lineHeight: 1 }}>
              POWER<span style={{ color: T.cyan }}>WORKER</span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.cyan, letterSpacing: '0.35em', marginTop: 12 }}>
              AUTONOMOUS MICRO-GRID INTELLIGENCE
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: '0.2em', marginTop: 18 }}>
              INITIATING GRID STRESS SIMULATION…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase-slam flash */}
      <AnimatePresence mode="wait">
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ opacity: 0, scale: 1.4, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.35, ease: 'backOut' }}
            style={{ position: 'absolute', top: '18%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}
          >
            <div style={{
              fontFamily: T.sans, fontSize: 32, fontWeight: 900, letterSpacing: '0.02em',
              color: flash.color, textShadow: `0 0 30px ${flash.color}`, padding: '8px 26px',
              border: `2px solid ${flash.color}`, borderRadius: 14, background: 'rgba(6,10,20,0.55)',
              backdropFilter: 'blur(4px)', textAlign: 'center',
            }}>
              {flash.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
