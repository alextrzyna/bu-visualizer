"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { SceneFrame } from "./SceneFrame";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";

/**
 * Chapter 5: the thermodynamic arrow of time — GPGPU edition.
 *
 * 64×64 = 4096 particles maintained on the GPU via ping-pong textures.
 * The position/velocity simulation runs as a fragment-shader pass each
 * frame; particles are rendered as billboarded soft points whose color
 * heats up with speed. Density emerges from additive blending — the
 * concentrated corner glows brightest when the cluster is dense and
 * dissolves outward as entropy increases.
 *
 * (We could push to 256×256 = 65k on WebGL2 without breaking a sweat,
 * but 4k reads more like "many distinct particles" than "fluid" at the
 * scale of this scene. Bump SIM_DIM to 256 if you want the fluid look.)
 */

const SIM_DIM = 64;
const PARTICLE_COUNT = SIM_DIM * SIM_DIM;
const BOX = 1.7;
const CYCLE = 16;
const RESET_DURATION = 1.5;

// Per-particle initial state — stable across frames, derived from the
// particle's texture coordinate. Used both at simulation startup and
// each cycle reset, so every cycle re-spawns with the same energetic
// random velocity rather than draining to zero.
const SHARED_INIT_GLSL = /* glsl */ `
  vec3 hash3uv(vec2 uv, float salt) {
    vec3 p = vec3(uv * 91.7 + salt, salt * 17.31);
    p = vec3(
      dot(p, vec3(127.1, 311.7,  74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }
  vec3 initialPos(vec2 uv, vec3 corner) {
    vec3 r = hash3uv(uv, 1.71);
    return corner + (r - 0.5) * 0.22;
  }
  vec3 initialVel(vec2 uv) {
    vec3 r = hash3uv(uv, 7.13) - 0.5;
    float speed = 0.22 + 0.18 * fract(r.x * 91.7 + 0.31);
    return normalize(r) * speed;
  }
`;

const SIM_VELOCITY_FS = /* glsl */ `
  uniform float uDt;
  uniform float uTime;
  uniform float uBox;
  uniform float uCurlStrength;
  uniform float uDrag;
  uniform float uReset;
  uniform vec3 uResetCenter;
  ${SHARED_INIT_GLSL}

  vec3 hash3(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7,  74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  vec3 curlNoise(vec3 p) {
    const float e = 0.08;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    float p_x0 = vnoise(p - dx), p_x1 = vnoise(p + dx);
    float p_y0 = vnoise(p - dy), p_y1 = vnoise(p + dy);
    float p_z0 = vnoise(p - dz), p_z1 = vnoise(p + dz);
    return vec3(
      (p_y1 - p_y0) - (p_z1 - p_z0),
      (p_z1 - p_z0) - (p_x1 - p_x0),
      (p_x1 - p_x0) - (p_y1 - p_y0)
    ) / (2.0 * e);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;

    if (uReset > 0.5) {
      // Lerp directly to a fresh per-particle initial velocity so when
      // the reset window closes, every particle re-spawns with the
      // same energetic random direction it had at t=0.
      vec3 targetVel = initialVel(uv);
      vel = mix(vel, targetVel, clamp(uDt * 6.0, 0.0, 1.0));
    } else {
      // Curl-noise field gently swirls the gas. A tiny drag prevents
      // unbounded acceleration that would otherwise pin particles to
      // walls when the curl field's local divergence happens to align
      // with a wall normal over many steps.
      vec3 swirl = curlNoise(pos * 0.7 + uTime * 0.05);
      vel += swirl * uCurlStrength * uDt;
      vel *= (1.0 - uDrag * uDt);

      // Predict next position; if it would cross a wall, flip the
      // velocity component to head inward. Done on the PREDICTED
      // position so it stays in lockstep with the position pass's
      // reflection.
      vec3 next = pos + vel * uDt;
      if (next.x >  uBox) vel.x = -abs(vel.x);
      if (next.x < -uBox) vel.x =  abs(vel.x);
      if (next.y >  uBox) vel.y = -abs(vel.y);
      if (next.y < -uBox) vel.y =  abs(vel.y);
      if (next.z >  uBox) vel.z = -abs(vel.z);
      if (next.z < -uBox) vel.z =  abs(vel.z);
    }

    gl_FragColor = vec4(vel, 1.0);
  }
`;

