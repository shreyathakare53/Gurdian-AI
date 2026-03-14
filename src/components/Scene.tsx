import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';

export default function Scene({ theme = 'default' }: { theme?: string }) {
  const themeColors: Record<string, string> = {
    default: '#10b981', // Emerald
    child: '#f472b6',   // Pink
    science: '#3b82f6', // Blue
    arts: '#f59e0b',    // Amber
    business: '#10b981', // Emerald
    medical: '#ef4444',  // Red
  };

  const color = themeColors[theme] || themeColors.default;

  return (
    <div className="fixed inset-0 -z-10 bg-black">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Float speed={2} rotationIntensity={1} floatIntensity={2}>
          <Sphere args={[1, 64, 64]}>
            <MeshDistortMaterial
              color={color}
              attach="material"
              distort={theme === 'child' ? 0.6 : 0.4}
              speed={theme === 'child' ? 3 : 2}
              roughness={0.2}
              metalness={0.8}
            />
          </Sphere>
        </Float>
        <Particles count={2000} color={color} />
      </Canvas>
    </div>
  );
}

function Particles({ count = 1000, color = '#10b981' }: { count?: number; color?: string }) {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 10;
      p[i * 3 + 1] = (Math.random() - 0.5) * 10;
      p[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return p;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.015}
        color={color}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}
