'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FlockInstanced, SimulationPhase } from './FlockInstanced';
import { PigeonTracker } from './PigeonTracker';
import { DeterrentAudioPulse } from './DeterrentAudioPulse';
import { TrackingHUD } from './TrackingHUD';
import { startFlockPhaseCycle } from '@/lib/flock-phase-cycle';

// Botones de prueba manual solo en desarrollo: no deben verse en producción
// (decisión del PO, 2026-09-21).
const SHOW_DEBUG_CONTROLS = process.env.NODE_ENV !== 'production';

export default function BirdTrackingScene() {
  const flockRef = useRef<THREE.InstancedMesh>(null);
  const [phase, setPhase] = useState<SimulationPhase>('APPROACH');

  // El ciclo se programa una sola vez (ver lib/flock-phase-cycle.ts): depender
  // de `phase` reprogramaba los timers y alargaba el ciclo a ~19s.
  useEffect(() => startFlockPhaseCycle(setPhase), []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0a]">
      <TrackingHUD />

      {/* Panel HUD */}
      <div className="absolute top-4 left-4 z-20 text-[11px] font-mono pointer-events-none select-none bg-black/70 p-3 rounded-lg border border-rose-500/30 backdrop-blur-md text-rose-400 min-w-[260px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold tracking-wider">AURIS_DISUASION_v2</span>
          <span className={`w-2 h-2 rounded-full ${phase === 'DETERRED' ? 'bg-red-500 animate-ping' : 'bg-rose-400 animate-pulse'}`} />
        </div>

        <p className="text-stone-300">
          ESPECIE: <span className="text-white font-semibold">Columba livia (Paloma)</span>
        </p>

        <p className="mt-1">
          ESTADO SISTEMA:{' '}
          <span className="font-bold text-rose-300">
            {phase === 'APPROACH' && 'Aproximación a superficie'}
            {phase === 'LANDED' && 'PALOMAS POSADAS EN SUELO (Lock On)'}
            {phase === 'DETERRED' && '⚡ EMITIENDO PULSO SONORO'}
            {phase === 'SCATTER' && '✔ PLAGA DISUADIDA Y AHUYENTADA'}
          </span>
        </p>
      </div>

      {/* Botones de prueba manual (solo desarrollo) */}
      {SHOW_DEBUG_CONTROLS && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <button
            onClick={() => setPhase('DETERRED')}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-black font-mono font-bold text-xs rounded-md shadow-lg transition-all active:scale-95"
          >
            ACTIVAR PULSO DE DISUASIÓN
          </button>
          <button
            onClick={() => setPhase('APPROACH')}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-rose-400 border border-rose-500/40 font-mono text-xs rounded-md"
          >
            Reiniciar
          </button>
        </div>
      )}

      <Canvas camera={{ position: [0, 2.5, 13], fov: 48 }}>
        <color attach="background" args={['#0a0a0a']} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[10, 20, 15]} intensity={1.4} castShadow />

        {/* --- PISO EN Y = -1.02 --- */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#121212" roughness={0.8} metalness={0.2} />
        </mesh>
        <gridHelper args={[60, 30, '#9e1b34', '#2a2224']} position={[0, -1.01, 0]} />

        {/* Bandada de Palomas */}
        <FlockInstanced ref={flockRef} phase={phase} />

        {/* Tracker IA con retículas */}
        <PigeonTracker flockRef={flockRef} />

        {/* Pulso de disuasión */}
        <DeterrentAudioPulse active={phase === 'DETERRED'} />

        <OrbitControls target={[0, -0.5, 0]} enableZoom={false} enablePan={false} makeDefault />
      </Canvas>
    </div>
  );
}
