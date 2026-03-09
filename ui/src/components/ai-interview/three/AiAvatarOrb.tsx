import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Pre-allocate
const _v3 = new THREE.Vector3();

interface AvatarSceneProps {
  isSpeaking: boolean;
  isThinking: boolean;
}

function CoreSphere({ isSpeaking, isThinking }: AvatarSceneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.IcosahedronGeometry>(null);

  // Store original vertex positions
  const originalPositions = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    return new Float32Array(geo.attributes.position.array);
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !geoRef.current) return;
    const time = state.clock.elapsedTime;
    const positions = geoRef.current.attributes.position.array as Float32Array;

    // Vertex displacement
    const intensity = isSpeaking ? 0.15 : isThinking ? 0.04 : 0.06;
    const speed = isSpeaking ? 3.0 : isThinking ? 0.8 : 1.2;

    for (let i = 0; i < positions.length; i += 3) {
      _v3.set(originalPositions[i], originalPositions[i + 1], originalPositions[i + 2]);
      const offset = Math.sin(time * speed + _v3.x * 3) *
                     Math.cos(time * speed * 0.7 + _v3.y * 3) * intensity;
      const len = _v3.length();
      _v3.normalize().multiplyScalar(len + offset);
      positions[i] = _v3.x;
      positions[i + 1] = _v3.y;
      positions[i + 2] = _v3.z;
    }
    geoRef.current.attributes.position.needsUpdate = true;
    geoRef.current.computeVertexNormals();

    // Slow rotation
    meshRef.current.rotation.y += 0.003;
    meshRef.current.rotation.x += 0.001;

    // Scale pulse for thinking
    const targetScale = isThinking ? 0.9 : 1.0;
    meshRef.current.scale.lerp(_v3.set(targetScale, targetScale, targetScale), 0.05);
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry ref={geoRef} args={[1, 4]} />
      <meshPhongMaterial
        color="#1e40af"
        emissive="#3b82f6"
        emissiveIntensity={isSpeaking ? 0.6 : 0.3}
        wireframe
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function OrbitingRings({ isSpeaking }: { isSpeaking: boolean }) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const speed = isSpeaking ? 1.5 : 0.5;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = time * speed * 0.3;
      ring1Ref.current.rotation.z = time * speed * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = time * speed * 0.4;
      ring2Ref.current.rotation.x = Math.PI / 3 + time * speed * 0.1;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = time * speed * 0.35;
      ring3Ref.current.rotation.y = Math.PI / 4 + time * speed * 0.15;
    }
  });

  const ringMaterial = (
    <meshBasicMaterial color="#60a5fa" transparent opacity={0.2} side={THREE.DoubleSide} />
  );

  return (
    <>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.6, 0.01, 8, 64]} />
        {ringMaterial}
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.8, 0.008, 8, 64]} />
        {ringMaterial}
      </mesh>
      <mesh ref={ring3Ref}>
        <torusGeometry args={[2.0, 0.006, 8, 64]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function FloatingParticles() {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      angle: (i / 10) * Math.PI * 2,
      radius: 1.3 + Math.random() * 0.8,
      speed: 0.3 + Math.random() * 0.4,
      yOffset: (Math.random() - 0.5) * 1.5,
      size: 0.02 + Math.random() * 0.03,
    }))
  , []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      const angle = p.angle + time * p.speed;
      child.position.x = Math.cos(angle) * p.radius;
      child.position.z = Math.sin(angle) * p.radius;
      child.position.y = p.yOffset + Math.sin(time * 0.8 + i) * 0.3;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#60a5fa' : '#a78bfa'} />
        </mesh>
      ))}
    </group>
  );
}

function InnerGlow({ isSpeaking, isThinking }: AvatarSceneProps) {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!lightRef.current) return;
    const time = state.clock.elapsedTime;
    const base = isSpeaking ? 3.0 : isThinking ? 1.0 : 1.5;
    const pulse = isSpeaking ? Math.sin(time * 4) * 1.5 : Math.sin(time * 1.5) * 0.5;
    lightRef.current.intensity = base + pulse;
  });

  return <pointLight ref={lightRef} color="#3b82f6" position={[0, 0, 0]} distance={5} />;
}

function AvatarScene({ isSpeaking, isThinking }: AvatarSceneProps) {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 3, 3]} intensity={0.3} color="#e0e7ff" />
      <InnerGlow isSpeaking={isSpeaking} isThinking={isThinking} />
      <CoreSphere isSpeaking={isSpeaking} isThinking={isThinking} />
      <OrbitingRings isSpeaking={isSpeaking} />
      <FloatingParticles />
    </>
  );
}

interface AiAvatarOrbProps {
  isSpeaking?: boolean;
  isThinking?: boolean;
  className?: string;
}

export default function AiAvatarOrb({ isSpeaking = false, isThinking = false, className = '' }: AiAvatarOrbProps) {
  return (
    <div className={`${className}`}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      >
        <AvatarScene isSpeaking={isSpeaking} isThinking={isThinking} />
      </Canvas>
    </div>
  );
}