const SIM_POSITION_FS = /* glsl */ `
  uniform float uDt;
  uniform float uBox;
  uniform float uReset;
  uniform vec3 uResetCenter;
  ${SHARED_INIT_GLSL}

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec3 next;

    if (uReset > 0.5) {
      // Smoothly pull each particle back to its individual initial
      // position. This keeps the cluster compact instead of relying
      // on velocity-driven convergence (which leaves residual drift).
      vec3 target = initialPos(uv, uResetCenter);
      next = mix(pos, target, clamp(uDt * 6.0, 0.0, 1.0));
    } else {
      next = pos + vel * uDt;
      // Reflect across walls instead of clamping — clamping pins
      // particles to the wall surface and curl noise then drags them
      // along it. Reflection sends them back into the volume.
      if (next.x >  uBox) next.x =  2.0 * uBox - next.x;
      if (next.x < -uBox) next.x = -2.0 * uBox - next.x;
      if (next.y >  uBox) next.y =  2.0 * uBox - next.y;
      if (next.y < -uBox) next.y = -2.0 * uBox - next.y;
      if (next.z >  uBox) next.z =  2.0 * uBox - next.z;
      if (next.z < -uBox) next.z = -2.0 * uBox - next.z;
      // Safety against extreme dt spikes that would overshoot two walls.
      next = clamp(next, vec3(-uBox * 0.999), vec3(uBox * 0.999));
    }

    gl_FragColor = vec4(next, 1.0);
  }
`;

const RENDER_VS = /* glsl */ `
  uniform sampler2D uPositionTex;
  uniform sampler2D uVelocityTex;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec2 aRef;
  varying float vSpeed;

  void main() {
    vec3 pos = texture2D(uPositionTex, aRef).xyz;
    vec3 vel = texture2D(uVelocityTex, aRef).xyz;
    vSpeed = length(vel);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Distance attenuation so closer particles look bigger.
    gl_PointSize = uSize * uPixelRatio * (1.0 / -mv.z);
  }
`;

const RENDER_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uHotColor;
  uniform vec3 uCoolColor;
  uniform float uIntensity;
  varying float vSpeed;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    // Smooth circular falloff with brightest core.
    float a = exp(-r * 12.0);
    float heat = clamp(vSpeed * 1.4, 0.0, 1.0);
    vec3 col = mix(uCoolColor, uHotColor, heat) * uIntensity * (0.6 + 0.6 * heat);
    gl_FragColor = vec4(col, a);
  }
