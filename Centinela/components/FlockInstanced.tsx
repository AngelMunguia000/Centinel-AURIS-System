'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type SimulationPhase = 'APPROACH' | 'LANDED' | 'DETERRED' | 'SCATTER';

interface FlockInstancedProps {
  phase: SimulationPhase;
  birdCount?: number;
}

export const FlockInstanced = React.forwardRef<THREE.InstancedMesh, FlockInstancedProps>(
  ({ phase, birdCount = 40 }, ref) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    React.useImperativeHandle(ref, () => meshRef.current!);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    // 1. Geometría 3D de Paloma
    const { pigeonGeometry, phaseArray } = useMemo(() => {
      const geom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0.0,   0.08,  0.80,  0.0,   0.20,  0.55,  0.0,  -0.08,  0.60,
        0.0,   0.28,  0.30,  0.0,  -0.22,  0.25,  0.0,   0.02, -0.35,
       -0.38,  0.02, -0.85,  0.0,   0.04, -0.90,  0.38,  0.02, -0.85,
       -0.28,  0.12,  0.25, -1.05,  0.22,  0.05, -2.15, -0.05, -0.35,
       -1.25, -0.02, -0.45, -0.45, -0.02, -0.38,
        0.28,  0.12,  0.25,  1.05,  0.22,  0.05,  2.15, -0.05, -0.35,
        1.25, -0.02, -0.45,  0.45, -0.02, -0.38,
      ]);

      const indices = [
        0, 1, 2,  1, 3, 2,  2, 3, 4,  3, 5, 4,
        3, 6, 5,  5, 6, 7,  5, 7, 8,  3, 5, 8,
        3, 9, 4,  9, 10, 13, 10, 12, 13, 10, 11, 12, 4, 9, 13,
        3, 14, 4, 14, 15, 18, 15, 17, 18, 15, 16, 17, 4, 14, 18
      ];

      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geom.setIndex(indices);
      geom.computeVertexNormals();

      const wingFactor = new Float32Array(vertices.length / 3);
      for (let i = 0; i < vertices.length / 3; i++) {
        wingFactor[i] = Math.abs(vertices[i * 3]);
      }
      geom.setAttribute('aWingFactor', new THREE.BufferAttribute(wingFactor, 1));

      const phases = new Float32Array(birdCount);
      for (let i = 0; i < birdCount; i++) {
        phases[i] = Math.random() * Math.PI * 2;
      }

      return { pigeonGeometry: geom, phaseArray: phases };
    }, [birdCount]);

    // Material con Shader
    const material = useMemo(() => {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#d1d5db'), // Un poco más claro para mejor visibilidad
        roughness: 0.3,
        metalness: 0.2,
        side: THREE.DoubleSide,
      });

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uFlapSpeed = { value: 14.0 };
        material.userData.shader = shader;

        shader.vertexShader = `
          attribute float aWingFactor;
          attribute float aInstancePhase;
          uniform float uTime;
          uniform float uFlapSpeed;
          ${shader.vertexShader}
        `;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float cycle = uTime * uFlapSpeed + aInstancePhase;
          float flap = sin(cycle) * aWingFactor * 0.38;
          transformed.y += flap;
          transformed.z += cos(cycle) * 0.04;
          `
        );
      };

      return mat;
    }, []);

    useMemo(() => {
      pigeonGeometry.setAttribute(
        'aInstancePhase',
        new THREE.InstancedBufferAttribute(phaseArray, 1)
      );
    }, [pigeonGeometry, phaseArray]);

    // Posiciones en el suelo con Y = -1.0
    const birdsData = useMemo(() => {
      const GROUND_Y = -1.0; // Elevamos el suelo para enfocar en el centro
      return Array.from({ length: birdCount }, () => {
        // Distribución rectangular más concentrada al frente de la cámara
        const groundPos = new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          GROUND_Y,
          (Math.random() - 0.5) * 6 - 0.5
        );

        const startPos = new THREE.Vector3(
          groundPos.x + (Math.random() - 0.5) * 12,
          groundPos.y + 10 + Math.random() * 6,
          groundPos.z + 15 + Math.random() * 8
        );

        const scatterDir = new THREE.Vector3(
          groundPos.x * 0.2 + (Math.random() - 0.5) * 2.0,
          1.2 + Math.random() * 1.0,
          groundPos.z * 0.2 + 1.0 + Math.random() * 1.5
        ).normalize();

        const randomYaw = Math.random() * Math.PI * 2;

        return {
          currentPos: startPos.clone(),
          startPos,
          groundPos,
          scatterDir,
          speed: 0.08 + Math.random() * 0.04,
          scatterSpeed: 0.35 + Math.random() * 0.25,
          offset: Math.random() * 100,
          yaw: randomYaw,
          currentRotation: new THREE.Euler(0, randomYaw, 0),
        };
      });
    }, [birdCount]);

    useFrame(({ clock }) => {
      if (!meshRef.current) return;
      const time = clock.getElapsedTime();

      if (material.userData.shader) {
        material.userData.shader.uniforms.uTime.value = time;
        material.userData.shader.uniforms.uFlapSpeed.value =
          phase === 'LANDED' ? 1.0 : phase === 'SCATTER' ? 24.0 : 14.0;
      }

      birdsData.forEach((bird, i) => {
        if (phase === 'APPROACH') {
          // Descenso progresivo
          bird.currentPos.lerp(bird.groundPos, 0.028);
          bird.currentRotation.set(
            Math.cos(time * 2 + bird.offset) * 0.05,
            bird.yaw + Math.sin(time + bird.offset) * 0.1,
            Math.sin(time * 2 + bird.offset) * 0.08
          );
        } else if (phase === 'LANDED' || phase === 'DETERRED') {
          // En suelo: pequeños cabeceos y picoteos
          bird.currentPos.copy(bird.groundPos);
          bird.currentPos.y = -1.0 + Math.max(0, Math.sin(time * 5 + bird.offset) * 0.04);
          bird.currentRotation.set(
            Math.sin(time * 3 + bird.offset) * 0.15,
            bird.yaw + Math.sin(time * 0.8 + bird.offset) * 0.2,
            0
          );
        } else if (phase === 'SCATTER') {
          // Huida rápida
          bird.currentPos.addScaledVector(bird.scatterDir, bird.scatterSpeed);
          bird.currentRotation.set(-0.3, bird.yaw, (Math.random() - 0.5) * 0.4);
        }

        dummy.position.copy(bird.currentPos);
        dummy.rotation.copy(bird.currentRotation);
        dummy.scale.setScalar(0.75); // Aumentamos la escala a 0.75 para que se vean grandes y claras
        dummy.updateMatrix();

        meshRef.current!.setMatrixAt(i, dummy.matrix);
      });

      meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
      <instancedMesh
        ref={meshRef}
        args={[pigeonGeometry, material, birdCount]}
        castShadow
        receiveShadow
      />
    );
  }
);

FlockInstanced.displayName = 'FlockInstanced';