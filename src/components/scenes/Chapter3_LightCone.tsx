"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";

/**
 * Chapter 3: Minkowski light cones.
 *
 * Two spatial dimensions form a horizontal disc; time runs vertically.
 * The future cone opens upward (ember), the past cone opens downward
 * (cool). The cone surfaces are rendered with a custom shader: Fresnel
 * edge-glow makes silhouettes luminous, an axial noise flow conveys
 * timelike propagation, and the output is HDR-bright at the rim so
 * Bloom turns the edges into light. A periodic radial wave ripples
 * outward from the origin event into the future cone.
 */

const CONE_VS = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CONE_FS = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFlowSpeed;
  uniform float uFlowDir;
  uniform vec3 uCameraPos;
  uniform float uRipplePhase;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 V = normalize(uCameraPos - vWorldPos);
    float fres = pow(1.0 - abs(dot(vWorldNormal, V)), 2.2);

    // uv.y runs apex(0) → base(1) on cone surface. We want the
    // brightest edge at the apex (origin event) so the cone reads as
    // emanating from the event, fading outward.
    float axial = 1.0 - vUv.y;
    float radialFalloff = pow(axial, 1.4);

    // Flowing noise along the cone's axial direction; uFlowDir lets
    // future/past cones flow in opposite senses.
    vec2 flowUv = vec2(vUv.x * 6.2831, vUv.y * 4.0 - uTime * uFlowSpeed * uFlowDir);
    float flow = fbm(flowUv);
    flow = smoothstep(0.35, 0.95, flow) * radialFalloff;

    // A travelling wavefront — periodic ring ripping outward along the
    // cone surface; signals causal propagation from the origin.
    float wavePos = uRipplePhase;
    float waveBand = exp(-pow((vUv.y - wavePos) * 5.5, 2.0));

    float a = clamp(fres * 0.55 + flow * 0.4 + waveBand * 0.55 + 0.05, 0.0, 0.95);
    vec3 col = uColor * uIntensity *
      (0.45 + fres * 0.9 + flow * 1.2 + waveBand * 1.6) * radialFalloff +
      uColor * 0.05;

    gl_FragColor = vec4(col, a);
  }
`;

function VolumetricCone({
  direction = 1,
  color = palette.ember,
  flowDir = 1,
  intensity = 1.4,
  flowSpeed = 0.18,
  rippleEnabled = true,
}: {
  direction?: 1 | -1;
  color?: string;
  flowDir?: 1 | -1;
  intensity?: number;
  flowSpeed?: number;
  rippleEnabled?: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const h = 3;
  const r = 3;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uFlowSpeed: { value: flowSpeed },
      uFlowDir: { value: flowDir },
      uCameraPos: { value: new THREE.Vector3() },
      uRipplePhase: { value: -1 },
    }),
    [color, intensity, flowSpeed, flowDir],
  );

  useFrame(({ clock, camera }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uCameraPos.value.copy(camera.position);
    if (rippleEnabled) {
      // Ripple every 4.2s, sweeps from apex (0) → base (1.05) so it
      // exits the cone smoothly at the rim.
      const phase = (clock.elapsedTime % 4.2) / 4.2;
      matRef.current.uniforms.uRipplePhase.value = phase * 1.05;
    }
  });

  return (
    <group
      position={[0, (direction * h) / 2, 0]}
      rotation={[direction === 1 ? 0 : Math.PI, 0, 0]}
    >
      <mesh>
        <coneGeometry args={[r, h, 96, 1, true]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={CONE_VS}
          fragmentShader={CONE_FS}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function ElsewhereEnvelope() {
  return (
    <mesh>
      <sphereGeometry args={[3.8, 48, 32]} />
      <meshBasicMaterial
        color="#1a2231"
        transparent
        opacity={0.14}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function NowDisc() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0, 3.02, 96]} />
      <meshBasicMaterial
        color="#11141b"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TimeAxis() {
  return (
    <mesh>
      <cylinderGeometry args={[0.004, 0.004, 6.6, 8]} />
      <meshBasicMaterial color="#2f3541" />
    </mesh>
  );
}

function OriginEvent() {
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = (t % 3) / 3;
    const scale = 1 + phase * 0.6;
    const opacity = 0.55 * (1 - phase);
    if (haloRef.current) haloRef.current.scale.setScalar(scale);
    if (haloMatRef.current) haloMatRef.current.opacity = opacity;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={2.0}
          roughness={0.2}
          clearcoat={1.0}
        />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color="#ffd9a3"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ffd9a3" intensity={1.6} distance={3.2} />
      <Billboard position={[0.3, 0.05, 0]}>
        <Text
          fontSize={0.12}
          color="#f4f1ea"
          anchorX="left"
          anchorY="middle"
        >
          an event
        </Text>
      </Billboard>
    </group>
  );
}

function ObserverWorldline() {
  return (
    <mesh rotation={[0, 0, 0.18]}>
      <cylinderGeometry args={[0.022, 0.022, 5.5, 12]} />
      <meshPhysicalMaterial
        color="#c9c4b8"
        emissive="#c9c4b8"
        emissiveIntensity={0.6}
        roughness={0.3}
        clearcoat={1.0}
      />
    </mesh>
  );
}

function DustParticles() {
  const group = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const rnd = mulberry32(42);
    const N = 220;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (rnd() - 0.5) * 8;
      p[i * 3 + 1] = (rnd() - 0.5) * 6;
      p[i * 3 + 2] = (rnd() - 0.5) * 8;
    }
    return { positions: p };
  }, []);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.02;
  });
  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        sizeAttenuation
        color="#c9c4b8"
        transparent
        opacity={0.28}
      />
    </points>
  );
}

function RegionLabels() {
  return (
    <group>
      <Billboard position={[0, 3.4, 0]}>
        <Text
          fontSize={0.17}
          color="#e8a96b"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#05060a"
        >
          future light cone
        </Text>
      </Billboard>
      <Billboard position={[0, -3.4, 0]}>
        <Text
          fontSize={0.17}
          color="#7aa7c7"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.01}
          outlineColor="#05060a"
        >
          past light cone
        </Text>
      </Billboard>
      <Billboard position={[3.2, 0, 2.2]}>
        <Text
          fontSize={0.15}
          color="#6b7486"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#05060a"
        >
          elsewhere
        </Text>
      </Billboard>
    </group>
  );
}

export function Chapter3Scene() {
  return (
    <SceneFrame
      camera={{ position: [5.6, 2.6, 6.0], fov: 40 }}
      bloom={{ intensity: 1.0, threshold: 0.85, smoothing: 0.25 }}
      parallax={{ strength: 0.1 }}
    >
      <Starfield count={300} radius={55} />
      <DustParticles />
      <ElsewhereEnvelope />
      <TimeAxis />
      <NowDisc />
      <VolumetricCone
        direction={1}
        color={palette.ember}
        flowDir={-1}
        intensity={1.6}
        flowSpeed={0.22}
        rippleEnabled
      />
      <VolumetricCone
        direction={-1}
        color={palette.cool}
        flowDir={1}
        intensity={1.2}
        flowSpeed={0.16}
        rippleEnabled={false}
      />
      <ObserverWorldline />
      <OriginEvent />
      <RegionLabels />
    </SceneFrame>
  );
}
