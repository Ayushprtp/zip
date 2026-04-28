import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere } from '@react-three/drei';
import * as THREE from 'three';

function GlowSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.3;
      meshRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <Float speed={3} rotationIntensity={0.2} floatIntensity={0.8}>
      <Sphere ref={meshRef} args={[0.35, 64, 64]}>
        <MeshDistortMaterial color="#ffffff" roughness={0.05} metalness={1} distort={0.25} speed={3} />
      </Sphere>
    </Float>
  );
}

function MiniParticles() {
  const count = 30;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const positions = useMemo(() => {
    const pos = [];

    for (let i = 0; i < count; i++) {
      pos.push({
        x: (Math.random() - 0.5) * 3,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }

    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    positions.forEach((p, i) => {
      dummy.position.set(
        p.x + Math.sin(clock.elapsedTime + p.phase) * 0.15,
        p.y + Math.cos(clock.elapsedTime * 0.8 + p.phase) * 0.1,
        p.z,
      );

      const s = 0.008 + Math.sin(clock.elapsedTime * 2 + p.phase) * 0.004;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
    </instancedMesh>
  );
}

export function HeaderOrb3D() {
  return (
    <div style={{ width: '36px', height: '36px', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 2], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[3, 3, 3]} intensity={1} color="#ffffff" />
        <pointLight position={[-2, 1, 1]} intensity={0.5} color="#a1a1aa" />
        <GlowSphere />
        <MiniParticles />
      </Canvas>
    </div>
  );
}
