import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CONFETTI_COUNT = 80;
const _v3 = new THREE.Vector3();

function CentralStar() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    meshRef.current.rotation.y = time * 0.4;
    meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.2;
    // Gentle float
    meshRef.current.position.y = Math.sin(time * 0.8) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.8, 1]} />
      <meshPhongMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.5}
        specular="#ffffff"
        shininess={100}
        flatShading
      />
    </mesh>
  );
}

function GlowRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = state.clock.elapsedTime * 0.3;
    // Pulse scale
    const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
    ringRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[1.3, 0.015, 8, 64]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.4} />
    </mesh>
  );
}

function ConfettiParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [started] = useState(() => Date.now());

  // Generate burst velocities
  const { velocities, rotations, colors, scales } = useMemo(() => {
    const vel = new Float32Array(CONFETTI_COUNT * 3);
    const rot = new Float32Array(CONFETTI_COUNT * 3);
    const col = new Float32Array(CONFETTI_COUNT * 3);
    const scl = new Float32Array(CONFETTI_COUNT);
    const palette = [
      [0.13, 0.77, 0.37], // green
      [0.98, 0.75, 0.15], // gold
      [0.96, 0.96, 0.96], // white
      [0.23, 0.51, 0.96], // blue
      [0.66, 0.33, 0.97], // purple
    ];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const i3 = i * 3;
      // Burst outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.02 + Math.random() * 0.04;
      vel[i3] = Math.sin(phi) * Math.cos(theta) * speed;
      vel[i3 + 1] = Math.cos(phi) * speed * 1.5 + 0.01; // bias upward initially
      vel[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      rot[i3] = Math.random() * 0.1;
      rot[i3 + 1] = Math.random() * 0.1;
      rot[i3 + 2] = Math.random() * 0.1;
      const c = palette[i % palette.length];
      col[i3] = c[0];
      col[i3 + 1] = c[1];
      col[i3 + 2] = c[2];
      scl[i] = 0.02 + Math.random() * 0.04;
    }
    return { velocities: vel, rotations: rot, colors: col, scales: scl };
  }, []);

  const positions = useMemo(() => new Float32Array(CONFETTI_COUNT * 3), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (Date.now() - started) / 1000;
    const gravity = -0.0003;

    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const i3 = i * 3;

      if (elapsed < 0.5) {
        // Initial burst phase
        positions[i3] += velocities[i3] * 2;
        positions[i3 + 1] += velocities[i3 + 1] * 2;
        positions[i3 + 2] += velocities[i3 + 2] * 2;
      } else {
        // Settle phase - drift down
        positions[i3] += velocities[i3] * 0.3;
        velocities[i3 + 1] += gravity;
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2] * 0.3;
        // Gentle sway
        positions[i3] += Math.sin(elapsed * 2 + i) * 0.001;
      }

      dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      dummy.rotation.x += rotations[i3];
      dummy.rotation.y += rotations[i3 + 1];
      dummy.rotation.z += rotations[i3 + 2];
      dummy.scale.setScalar(scales[i]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Set instance color
      meshRef.current.setColorAt(i, new THREE.Color(colors[i3], colors[i3 + 1], colors[i3 + 2]));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CONFETTI_COUNT]}>
      <boxGeometry args={[1, 1, 0.2]} />
      <meshBasicMaterial transparent opacity={0.9} />
    </instancedMesh>
  );
}

function SparkleOrbit() {
  const groupRef = useRef<THREE.Group>(null);

  const sparkles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      radius: 1.5 + Math.random() * 0.5,
      speed: 0.4 + Math.random() * 0.3,
      yOffset: (Math.random() - 0.5) * 1.2,
      size: 0.015 + Math.random() * 0.02,
      color: i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#22c55e' : '#ffffff',
    }))
  , []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const s = sparkles[i];
      const angle = s.angle + time * s.speed;
      child.position.x = Math.cos(angle) * s.radius;
      child.position.z = Math.sin(angle) * s.radius;
      child.position.y = s.yOffset + Math.sin(time + i) * 0.3;
      // Twinkle
      const scale = s.size * (0.8 + Math.sin(time * 3 + i * 2) * 0.4);
      child.scale.setScalar(scale);
    });
  });

  return (
    <group ref={groupRef}>
      {sparkles.map((s, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  );
}

function CelebrationContent() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} color="#fff7ed" />
      <pointLight color="#22c55e" position={[0, 0, 0]} intensity={2} distance={5} />
      <CentralStar />
      <GlowRing />
      <ConfettiParticles />
      <SparkleOrbit />
    </>
  );
}

interface CelebrationSceneProps {
  className?: string;
}

export default function CelebrationScene({ className = '' }: CelebrationSceneProps) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      >
        <CelebrationContent />
      </Canvas>
    </div>
  );
}
