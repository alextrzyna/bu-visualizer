"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { OrbitControls, Text, Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import { buildWorldline, demo, type LifeData, type TripArc } from "@/lib/worldline";
import { WorldMapPlane } from "./WorldMapPlane";
import { HeatBlobs } from "./HeatBlobs";

type Props = {
  life?: LifeData;
  mode: "block" | "experiential";
  progress: number;
  hovered: number | null;
  onHoverEvent?: (idx: number | null) => void;
};

const COLOR_BY_KIND: Record<string, string> = {
  birth: "#f4f1ea",
  move: "#9ec8e6",
  milestone: "#e8a96b",
  career: "#c9c4b8",
  relationship: "#f1b97e",
  loss: "#b37a7a",
  event: "#c9c4b8",
  present: "#ffffff",
  projection: "#6b675e",
};

function BlockFrame({ size }: { size: [number, number, number] }) {
  const geom = useMemo(() => {
    return new THREE.EdgesGeometry(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
    );
  }, [size]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#2a3140" transparent opacity={0.9} />
    </lineSegments>
  );
}


/**
 * Place-labels pinned at the spacetime coordinate where each location
 * was actually visited — a Trip's destination sits at the y-height of
 * that trip's midpoint, a residence sits at the y-height its stay
 * began. Same place, multiple visits → multiple labels stacked up the
 * block, so the block itself becomes a legend of where-and-when.
 *
 * Labels are drawn quiet so they read as scenery annotation, not as
 * primary content; the hovered event still gets a brighter treatment.
 */
/**
 * Labels one per leg of each trip-cluster arc, pinned at the precise
 * spacetime coordinate where the visit happened. A multi-city trip
 * (Paris→Amsterdam→Prague→Rome, 1996) places four labels stacked up
 * the arc at their respective y-heights.
 */
function PlaceLabels({
  tripArcs,
  progressY,
  inverseScale,
}: {
  tripArcs: ReturnType<typeof buildWorldline>["tripArcs"];
  progressY: number;
  inverseScale: number;
}) {
  return (
    <group>
      {tripArcs.flatMap((arc, i) =>
        arc.legs.map((leg, j) => {
          const isPast = leg.position.y <= progressY;
          return (
            <group
              key={`${i}-${j}`}
              position={[leg.position.x, leg.position.y, leg.position.z]}
              // Inverse-scale X/Z only — the surrounding ZoomGroup
              // scales geography but leaves Y (time) alone, so the
              // label needs matching non-uniform inverse scale to
              // stay pixel-constant.
              scale={[inverseScale, 1, inverseScale]}
            >
              <mesh>
                <sphereGeometry args={[0.018, 10, 10]} />
                <meshBasicMaterial
                  color={isPast ? "#8a5c34" : "#3a4050"}
                  transparent
                  opacity={isPast ? 0.9 : 0.5}
                />
              </mesh>
              <Billboard>
                <Text
                  position={[0, 0.075, 0]}
                  fontSize={0.07}
                  color={isPast ? "#8a8577" : "#4a5262"}
                  anchorX="center"
                  anchorY="bottom"
                  outlineWidth={0.006}
                  outlineColor="#05060a"
                >
                  {leg.place}
                </Text>
              </Billboard>
            </group>
          );
        }),
      )}
    </group>
  );
}

/**
 * Residence labels: one per stay, pinned to the spine at the stay's
 * starting time. Slightly warmer color than trip labels because these
 * are the backbone places, not excursions.
 */
