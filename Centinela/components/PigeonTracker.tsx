'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface PigeonTrackerProps {
  flockRef: React.RefObject<THREE.InstancedMesh | null>;
}

// Palomas clave de la bandada a rastrear. Constante de módulo: no cambia.
const TRACKED_INDICES = [2, 8, 15, 27, 34];

export function PigeonTracker({ flockRef }: PigeonTrackerProps) {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const groupRefs = useRef<Array<THREE.Group | null>>([]);

  // Los marcadores se renderizan UNA vez y aquí solo se mueve su posición por
  // ref. Antes esto hacía setState en cada frame (React re-renderizando a
  // 60fps y 5 Vector3 nuevos por frame — auditoría 14 sep, bug A2).
  useFrame(() => {
    const flock = flockRef.current;
    if (!flock) return;

    TRACKED_INDICES.forEach((id, idx) => {
      const group = groupRefs.current[idx];
      if (!group) return;
      flock.getMatrixAt(id, dummy.matrix);
      group.position.setFromMatrixPosition(dummy.matrix);
    });
  });

  return (
    <group>
      {TRACKED_INDICES.map((id, idx) => (
        <group
          key={id}
          ref={(el) => {
            groupRefs.current[idx] = el;
          }}
        >
          <Html center distanceFactor={28} zIndexRange={[100, 0]}>
            <div className="pointer-events-none select-none flex flex-col items-center">
              {/* Cuadro de detección AI / Bounding Box */}
              <div className="w-16 h-12 md:w-20 md:h-16 border border-rose-400/80 relative flex items-between justify-between p-0.5 animate-pulse">
                {/* Esquinas tácticas */}
                <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-rose-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-rose-400" />
                <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-rose-400" />
                <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-rose-400" />

                {/* Mirilla central */}
                <div className="m-auto w-1.5 h-1.5 bg-rose-400/70 rounded-full" />
              </div>

              {/* Etiqueta de reconocimiento */}
              <div className="mt-1 bg-black/80 px-1.5 py-0.5 rounded border border-rose-500/40 text-[9px] font-mono text-rose-300 whitespace-nowrap flex items-center gap-1 shadow-lg">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-ping" />
                <span>PALOMA</span>
                <span className="text-rose-400 font-bold">{94 + (idx % 5)}%</span>
              </div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
