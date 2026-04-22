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

/**
 * A relation — another life braided alongside this one. The schema is
 * intentionally a mini-LifeData: birthDate, optional deathDate,
 * residences (stays), and excursions (trips). Each becomes its own
 * spine + trip-arc bundle, rendered the same way as the focal life
 * but thinner and in the relation's color. The advantage over a
 * crude "always-parallel column" is that each relation's groove
 * shows where they actually were — which means parallelism with the
 * focal life emerges naturally only when the data warrants it
 * (overlapping residence in childhood, shared trips, the rare
 * intersecting visit).
 */
export type LifeRelation = {
  name: string;
  kind: "parent" | "spouse" | "child" | "friend";
  /** Hex color for the groove tube. */
  color: string;
  birthDate: string;
  /** Omitted means "still alive at projectedEndDate". */
  deathDate?: string;
  stays: LifeStay[];
  trips?: LifeTrip[];
};

/** Everything the renderer needs for a single relation's groove. */
export type RelationGroove = {
  name: string;
  kind: LifeRelation["kind"];
  color: string;
  birthDate: string;
  deathDate?: string;
  /** Their residence-to-residence spine over the visible time range. */
  spine: THREE.CatmullRomCurve3;
  spineTube: THREE.TubeGeometry;
  /** Trip arcs (home → destination → home) clustered like Greg's. */
  tripArcs: TripArc[];
  /** Y-coordinates for the relation's first appearance and exit. */
  startY: number;
  endY: number;
  /** First/last 3D points so the renderer can place birth + death caps. */
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
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
  relations?: LifeRelation[];
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

  /**
   * Build a (spine, tripArcs) bundle from a stays + trips dataset and
   * a date range. Re-used for both the focal life and each relation,
   * so every braided groove on screen is constructed by the same
   * geometric logic. Stays and trips are clipped to [tBlockStart,
   * tBlockEnd] so a relation born long before the focal life or
   * outliving the projected end of the block is naturally truncated.
   */
  function buildSpineAndArcs(
    stays: LifeStay[],
    trips: LifeTrip[],
    tBlockStart: number,
    tBlockEnd: number,
    extendToTop = false,
  ): { spine: THREE.CatmullRomCurve3; tripArcs: TripArc[]; pts: THREE.Vector3[] } {
    // --- spine ---
    const visibleStays = stays.filter((s) => {
      const a = dateToTime(s.start);
      const b = dateToTime(s.end);
      return b >= tBlockStart && a <= tBlockEnd;
    });
    const spinePts: THREE.Vector3[] = [];
    for (const s of visibleStays) {
      const tStart = Math.max(dateToTime(s.start), tBlockStart);
      spinePts.push(placeToV3(s.lon, s.lat, tToY(tStart)));
    }
    if (visibleStays.length > 0) {
      const lastStay = visibleStays[visibleStays.length - 1];
      const tStop = Math.min(dateToTime(lastStay.end), tBlockEnd);
      spinePts.push(placeToV3(lastStay.lon, lastStay.lat, tToY(tStop)));
      // For the focal life, extend the spine to the top of the block
      // so the projected-future portion exists.
      if (extendToTop && tStop < tBlockEnd) {
        spinePts.push(placeToV3(lastStay.lon, lastStay.lat, yExtent));
      }
    }
    // Two-point CatmullRom curves degenerate; ensure at least 3.
    while (spinePts.length < 3 && spinePts.length > 0) {
      const last = spinePts[spinePts.length - 1].clone();
      last.y += 0.001;
      spinePts.push(last);
    }
    const spine =
      spinePts.length >= 2
        ? new THREE.CatmullRomCurve3(spinePts, false, "centripetal", 0.5)
        : new THREE.CatmullRomCurve3(
            [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0, 0.001, 0),
            ],
            false,
            "centripetal",
            0.5,
          );

    // --- trip arcs ---
    // Cluster adjacent-in-time trips into a single multi-leg journey
    // so we don't absurdly hop home between consecutive European
    // cities of the same trip.
    const sorted = [...trips]
      .filter((tr) => {
        const a = dateToTime(tr.start);
        const b = dateToTime(tr.end);
        return b >= tBlockStart && a <= tBlockEnd;
      })
      .sort((a, b) => dateToTime(a.start) - dateToTime(b.start));
    const GAP = 1.5 * 24 * 3600 * 1000;
    const clusters: LifeTrip[][] = [];
    for (const tr of sorted) {
      const last = clusters[clusters.length - 1];
      if (
        last &&
        dateToTime(tr.start) - dateToTime(last[last.length - 1].end) <= GAP
      ) {
        last.push(tr);
      } else {
        clusters.push([tr]);
      }
    }
    const arcs: TripArc[] = clusters
      .map((cluster) => {
        const tStart = dateToTime(cluster[0].start);
        const tEnd_ = dateToTime(cluster[cluster.length - 1].end);
        const home = residenceAt(visibleStays, tStart);
        if (!home) return null;
        const pHomeStart = placeToV3(home.lon, home.lat, tToY(tStart));
        const pHomeEnd = placeToV3(home.lon, home.lat, tToY(tEnd_));
        const legs = cluster.map((tr) => {
          const tLegMid =
            (dateToTime(tr.start) + dateToTime(tr.end)) / 2;
          return {
            place: tr.place,
            position: placeToV3(tr.lon, tr.lat, tToY(tLegMid)),
          };
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
      })
      .filter((a): a is TripArc => a !== null);

    return { spine, tripArcs: arcs, pts: spinePts };
  }

  const tBlockStart = t0;
  const tBlockEnd = tEnd;

  const focal = buildSpineAndArcs(
    life.stays,
    life.trips,
    tBlockStart,
    tBlockEnd,
    true,
  );
  const spine = focal.spine;
  const spinePts = focal.pts;
  const tripArcs = focal.tripArcs;

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

  // --- relational grooves ---
  // Each relation gets its own (spine, tripArcs) bundle, built by the
  // exact same logic as the focal life. Their groove is rendered only
  // for the portion of their existence that falls inside our visible
  // block (max[birthDate, t0] .. min[deathDate, tEnd]). This means a
  // parent who outlived Greg's birth shows from Greg's birth onward;
  // a child shows from their birth onward; a partner shows from their
  // own birth (which may predate "meets Greg") so their pre-Greg life
  // is geometrically present in the block, just elsewhere.
  const relationGrooves: RelationGroove[] = (life.relations ?? [])
    .map((r): RelationGroove | null => {
      const tBirth = dateToTime(r.birthDate);
      const tDeath = r.deathDate ? dateToTime(r.deathDate) : tBlockEnd;
      const tFrom = Math.max(tBirth, tBlockStart);
      const tTo = Math.min(tDeath, tBlockEnd);
      if (tTo <= tFrom) return null;
      const built = buildSpineAndArcs(
        r.stays,
        r.trips ?? [],
        tFrom,
        tTo,
        false,
      );
      if (built.pts.length === 0) return null;
      const tube = new THREE.TubeGeometry(
        built.spine,
        Math.max(60, built.pts.length * 60),
        0.006,
        8,
        false,
      );
      const out: RelationGroove = {
        name: r.name,
        kind: r.kind,
        color: r.color,
        birthDate: r.birthDate,
        spine: built.spine,
        spineTube: tube,
        tripArcs: built.tripArcs,
        startY: tToY(tFrom),
        endY: tToY(tTo),
        startPos: built.pts[0],
        endPos: built.pts[built.pts.length - 1],
      };
      if (r.deathDate) out.deathDate = r.deathDate;
      return out;
    })
    .filter((g) => g !== null) as RelationGroove[];

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
    /** Curves for related people (parent, spouse, children) braided
     * alongside the focal life. */
    relationGrooves,
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
