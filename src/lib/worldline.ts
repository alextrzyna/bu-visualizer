import demoLife from "@/data/demo-life.json";
import * as THREE from "three";

/**
 * Build a worldline visualization from a life dataset.
 *
 * Two layers:
 *   (1) the `spine` — a calm curve through the person's *residences only*,
 *       traced in chronological order. This is the core trajectory.
 *   (2) `tripArcs` — each a gentle arc from the home-of-the-moment out to
 *       the trip destination and back, rendered as thin, faint overlays.
 *
 * Separating these fixes the "spaghetti" look that you get when you try
 * to snake one single tube through every location: residences stay stately,
 * trips become brief excursions rather than violent detours.
 *
 * Time maps to the vertical axis; (lon, lat) map to (x, z) on the
 * horizontal plane via a plain equirectangular projection — emotional
 * geography, not cartography.
 */

export type LifeStay = {
  start: string;
  end: string;
  lat: number;
  lon: number;
  place: string;
  label?: string;
};

export type LifeTrip = LifeStay;

export type LifeEvent = {
  date: string;
  lat: number;
  lon: number;
  kind: string;
  label: string;
  significance: number;
};

export type MicroLocation = {
  name: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  /** 0..1 relative "amount of presence" — drives heat-map blob strength. */
  intensity: number;
  context?: string;
};

export type LifeData = {
  person: {
    name: string;
    birthDate: string;
    referenceDate: string;
    /**
     * Optional. If supplied, this is the date that anchors the top of
     * the block — i.e. the projected end of the life. If omitted, we
     * fall back to `referenceDate + opts.futureYears`.
     */
    projectedEndDate?: string;
    description: string;
  };
  stays: LifeStay[];
  trips: LifeTrip[];
  events: LifeEvent[];
  micro_locations?: MicroLocation[];
};

export const demo: LifeData = demoLife as LifeData;

function dateToTime(d: string): number {
  return new Date(d + "T00:00:00Z").getTime();
}

function residenceAt(stays: LifeStay[], t: number): LifeStay | null {
  for (const s of stays) {
    if (t >= dateToTime(s.start) && t <= dateToTime(s.end)) return s;
  }
  return stays[0] ?? null;
}

export function project(lon: number, lat: number): [number, number] {
  return [lon / 180, -lat / 90];
}

export type TripArc = {
  curve: THREE.CatmullRomCurve3;
  start: string;
  end: string;
  /** Labels anchored to the arc at the y-heights of each visited city. */
  legs: Array<{ place: string; position: THREE.Vector3 }>;
};

/** Options for shaping the scene. */
export type BuildOptions = {
  yExtent?: number;
  xzScale?: number;
  futureYears?: number;
};

