import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Trail } from '@react-three/drei';
import * as THREE from 'three';

function AnimatedOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.2;
      meshRef.current.rotation.y = clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.5}>
      <Trail width={3} length={6} color={new THREE.Color(0.6, 0.6, 0.7)} attenuation={(t) => t * t}>
        <Sphere ref={meshRef} args={[1.2, 128, 128]}>
          <MeshDistortMaterial
            color="#ffffff"
            roughness={0.1}
            metalness={0.95}
            distort={0.35}
            speed={2.5}
            envMapIntensity={1}
          />
        </Sphere>
      </Trail>
    </Float>
  );
}

function FloatingParticles() {
  const count = 120;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }

    return pos;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3] + Math.sin(clock.elapsedTime * 0.3 + i) * 0.3;
      const y = positions[i * 3 + 1] + Math.cos(clock.elapsedTime * 0.2 + i * 0.5) * 0.4;
      const z = positions[i * 3 + 2];

      dummy.position.set(x, y, z);

      const scale = 0.015 + Math.sin(clock.elapsedTime + i * 0.1) * 0.01;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
    </instancedMesh>
  );
}

function OrbLights() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 2, -2]} intensity={0.6} color="#a1a1aa" />
      <pointLight position={[3, -2, 3]} intensity={0.4} color="#71717a" />
      <spotLight position={[0, 5, 0]} angle={0.5} penumbra={1} intensity={0.5} color="#ffffff" />
    </>
  );
}

export function HeroOrb3D() {
  return (
    <div
      style={{
        width: '320px',
        height: '320px',
        position: 'relative',
      }}
    >
      {/* Glow backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: '-40%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <OrbLights />
        <AnimatedOrb />
        <FloatingParticles />
      </Canvas>
    </div>
  );
}
