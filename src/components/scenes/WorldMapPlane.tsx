"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { feature } from "topojson-client";
import type {
  Topology,
  GeometryCollection as TopoGeomCollection,
} from "topojson-specification";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import landTopology from "world-atlas/land-50m.json";

/**
 * Translucent world-map plane that rides the block vertically with
 * `progressY` and "zooms" to the currently-framed geographic region.
 *
 * Approach: instead of UV-panning a fixed global texture (which goes
 * blurry at high zoom), we re-rasterize the canvas texture each time
 * the zoom state changes substantially. The canvas always draws the
 * currently-visible lon/lat range at full 4096×2048 resolution, so
 * sharpness is independent of zoom — from full-world (1x) to tight
 * city view (~60x) we always see a crisp coastline.
 *
 * The rebuild is debounced so we don't redraw every frame; typical
 * redraws happen only when the scrubber has moved enough to shift
 * the visible region meaningfully.
 */

// Decode the Natural Earth landmass topology once at module load.
type TopoLand = Topology<{ land: TopoGeomCollection }>;
const LAND_FEATURES: FeatureCollection<Polygon | MultiPolygon> = feature(
  landTopology as unknown as TopoLand,
  (landTopology as unknown as TopoLand).objects.land,
) as FeatureCollection<Polygon | MultiPolygon>;

// Precompute each polygon ring's bounding box so we can cheaply cull
// features outside the current visible range before drawing.
type Ring = { coords: number[][]; minLon: number; maxLon: number; minLat: number; maxLat: number };
type PrepPoly = { rings: Ring[]; minLon: number; maxLon: number; minLat: number; maxLat: number };
const PREP_POLYGONS: PrepPoly[] = [];
for (const feat of LAND_FEATURES.features) {
  const geom = feat.geometry;
  const polys: number[][][][] =
    geom.type === "Polygon"
      ? [geom.coordinates as number[][][]]
      : (geom.coordinates as number[][][][]);
  for (const polygon of polys) {
    let pMinLon = Infinity,
      pMaxLon = -Infinity,
      pMinLat = Infinity,
      pMaxLat = -Infinity;
    const prepRings: Ring[] = [];
    for (const ring of polygon) {
      let rMinLon = Infinity,
        rMaxLon = -Infinity,
        rMinLat = Infinity,
        rMaxLat = -Infinity;
      for (const [lon, lat] of ring) {
        if (lon < rMinLon) rMinLon = lon;
        if (lon > rMaxLon) rMaxLon = lon;
        if (lat < rMinLat) rMinLat = lat;
        if (lat > rMaxLat) rMaxLat = lat;
      }
      prepRings.push({ coords: ring, minLon: rMinLon, maxLon: rMaxLon, minLat: rMinLat, maxLat: rMaxLat });
      if (rMinLon < pMinLon) pMinLon = rMinLon;
      if (rMaxLon > pMaxLon) pMaxLon = rMaxLon;
      if (rMinLat < pMinLat) pMinLat = rMinLat;
      if (rMaxLat > pMaxLat) pMaxLat = rMaxLat;
    }
    PREP_POLYGONS.push({ rings: prepRings, minLon: pMinLon, maxLon: pMaxLon, minLat: pMinLat, maxLat: pMaxLat });
  }
}

type Bounds = { minLon: number; maxLon: number; minLat: number; maxLat: number };

function computeBounds(
  centerLonUnit: number,
  centerLatUnit: number,
  scale: number,
): Bounds {
  // centerLonUnit/centerLatUnit: centers in the same world units as
  // the scene (lon/180, -lat/90, multiplied by xzScale). We invert to
  // get lon/lat then expand to the half-span implied by scale.
  const centerLon = centerLonUnit * 180;
  const centerLat = -centerLatUnit * 90;
  // At scale=1, half-span is 180° lon × 90° lat (full world).
  const halfLon = 180 / scale;
  const halfLat = 90 / scale;
  return {
    minLon: centerLon - halfLon,
    maxLon: centerLon + halfLon,
    minLat: centerLat - halfLat,
    maxLat: centerLat + halfLat,
  };
}