`;

const RESET_CENTER = new THREE.Vector3(-BOX * 0.82, -BOX * 0.82, -BOX * 0.82);

function GasField() {
  const { gl, size: viewportSize } = useThree();
  const meshRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const cycleAccum = useRef(0);
  const isResetting = useRef(false);
  const resetTimer = useRef(0);

  const { gpgpu, positionVar, velocityVar, geometry } = useMemo(() => {
    const compute = new GPUComputationRenderer(SIM_DIM, SIM_DIM, gl);

    const initPos = compute.createTexture();
    const initVel = compute.createTexture();
    const rnd = mulberry32(91);
    const pData = initPos.image.data as Float32Array;
    const vData = initVel.image.data as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const o = i * 4;
      pData[o + 0] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
      pData[o + 1] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
      pData[o + 2] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
      pData[o + 3] = 1;
      const dx = rnd() - 0.5,
        dy = rnd() - 0.5,
        dz = rnd() - 0.5;
      const m = Math.hypot(dx, dy, dz) || 1;
      const speed = 0.22 + rnd() * 0.18;
      vData[o + 0] = (dx / m) * speed;
      vData[o + 1] = (dy / m) * speed;
      vData[o + 2] = (dz / m) * speed;
      vData[o + 3] = 1;
    }

    const posVar = compute.addVariable("texturePosition", SIM_POSITION_FS, initPos);
    const velVar = compute.addVariable("textureVelocity", SIM_VELOCITY_FS, initVel);
    compute.setVariableDependencies(posVar, [posVar, velVar]);
    compute.setVariableDependencies(velVar, [posVar, velVar]);

    posVar.material.uniforms.uDt = { value: 0 };
    posVar.material.uniforms.uBox = { value: BOX };
    posVar.material.uniforms.uReset = { value: 0 };
    posVar.material.uniforms.uResetCenter = { value: RESET_CENTER };

    velVar.material.uniforms.uDt = { value: 0 };
    velVar.material.uniforms.uTime = { value: 0 };
    velVar.material.uniforms.uBox = { value: BOX };
    velVar.material.uniforms.uCurlStrength = { value: 0.18 };
    velVar.material.uniforms.uDrag = { value: 0.4 };
    velVar.material.uniforms.uReset = { value: 0 };
    velVar.material.uniforms.uResetCenter = { value: RESET_CENTER };

    const err = compute.init();
    if (err) console.error("GPGPU init error:", err);

    // Reference attribute encoding the simulation-texture coordinate
    // for each particle. Persistent — never re-created.
    const refs = new Float32Array(PARTICLE_COUNT * 2);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (i % SIM_DIM) / SIM_DIM;
      const y = Math.floor(i / SIM_DIM) / SIM_DIM;
      refs[i * 2] = x + 0.5 / SIM_DIM;
      refs[i * 2 + 1] = y + 0.5 / SIM_DIM;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3),
    );
    geom.setAttribute("aRef", new THREE.BufferAttribute(refs, 2));
    geom.setDrawRange(0, PARTICLE_COUNT);

    return {
      gpgpu: compute,
      positionVar: posVar,
      velocityVar: velVar,
      geometry: geom,
    };
  }, [gl]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      gpgpu.dispose();
    };
  }, [geometry, gpgpu]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    cycleAccum.current += dt;
    if (!isResetting.current && cycleAccum.current > CYCLE) {
      isResetting.current = true;
      resetTimer.current = 0;
      velocityVar.material.uniforms.uReset.value = 1;
      positionVar.material.uniforms.uReset.value = 1;
    }
    if (isResetting.current) {
      resetTimer.current += dt;
      if (resetTimer.current > RESET_DURATION) {
        isResetting.current = false;
        velocityVar.material.uniforms.uReset.value = 0;
        positionVar.material.uniforms.uReset.value = 0;
        cycleAccum.current = 0;
      }
    }

    positionVar.material.uniforms.uDt.value = dt;
    velocityVar.material.uniforms.uDt.value = dt;
    velocityVar.material.uniforms.uTime.value = state.clock.elapsedTime;

    gpgpu.compute();

    if (matRef.current) {
      const posTex = gpgpu.getCurrentRenderTarget(positionVar).texture;
      const velTex = gpgpu.getCurrentRenderTarget(velocityVar).texture;
      matRef.current.uniforms.uPositionTex.value = posTex;
      matRef.current.uniforms.uVelocityTex.value = velTex;
    }
  });

  const renderUniforms = useMemo(
    () => ({
      uPositionTex: { value: null },
      uVelocityTex: { value: null },
      uSize: { value: 60 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
      uHotColor: { value: new THREE.Color("#ffd9a3") },
      uCoolColor: { value: new THREE.Color(palette.emberFaint) },
      uIntensity: { value: 1.4 },
    }),
    [],
  );

  useEffect(() => {
    renderUniforms.uPixelRatio.value = Math.min(viewportSize.height > 0 ? viewportSize.height / 720 : 1, 1.5);
  }, [renderUniforms, viewportSize]);

  return (
    <points ref={meshRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={RENDER_VS}
        fragmentShader={RENDER_FS}
        uniforms={renderUniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function BoxWire() {
  const geom = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * BOX, 2 * BOX, 2 * BOX)),
    [],
  );
  return (
    <group>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#4a5262" />
      </lineSegments>
      <mesh>
        <boxGeometry args={[2 * BOX, 2 * BOX, 2 * BOX]} />
        <meshBasicMaterial
          color="#0e1119"
          transparent
          opacity={0.28}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

const GHOST_POSITIONS = (() => {
  const rnd = mulberry32(203);
  const M = 55;
  const p = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    p[i * 3] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
    p[i * 3 + 1] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
    p[i * 3 + 2] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
  }
  return p;
})();

function StartingGhost() {
  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[GHOST_POSITIONS, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.07}
          sizeAttenuation
          color="#a06c3c"
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </points>
      <mesh position={[-BOX * 0.82, -BOX * 0.82, -BOX * 0.82]}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial
          color="#e8a96b"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={[-BOX * 0.82, -BOX * 0.82, -BOX * 0.82]}
        color="#ffd9a3"
        intensity={1.2}
        distance={1.6}
      />
    </group>
  );
}

export function Chapter5Scene() {
  return (
    <SceneFrame
      camera={{ position: [2.6, 1.8, 2.9], fov: 44 }}
      bloom={{ intensity: 0.95, threshold: 0.85, smoothing: 0.25 }}
      parallax={{ strength: 0.1 }}
    >
      <BoxWire />
      <StartingGhost />
      <GasField />
    </SceneFrame>
  );
}