function ResidenceLabels({
  life,
  tToY,
  xzScale = 2.2,
  progressY,
  inverseScale,
}: {
  life: LifeData;
  tToY: ReturnType<typeof buildWorldline>["tToY"];
  xzScale?: number;
  progressY: number;
  inverseScale: number;
}) {
  return (
    <group>
      {life.stays.map((s, i) => {
        const t = new Date(s.start + "T00:00:00Z").getTime();
        const y = tToY(t);
        const x = (s.lon / 180) * xzScale;
        const z = (-s.lat / 90) * xzScale;
        const isPast = y <= progressY;
        return (
          <group
            key={i}
            position={[x, y, z]}
            scale={[inverseScale, 1, inverseScale]}
          >
            <mesh>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshBasicMaterial color={isPast ? "#c9c4b8" : "#4a5262"} />
            </mesh>
            <Billboard>
              <Text
                position={[0, 0.09, 0]}
                fontSize={0.085}
                color={isPast ? "#c9c4b8" : "#6b7486"}
                anchorX="center"
                anchorY="bottom"
                outlineWidth={0.006}
                outlineColor="#05060a"
              >
                {s.place.split(",")[0]}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Relational grooves: each related person (parent, partner, kids)
 * rendered as a thin parallel curve in their own color. They sit
 * inside the same ZoomGroup as the spine so they share the geographic
 * transform.
 *
 * Termination dots mark where a groove ends — a parent's death, a
 * partner's death — making the moment of loss read as a geometric
 * fact rather than just an event label. Birth points (where a child's
 * groove enters the block at their birth event) get a small fork dot
 * so the emergence is visible.
 */
function RelationGrooves({
  grooves,
  progressY,
  inverseScale,
}: {
  grooves: ReturnType<typeof buildWorldline>["relationGrooves"];
  progressY: number;
  inverseScale: number;
}) {
  return (
    <group>
      {grooves.map((g) => {
        // Past portion of the groove draws bright (in its own color);
        // future portion dims, mirroring the spine's past/future
        // contrast so all curves age together.
        const ended = g.endY <= progressY;
        const opacityPast = 0.7;
        const opacityFuture = 0.18;
        // Approximate split: clamp the groove's progress into [0,1]
        // based on where progressY falls between its start and end.
        const span = Math.max(0.0001, g.endY - g.startY);
        const prog = Math.min(
          1,
          Math.max(0, (progressY - g.startY) / span),
        );
        return (
          <group key={g.name}>
            {/* The whole groove tube. We dim the future portion via a
                clipping shader would be ideal but for simplicity we
                just render the entire tube at a per-time opacity that
                reads "more visible up to now, fading after." */}
            <mesh geometry={g.tube}>
              <meshBasicMaterial
                color={g.color}
                transparent
                opacity={
                  prog <= 0
                    ? opacityFuture
                    : prog >= 1
                      ? opacityPast
                      : opacityPast * prog +
                        opacityFuture * (1 - prog)
                }
                depthWrite={false}
              />
            </mesh>
            {/* Identifying label at the groove's start point so the
                colored line reads as "this is the parent / partner /
                child" rather than being mistaken for whatever event
                happens to sit at its terminus. Inverse-scaled to stay
                pixel-constant under the surrounding zoom. */}
            <group
              position={[g.startPos.x, g.startPos.y, g.startPos.z]}
              scale={[inverseScale, 1, inverseScale]}
            >
              {/* Birth/start cap: a small dot where the groove enters
                  the block. For children this is the "fork" moment. */}
              <mesh>
                <sphereGeometry args={[0.022, 14, 14]} />
                <meshBasicMaterial
                  color={g.color}
                  transparent
                  opacity={0.9}
                />
              </mesh>
              <Billboard position={[0, 0.09, 0]}>
                <Text
                  fontSize={0.075}
                  color={g.color}
                  anchorX="center"
                  anchorY="bottom"
                  outlineWidth={0.006}
                  outlineColor="#05060a"
                >
                  {g.name}
                </Text>
              </Billboard>
            </group>
            {/* Termination cap: where a groove ends inside the block
                (parent or partner death). Offset slightly upward off
                the worldline so it doesn't stack on top of the loss
                event dot at the same coordinate, and labelled with
                the relation's name + "·" + "ends" so the visual
                attribution is unambiguous. */}
            {ended && (
              <group
                position={[g.endPos.x, g.endPos.y, g.endPos.z]}
                scale={[inverseScale, 1, inverseScale]}
              >
                <mesh position={[0.18, 0, 0.18]}>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  <meshBasicMaterial
                    color={g.color}
                    transparent
                    opacity={0.95}
                  />
                </mesh>
                <mesh position={[0.18, 0, 0.18]}>
                  <sphereGeometry args={[0.1, 16, 16]} />
                  <meshBasicMaterial
                    color={g.color}
                    transparent
                    opacity={0.25}
                    depthWrite={false}
                  />
                </mesh>
                <Billboard position={[0.18, 0.16, 0.18]}>
                  <Text
                    fontSize={0.07}
                    color={g.color}
                    anchorX="center"
                    anchorY="bottom"
                    outlineWidth={0.006}
                    outlineColor="#05060a"
                  >
                    {g.name} · ends
                  </Text>
                </Billboard>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * The spine: a thin glowing tube for the residence-to-residence path.
 * Split into past and future halves at the progress cut; past is brighter,
 * future is dim so the "already-lived" portion of the block feels
 * substantiated while what's to come is only faintly present.
 */
function Spine({
  curve,
  progress,
}: {
  curve: THREE.CatmullRomCurve3;
  progress: number;
}) {
  const N = 600;
  const { pastGeom, futureGeom } = useMemo(() => {
    const pts = curve.getSpacedPoints(N);
    const cut = Math.min(N - 3, Math.max(3, Math.floor(progress * N)));
    const past = new THREE.CatmullRomCurve3(pts.slice(0, cut + 1));
    const future = new THREE.CatmullRomCurve3(pts.slice(cut));
    return {
      pastGeom: new THREE.TubeGeometry(past, cut, 0.012, 10, false),
      futureGeom: new THREE.TubeGeometry(future, N - cut, 0.012, 10, false),
    };
  }, [curve, progress]);
  useEffect(
    () => () => {
      pastGeom.dispose();
      futureGeom.dispose();
    },
    [pastGeom, futureGeom],
  );
  return (
    <group>
      <mesh geometry={pastGeom}>
        <meshBasicMaterial color="#f4f1ea" transparent opacity={0.95} />
      </mesh>
      <mesh geometry={futureGeom}>
        <meshBasicMaterial color="#c9c4b8" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/**
 * Each trip as a tiny glowing arc. Thin anti-aliased Line — soft,
 * ephemeral, ambient — never competing with the spine.
 */
function TripArcs({
  arcs,
  progressY,
}: {
  arcs: TripArc[];
  progressY: number;
}) {
  const sampled = useMemo(
    () =>
      arcs.map((arc) => {
        const pts: [number, number, number][] = [];
        const samples = 24;
        for (let i = 0; i <= samples; i++) {
          const p = arc.curve.getPoint(i / samples);
          pts.push([p.x, p.y, p.z]);
        }
        const topY = Math.max(...pts.map((p) => p[1]));
        return { pts, topY };
      }),
    [arcs],
  );
  return (
    <group>
      {sampled.map((a, i) => {
        // A trip is "past" if its latest point is below the progress plane.
        const isPast = a.topY <= progressY;
        const color = isPast ? "#e8a96b" : "#6b7486";
        const opacity = isPast ? 0.55 : 0.18;
        return (
          <Line
            key={i}
            points={a.pts}
            color={color}
            lineWidth={1}
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        );
      })}
    </group>
  );
}

/** Events: tiny dots along the spine. Minimal — no halos, no bloom ring,
 * just a small crisp sphere. Label only on hover or for top-significance
 * moments. */
function EventNodes({
  events,
  hovered,
  mode,
  onHover,
  inverseScale,
}: {
  events: ReturnType<typeof buildWorldline>["events"];
  hovered: number | null;
  mode: "block" | "experiential";
  onHover?: (idx: number | null) => void;
  inverseScale: number;
}) {
  return (
    <group>
      {events.map((e, i) => {
        const c = COLOR_BY_KIND[e.kind] ?? "#c9c4b8";
        const size = 0.028 + e.significance * 0.025;
        const isHovered = hovered === i;
        const showLabel =
          mode === "experiential"
            ? isHovered
            : e.significance >= 0.95 || isHovered;
        return (
          <group
            key={i}
            position={e.position}
            scale={[inverseScale, 1, inverseScale]}
          >
            <mesh
              onPointerEnter={() => onHover?.(i)}
              onPointerLeave={() => onHover?.(null)}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshBasicMaterial color={c} />
            </mesh>
            {isHovered && (
              <mesh>
                <sphereGeometry args={[size * 2.4, 16, 16]} />
                <meshBasicMaterial
                  color={c}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                />
              </mesh>
            )}
            {showLabel && (
              <Billboard>
                <Text
                  position={[0, size + 0.08, 0]}
                  fontSize={0.065}
                  color={isHovered ? "#f4f1ea" : "#6b675e"}
                  anchorX="center"
                  anchorY="bottom"
                  maxWidth={2.2}
                >
                  {e.label}
                </Text>
              </Billboard>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** The "now" spotlight: a small, bright, luminous point drifting along
 * the spine. This is the focal element of the scene. */
function NowSpotlight({
  curve,
  progress,
  inverseScale,
}: {
  curve: THREE.CatmullRomCurve3;
  progress: number;
  inverseScale: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = curve.getPointAt(Math.min(1, Math.max(0, progress)));
    const k = 1 - Math.exp(-8 * dt);
    ref.current.position.lerp(p, k);
  });
  return (
    <group ref={ref}>
      {/* Undo only the X/Z zoom (the surrounding group scales
          geography non-uniformly; Y stays 1). Without this the
          spotlight would be squashed into a flat disk at high zoom. */}
      <group scale={[inverseScale, 1, inverseScale]}>
        <mesh>
          <sphereGeometry args={[0.045, 20, 20]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.1, 20, 20]} />
          <meshBasicMaterial
            color="#ffd9a3"
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
        <pointLight color="#ffd9a3" intensity={2.4} distance={1.6} decay={2} />
      </group>
    </group>
  );
}

function CameraRig({
  curve,
  progress,
  mode,
  targetFrame,
}: {
  curve: THREE.CatmullRomCurve3;
  progress: number;
  mode: "block" | "experiential";
  /** Un-damped zoom state. We mirror ZoomGroup's transform to compute
   * the spotlight's *world* position, so the camera actually tracks
   * where the spotlight is rendered (not where its local coordinates
   * would put it ignoring zoom). */
  targetFrame: { centerX: number; centerZ: number; scale: number };
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3(0, 0, 0));
  const tmpWorld = useRef(new THREE.Vector3(0, 0, 0));
  useFrame((_, dt) => {
    if (mode !== "experiential") return;
    const p = curve.getPointAt(Math.min(1, Math.max(0, progress)));
    // Apply the same X/Z scale + center offset that ZoomGroup applies
    // to its content. Y is preserved (time is not zoomed).
    tmpWorld.current.set(
      (p.x - targetFrame.centerX) * targetFrame.scale,
      p.y,
      (p.z - targetFrame.centerZ) * targetFrame.scale,
    );
    // First-person-ish framing: camera sits close to the spotlight,
    // up + diagonal so the worldline reads going past below us.
    desired.current.set(
      tmpWorld.current.x + 2.6,
      tmpWorld.current.y + 1.6,
      tmpWorld.current.z + 2.6,
    );
    const k = 1 - Math.exp(-3.5 * dt);
    camera.position.lerp(desired.current, k);
    target.current.lerp(tmpWorld.current, 1 - Math.exp(-4.5 * dt));
    camera.lookAt(target.current);
  });
  return null;
}

/**
 * Wrapper that applies the dynamic-zoom transform every frame. All
 * geographic content lives inside this group, so zooming/panning the
 * scene doesn't require each child to know anything about the frame.
 *
 * World-transform for a point P (given target centerX/centerZ/scale):
 *   P' = (P - centerXZ) · scale
 * Implemented via group.scale and group.position so Three's matrix math
 * composes correctly.
 */
function ZoomGroup({
  meta,
  progress,
  children,
}: {
  meta: ReturnType<typeof buildWorldline>;
  progress: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const state = useRef({ scale: 1, cx: 0, cz: 0 });
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    const atTime = meta.t0 + progress * (meta.tEnd - meta.t0);
    const target = meta.computeFrame(atTime);
    const k = 1 - Math.exp(-2.5 * dt);
    state.current.scale += (target.scale - state.current.scale) * k;
    state.current.cx += (target.centerX - state.current.cx) * k;
    state.current.cz += (target.centerZ - state.current.cz) * k;
    const { scale, cx, cz } = state.current;
    // Scale only the geographic axes (X, Z). Y is time — it must stay
    // aligned with the block frame and the map plane so the "now"
    // spotlight always intersects the plane at progressY, regardless
    // of how deep we're zoomed into local geography.
    groupRef.current.scale.set(scale, 1, scale);
    groupRef.current.position.set(-cx * scale, 0, -cz * scale);
  });
  return <group ref={groupRef}>{children}</group>;
}

export function LifeScene({
  life = demo,
  mode,
  progress,
  hovered,
  onHoverEvent,
}: Props) {
  const meta = useMemo(
    () => buildWorldline(life, { yExtent: 3, xzScale: 2.2 }),
    [life],
  );
  const extentY = meta.yRange[1] - meta.yRange[0];
  const progressY = useMemo(() => {
    const p = meta.spine.getPointAt(Math.min(1, Math.max(0, progress)));
    return p.y;
  }, [meta.spine, progress]);

  // Current subjective time for the heat-map activity window.
  const atTime = meta.t0 + progress * (meta.tEnd - meta.t0);

  // Target (un-damped) zoom for the current progress, used to size the
  // HeatBlobs. The visible zoom is damped by ZoomGroup; the blobs'
  // sizing may lag slightly but that reads as a natural smoothing
  // rather than a visible pop.
  const targetFrame = useMemo(
    () => meta.computeFrame(atTime),
    [meta, atTime],
  );

  return (
    <div className="relative w-full h-full">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [5.2, 3.2, 5.6], fov: 38 }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(14,18,26,0.65), rgba(5,6,8,1) 78%)",
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 5]} intensity={0.55} />
        <BlockFrame size={[4.6, extentY, 4.6]} />

        {/* Map plane lives OUTSIDE the zoom group: it stays at fixed
           size but its texture UV is panned/scaled to show the same
           geographic region that the zoomed content is centered on. */}
        <WorldMapPlane
          y={progressY}
          xzScale={2.2}
          opacity={0.32}
          zoomScale={targetFrame.scale}
          centerX={targetFrame.centerX}
          centerZ={targetFrame.centerZ}
        />

        <ZoomGroup meta={meta} progress={progress}>
          <HeatBlobs
            microLocations={meta.microLocations}
            atTime={atTime}
            y={progressY + 0.001}
            zoomScale={targetFrame.scale}
          />
          <TripArcs arcs={meta.tripArcs} progressY={progressY} />
          <RelationGrooves
            grooves={meta.relationGrooves}
            progressY={progressY}
            inverseScale={1 / targetFrame.scale}
          />
          <Spine curve={meta.spine} progress={progress} />
          <PlaceLabels
            tripArcs={meta.tripArcs}
            progressY={progressY}
            inverseScale={1 / targetFrame.scale}
          />
          <ResidenceLabels
            life={life}
            tToY={meta.tToY}
            progressY={progressY}
            inverseScale={1 / targetFrame.scale}
          />
          <EventNodes
            events={meta.events}
            hovered={hovered}
            mode={mode}
            onHover={onHoverEvent}
            inverseScale={1 / targetFrame.scale}
          />
          <NowSpotlight
            curve={meta.spine}
            progress={progress}
            // X/Z are zoomed non-uniformly; apply inverse only on
            // those axes so the spotlight stays a round sphere
            // rather than a cigar when the block is zoomed in.
            inverseScale={1 / targetFrame.scale}
          />
        </ZoomGroup>

        <CameraRig
          curve={meta.spine}
          progress={progress}
          mode={mode}
          targetFrame={targetFrame}
        />
        {mode === "block" && (
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={4.8}
            maxDistance={16}
            autoRotate
            autoRotateSpeed={0.22}
          />
        )}
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={0.5}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.28} darkness={0.72} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