function drawMap(
  canvas: HTMLCanvasElement,
  bounds: Bounds,
  landColor = "#c9c4b8",
  strokeColor = "rgba(244,241,234,0.28)",
): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = landColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(0.6, 1.2 / Math.sqrt(Math.max(1, bounds.maxLon - bounds.minLon) / 360));
  ctx.lineJoin = "round";

  const { minLon, maxLon, minLat, maxLat } = bounds;
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const lonToX = (lon: number) => ((lon - minLon) / lonRange) * w;
  const latToY = (lat: number) => ((maxLat - lat) / latRange) * h;

  for (const poly of PREP_POLYGONS) {
    // Cull entirely-out-of-view polygons cheaply.
    if (
      poly.maxLon < minLon ||
      poly.minLon > maxLon ||
      poly.maxLat < minLat ||
      poly.minLat > maxLat
    ) {
      continue;
    }
    ctx.beginPath();
    for (const ring of poly.rings) {
      if (
        ring.maxLon < minLon ||
        ring.minLon > maxLon ||
        ring.maxLat < minLat ||
        ring.minLat > maxLat
      ) {
        continue;
      }
      for (let i = 0; i < ring.coords.length; i++) {
        const [lon, lat] = ring.coords[i];
        const x = lonToX(lon);
        const y = latToY(lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill("evenodd");
    ctx.stroke();
  }
}

export function WorldMapPlane({
  y,
  xzScale = 2.2,
  opacity = 0.28,
  zoomScale = 1,
  centerX = 0,
  centerZ = 0,
}: {
  y: number;
  xzScale?: number;
  opacity?: number;
  zoomScale?: number;
  centerX?: number;
  centerZ?: number;
}) {

  const meshRef = useRef<THREE.Mesh>(null);
  const planeW = 2 * xzScale;
  const planeH = 2 * xzScale;

  // Initialize state to the *target* values so the first rendered
  // frame is correctly framed (previously we started at scale=1 and
  // damped, which looked like the map was zooming out → in on load).
  const state = useRef({
    y: y,
    scale: zoomScale,
    cx: centerX,
    cz: centerZ,
  });
  const lastRendered = useRef<Bounds | null>(null);

  const redraw = (force = false) => {
    // Resolve the shared renderer inside the callback so the lint
    // doesn't treat it as a render-captured mutable value.
    const r = getRenderer();
    const bounds = computeBounds(
      state.current.cx / xzScale,
      state.current.cz / xzScale,
      state.current.scale,
    );
    const last = lastRendered.current;
    const boundsWidth = bounds.maxLon - bounds.minLon;
    const changeEps = boundsWidth * 0.02;
    const needs =
      force ||
      last === null ||
      Math.abs(last.minLon - bounds.minLon) > changeEps ||
      Math.abs(last.maxLon - bounds.maxLon) > changeEps ||
      Math.abs(last.minLat - bounds.minLat) > changeEps * 0.5 ||
      Math.abs(last.maxLat - bounds.maxLat) > changeEps * 0.5;
    if (!needs) return;
    drawMap(r.canvas, bounds);
    r.texture.needsUpdate = true;
    lastRendered.current = bounds;
  };

  // First render: rasterize immediately for the right initial view.
  useEffect(() => {
    redraw(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const k = 1 - Math.exp(-5 * dt);
    state.current.y += (y - state.current.y) * k;
    state.current.scale += (zoomScale - state.current.scale) * k;
    state.current.cx += (centerX - state.current.cx) * k;
    state.current.cz += (centerZ - state.current.cz) * k;
    meshRef.current.position.y = state.current.y;
    redraw(false);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial
        map={getRenderer().texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

type Renderer = { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture };
let sharedRenderer: Renderer | null = null;
function getRenderer(): Renderer {
  if (sharedRenderer === null) {
    const c = document.createElement("canvas");
    c.width = 4096;
    c.height = 2048;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    sharedRenderer = { canvas: c, texture: t };
  }
  return sharedRenderer;
}
