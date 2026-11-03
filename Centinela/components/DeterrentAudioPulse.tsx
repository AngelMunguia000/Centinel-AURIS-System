'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DeterrentAudioPulseProps {
  active?: boolean;
  position?: [number, number, number];
}

export function DeterrentAudioPulse({ active = true, position = [0, -1.0, -0.5] }: DeterrentAudioPulseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const waveCount = 4;
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const domeRefs = useRef<(THREE.Mesh | null)[]>([]);

  const ringsData = useMemo(() => {
    return Array.from({ length: waveCount }, (_, i) => ({
      delay: i * 0.22,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!active) return;
    const time = clock.getElapsedTime() * 2.5;

    ringsData.forEach((wave, i) => {
      const progress = (time - wave.delay) % 1;
      const normalizedProgress = progress < 0 ? progress + 1 : progress;
      const scale = Math.pow(normalizedProgress, 0.85) * 18;
      const opacity = Math.sin(normalizedProgress * Math.PI) * 0.65 * (1 - normalizedProgress * 0.5);

      const ring = ringRefs.current[i];
      if (ring) {
        ring.scale.set(scale, scale, 1);
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = opacity;
      }

      const dome = domeRefs.current[i];
      if (dome) {
        dome.scale.set(scale * 0.9, scale * 0.6, scale * 0.9);
        const mat = dome.material as THREE.MeshBasicMaterial;
        mat.opacity = opacity * 0.45;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.25, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#e0566c" emissive="#9e1b34" emissiveIntensity={1.5} />
      </mesh>

      {ringsData.map((_, i) => (
        <React.Fragment key={i}>
          <mesh
            ref={(el) => (ringRefs.current[i] = el)}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
          >
            <ringGeometry args={[0.3, 0.42, 64]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#e0566c" : "#f08a9a"}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          <mesh ref={(el) => (domeRefs.current[i] = el)} position={[0, 0, 0]}>
            <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshBasicMaterial
              color="#9e1b34"
              transparent
              wireframe
              depthWrite={false}
            />
          </mesh>
        </React.Fragment>
      ))}

      <pointLight color="#e0566c" intensity={4} distance={8} decay={2} />
    </group>
  );
}

export default DeterrentAudioPulse;