import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleFieldProps {
  count?: number;
  className?: string;
}

function Particles({ count = 200 }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particleData = useMemo(() => {
    const data = [];

    for (let i = 0; i < count; i++) {
      data.push({
        x: (Math.random() - 0.5) * 30,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 15 - 5,
        speedX: (Math.random() - 0.5) * 0.005,
        speedY: (Math.random() - 0.5) * 0.005,
        scale: Math.random() * 0.03 + 0.005,
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }

    return data;
  }, [count]);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    particleData.forEach((p, i) => {
      const t = clock.elapsedTime;
      const x = p.x + Math.sin(t * 0.1 + p.phaseOffset) * 0.8;
      const y = p.y + Math.cos(t * 0.15 + p.phaseOffset) * 0.6;
      const z = p.z + Math.sin(t * 0.05 + p.phaseOffset * 2) * 0.3;

      dummy.position.set(x, y, z);

      const pulse = p.scale * (1 + Math.sin(t * 0.5 + p.phaseOffset) * 0.3);
      dummy.scale.set(pulse, pulse, pulse);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
    </instancedMesh>
  );
}

function GridPlane() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.elapsedTime;
    }
  });

  const shader = useMemo(
    () => ({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
      fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec2 grid = abs(fract(vUv * 30.0 - 0.5) - 0.5) / fwidth(vUv * 30.0);
        float line = min(grid.x, grid.y);
        float alpha = 1.0 - min(line, 1.0);
        alpha *= 0.04;

        float dist = distance(vUv, vec2(0.5));
        alpha *= smoothstep(0.7, 0.0, dist);
        alpha *= 0.5 + 0.5 * sin(uTime * 0.3);

        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `,
    }),
    [],
  );

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -3, -5]}>
      <planeGeometry args={[40, 40, 1, 1]} />
      <shaderMaterial {...shader} transparent depthWrite={false} />
    </mesh>
  );
}

export function ParticleField({ count = 200, className }: ParticleFieldProps) {
  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      >
        <Particles count={count} />
        <GridPlane />
      </Canvas>
    </div>
  );
}
