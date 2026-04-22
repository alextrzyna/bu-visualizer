"use client";

import { useState } from "react";
import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import {
  Chapter2Scene,
  Chapter2Controls,
} from "@/components/scenes/Chapter2_Simultaneity";
import { useSmoothed } from "@/lib/useSmoothed";

export function Chapter2() {
  const [v, setV] = useState(0);
  const smoothV = useSmoothed(v, 7);
  return (
    <FullBleedChapter
      index={2}
      eyebrow="Chapter Two · Relativity"
      title="Simultaneity is not absolute."
      scene={
        <div className="absolute inset-0">
          <Chapter2Scene v={smoothV} />
          {/* Floating slider overlay — sits above the scene, below the
              card's vertical midline, on the left so it never overlaps
              the right-side prose card. */}
          <div className="absolute bottom-8 left-6 sm:left-10 lg:left-14 pointer-events-auto w-full max-w-sm">
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)] bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] px-5 py-4">
              <Chapter2Controls v={v} onChange={setV} />
            </div>
          </div>
        </div>
      }
      cardSide="right"
    >
      <p>
        In 1905, Einstein noticed a crack in what everyone else had
        taken for granted. If the speed of light is the same for every
        observer — a consequence of Maxwell’s equations and, since
        confirmed in experiment after experiment{" "}
        <a href="/references#michelson">[1]</a> — then observers in
        relative motion cannot, in general, agree on whether two distant
        events happened at the same time.
      </p>
      <p>
        The diagram is a{" "}
        <strong>Minkowski spacetime diagram</strong>
        <a href="/references#minkowski">[2]</a>. The horizontal axis is
        space; the vertical is time; the two diagonal blue lines are the
        paths of light rays (setting <span className="font-mono">c = 1</span>).
        Two events, <em>A</em> and <em>B</em>, sit at the same height —
        simultaneous in the stationary frame.
      </p>
      <p>
        Drag the slider at the bottom-left and give the observer a
        velocity. Their <em>plane of simultaneity</em> — the set of
        events they consider to be happening <em>now</em> — tilts. For
        them, <em>A</em> and <em>B</em> are no longer at the same time.
      </p>
    </FullBleedChapter>
  );
}
