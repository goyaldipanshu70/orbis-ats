import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 160;
const CONNECTION_DISTANCE = 2.2;
const BOUNDS = 8;

// Pre-allocate reusable vectors
const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Generate random initial positions and velocities
  const { positions, velocities, colors } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * BOUNDS * 2;
      pos[i3 + 1] = (Math.random() - 0.5) * BOUNDS * 2;
      pos[i3 + 2] = (Math.random() - 0.5) * BOUNDS;
      vel[i3] = (Math.random() - 0.5) * 0.005;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.003;
      // Blue to purple gradient
      const t = Math.random();
      col[i3] = 0.1 + t * 0.3;     // R
      col[i3 + 1] = 0.2 + t * 0.15; // G
      col[i3 + 2] = 0.8 + t * 0.2;  // B
    }
    return { positions: pos, velocities: vel, colors: col };
  }, []);

  // Line geometry for connections (pre-allocate max possible)
  const maxLines = PARTICLE_COUNT * 6; // rough max connections
  const linePositions = useMemo(() => new Float32Array(maxLines * 6), []);
  const lineColors = useMemo(() => new Float32Array(maxLines * 6), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current || !linesRef.current) return;
    const time = state.clock.elapsedTime;

    // Update particle positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // Sine-wave drift
      positions[i3] += velocities[i3] + Math.sin(time * 0.3 + i) * 0.001;
      positions[i3 + 1] += velocities[i3 + 1] + Math.cos(time * 0.2 + i) * 0.001;
      positions[i3 + 2] += velocities[i3 + 2];

      // Wrap around bounds
      for (let j = 0; j < 3; j++) {
        const bound = j === 2 ? BOUNDS : BOUNDS * 2;
        if (positions[i3 + j] > bound) positions[i3 + j] = -bound;
        if (positions[i3 + j] < -bound) positions[i3 + j] = bound;
      }

      // Pulse size
      const scale = 0.03 + Math.sin(time * 1.5 + i * 0.5) * 0.015;
      dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Build connection lines
    let lineIdx = 0;
    for (let i = 0; i < PARTICLE_COUNT && lineIdx < maxLines; i++) {
      _v3a.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < maxLines; j++) {
        _v3b.set(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
        const dist = _v3a.distanceTo(_v3b);
        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE;
          const li = lineIdx * 6;
          linePositions[li] = _v3a.x;
          linePositions[li + 1] = _v3a.y;
          linePositions[li + 2] = _v3a.z;
          linePositions[li + 3] = _v3b.x;
          linePositions[li + 4] = _v3b.y;
          linePositions[li + 5] = _v3b.z;
          // Blue line color with distance-based alpha
          lineColors[li] = 0.2 * alpha;
          lineColors[li + 1] = 0.4 * alpha;
          lineColors[li + 2] = 0.9 * alpha;
          lineColors[li + 3] = 0.2 * alpha;
          lineColors[li + 4] = 0.4 * alpha;
          lineColors[li + 5] = 0.9 * alpha;
          lineIdx++;
        }
      }
    }

    // Update line geometry
    const lineGeo = linesRef.current.geometry;
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions.slice(0, lineIdx * 6), 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors.slice(0, lineIdx * 6), 3));
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
    lineGeo.setDrawRange(0, lineIdx * 2);
  });

  return (
    <>
      {/* Instanced particle spheres */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#4f8fff" transparent opacity={0.8} />
      </instancedMesh>

      {/* Connection lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial vertexColors transparent opacity={0.15} />
      </lineSegments>
    </>
  );
}

function RotatingCamera() {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.08;
    state.camera.position.x = Math.cos(t) * 6;
    state.camera.position.z = Math.sin(t) * 6;
    state.camera.position.y = Math.sin(t * 0.5) * 1.5;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 60 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
      >
        <Particles />
        <RotatingCamera />
      </Canvas>
    </div>
  );
}