export function buildWorldline(
  life: LifeData = demo,
  opts: BuildOptions = {},
) {
  const yExtent = opts.yExtent ?? 3;
  const xzScale = opts.xzScale ?? 2.2;
  const futureYears = opts.futureYears ?? 25;

  const t0 = dateToTime(life.person.birthDate);
  const tRef = dateToTime(life.person.referenceDate);
  // Anchor the top of the block at the projected end of life if the
  // dataset supplies one; otherwise fall back to `futureYears` past
  // the reference date.
  const tEnd = life.person.projectedEndDate
    ? dateToTime(life.person.projectedEndDate)
    : tRef + futureYears * 365.25 * 24 * 3600 * 1000;

  const tToY = (t: number): number => {
    const u = (t - t0) / (tEnd - t0);
    return -yExtent + u * 2 * yExtent;
  };

  const placeToV3 = (lon: number, lat: number, y: number): THREE.Vector3 => {
    const [x, z] = project(lon, lat);
    return new THREE.Vector3(x * xzScale, y, z * xzScale);
  };

  // --- spine: residences only, in chronological order ---
  // One point at the start of each stay. The last stay gets both a
  // "reference date" waypoint (today) and a final projection-future
  // point at yExtent so the curve reaches the top of the block.
  const spinePts: THREE.Vector3[] = [];
  for (const s of life.stays) {
    spinePts.push(placeToV3(s.lon, s.lat, tToY(dateToTime(s.start))));
  }
  const lastStay = life.stays[life.stays.length - 1];
  spinePts.push(placeToV3(lastStay.lon, lastStay.lat, tToY(tRef)));
  spinePts.push(placeToV3(lastStay.lon, lastStay.lat, yExtent));

  const spine = new THREE.CatmullRomCurve3(
    spinePts,
    false,
    "centripetal",
    0.5,
  );

  // --- trip arcs ---
  // Cluster adjacent-in-time trips into a single multi-leg journey so
  // the worldline doesn't absurdly hop home between consecutive European
  // cities in the same continuous trip. A new cluster starts when the
  // gap between a trip's end and the next trip's start exceeds a day.
  const trips = [...life.trips].sort(
    (a, b) => dateToTime(a.start) - dateToTime(b.start),
  );
  const GAP_THRESHOLD_MS = 1.5 * 24 * 3600 * 1000;
  const clusters: LifeTrip[][] = [];
  for (const tr of trips) {
    const last = clusters[clusters.length - 1];
    if (
      last &&
      dateToTime(tr.start) - dateToTime(last[last.length - 1].end) <=
        GAP_THRESHOLD_MS
    ) {
      last.push(tr);
    } else {
      clusters.push([tr]);
    }
  }

  const tripArcs: TripArc[] = clusters.map((cluster) => {
    const tStart = dateToTime(cluster[0].start);
    const tEnd_ = dateToTime(cluster[cluster.length - 1].end);
    const home = residenceAt(life.stays, tStart)!;
    const pHomeStart = placeToV3(home.lon, home.lat, tToY(tStart));
    const pHomeEnd = placeToV3(home.lon, home.lat, tToY(tEnd_));

    // Each leg contributes a waypoint at its own midpoint in time,
    // located at its own geographic coordinates. Labels anchor to
    // these waypoints so multi-city trips show every city visited.
    const legs = cluster.map((tr) => {
      const tLegStart = dateToTime(tr.start);
      const tLegEnd = dateToTime(tr.end);
      const tLegMid = (tLegStart + tLegEnd) / 2;
      const position = placeToV3(tr.lon, tr.lat, tToY(tLegMid));
      return { place: tr.place, position };
    });

    const curve = new THREE.CatmullRomCurve3(
      [pHomeStart, ...legs.map((l) => l.position), pHomeEnd],
      false,
      "centripetal",
      0.5,
    );
    return {
      curve,
      start: cluster[0].start,
      end: cluster[cluster.length - 1].end,
      legs,
    };
  });

  // --- events ---
  const events = life.events.map((e) => {
    const [ex, ez] = project(e.lon, e.lat);
    return {
      ...e,
      position: new THREE.Vector3(
        ex * xzScale,
        tToY(dateToTime(e.date)),
        ez * xzScale,
      ),
      t: tToY(dateToTime(e.date)),
    };
  });

  // --- micro-locations ---
  const microLocations = (life.micro_locations ?? []).map((m) => {
    const [x, z] = project(m.lon, m.lat);
    return {
      ...m,
      position: new THREE.Vector3(x * xzScale, 0, z * xzScale),
      tStart: dateToTime(m.start),
      tEnd: dateToTime(m.end),
    };
  });

  /**
   * Compute the "where should the camera be looking right now" frame
   * for a given subjective time. We gather every stay, trip, and
   * micro-location whose date window overlaps a sliding ±windowYears
   * band around `atTime`, then compute a weighted bounding box over
   * their lat/lon. Returns a center (lat, lon) and a scale factor
   * meant to be applied to all geographic content so the bounding box
   * fills a comfortable fraction of the block.
   *
   * When Greg is in Seattle full-time with occasional work trips,
   * the box collapses onto Seattle and scale jumps to ~10x; during
   * global backpacking months it widens out and scale drops toward 1.
   */
  function computeFrame(atTime: number) {
    // Score every point by (a) what kind of point it is (home vs trip
    // vs micro-location) and (b) how temporally close it is to `atTime`.
    // The weighted bbox naturally zooms out when an active trip is
    // happening (because the trip destination contributes full weight
    // alongside home) and snaps back to home as the trip ends.
    type Pt = { lat: number; lon: number; weight: number };
    const pts: Pt[] = [];
    const MS_DAY = 24 * 3600 * 1000;

    // --- the home of the moment: always present, always heavy ---
    const home = residenceAt(life.stays, atTime);
    if (home) {
      pts.push({ lat: home.lat, lon: home.lon, weight: 1000 });
    }

    // --- trips: gaussian-weighted by temporal proximity ---
    // A trip "happening now" gets full weight. A trip ended 6 months
    // ago contributes half. A trip a year out has near-zero weight.
    for (const tr of life.trips) {
      const tStart = dateToTime(tr.start);
      const tEnd_ = dateToTime(tr.end);
      // Distance, in days, from atTime to the nearest moment of the trip
      // (zero while the trip is happening).
      const distMs =
        atTime < tStart
          ? tStart - atTime
          : atTime > tEnd_
            ? atTime - tEnd_
            : 0;
      const distDays = distMs / MS_DAY;
      const sigmaDays = 90; // trips smoothly fade in/out over ~3 months
      const proximity = Math.exp(
        -(distDays * distDays) / (2 * sigmaDays * sigmaDays),
      );
      if (proximity < 0.04) continue;
      // While the trip is active (distDays = 0) weight = 900, slightly
      // less than home so when the traveler is far from home both
      // contribute and the bbox encompasses the round trip.
      pts.push({ lat: tr.lat, lon: tr.lon, weight: 900 * proximity });
    }

    // --- micro-locations: weight by temporal overlap with a ±1y window ---
    const winMs = 365 * MS_DAY;
    const winLo = atTime - winMs;
    const winHi = atTime + winMs;
    for (const m of life.micro_locations ?? []) {
      const mStart = dateToTime(m.start);
      const mEnd = dateToTime(m.end);
      if (mEnd < winLo || mStart > winHi) continue;
      const overlap =
        Math.min(mEnd, winHi) - Math.max(mStart, winLo);
      const days = Math.max(1, overlap / MS_DAY);
      pts.push({
        lat: m.lat,
        lon: m.lon,
        // Micro-locations dominate while at home — home + ~25 micro
        // locations all clustered within ~0.3° pulls the bbox very
        // tight on the home neighborhood.
        weight: days * m.intensity * 8,
      });
    }

    if (pts.length === 0) {
      return { centerX: 0, centerZ: 0, scale: 1 };
    }

    // Weighted centroid.
    const totalW = pts.reduce((a, p) => a + p.weight, 0);
    const wLatCentroid =
      pts.reduce((a, p) => a + p.lat * p.weight, 0) / totalW;
    const wLonCentroid =
      pts.reduce((a, p) => a + p.lon * p.weight, 0) / totalW;

    // Weighted RMS spread — no local-radius filter, so far-flung
    // active trips contribute to the spread (zooming out to include
    // them). The home + micro-location cluster is heavy enough to
    // pull the spread back in once the trip ends.
    const rmsLat = Math.sqrt(
      pts.reduce(
        (a, p) => a + p.weight * (p.lat - wLatCentroid) ** 2,
        0,
      ) / totalW,
    );
    const rmsLon = Math.sqrt(
      pts.reduce(
        (a, p) => a + p.weight * (p.lon - wLonCentroid) ** 2,
        0,
      ) / totalW,
    );

    // Floor: never zoom past tight neighborhood scale; ceiling is
    // implicit in the global cap of scale ≤ 60.
    const spreadLat = Math.max(rmsLat * 3, 0.35);
    const spreadLon = Math.max(rmsLon * 3, 0.55);

    const normSpan = Math.max(spreadLon / 180, spreadLat / 90, 0.005);
    const scale = Math.min(60, Math.max(1, 0.65 / normSpan));

    const [cx, cz] = project(wLonCentroid, wLatCentroid);
    return {
      centerX: cx * xzScale,
      centerZ: cz * xzScale,
      scale,
    };
  }

  return {
    /** The core residence-to-residence curve. */
    spine,
    /** Spine control points — useful for anchor dots. */
    spinePoints: spinePts,
    /** One gentle arc per trip. */
    tripArcs,
    /** Annotated event positions. */
    events,
    /** Micro-locations with projected positions and ms timestamps. */
    microLocations,
    yRange: [-yExtent, yExtent] as const,
    t0,
    tEnd,
    tRef,
    tToY,
    project: (lon: number, lat: number) => {
      const [x, z] = project(lon, lat);
      return new THREE.Vector3(x * xzScale, 0, z * xzScale);
    },
    computeFrame,
  };
}
