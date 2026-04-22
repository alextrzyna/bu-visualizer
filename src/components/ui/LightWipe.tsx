"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * LightWipe plays a brief luminous-band sweep across the viewport each
 * time a new chapter becomes the "active" one on mobile. It's an
 * orchestration layer that sits above the stack of sticky scenes and
 * masks the moment one scene pins out and the next pins in.
 *
 * Trigger heuristic: an IntersectionObserver watches every
 * `[data-chapter]` section with a rootMargin that only counts the top
 * ~15% of the viewport as "active." When a new chapter's top edge
 * crosses into that band, we record the transition and bump a key,
 * which remounts the band element so the CSS keyframe replays.
 *
 * The first recorded chapter does not trigger a wipe — entering the
 * first chapter from the hero feels like arrival, not transition.
 *
 * Gated on `useIsMobile()` and `prefers-reduced-motion` — desktop
 * readers already get the card-over-sticky-scene experience, and
 * reduced-motion readers get nothing.
 */
export function LightWipe() {
  const isMobile = useIsMobile();
  const [playCount, setPlayCount] = useState(0);
  const lastChapterRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-chapter]"),
    );
    if (els.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number(entry.target.getAttribute("data-chapter"));
          if (!Number.isFinite(idx)) continue;
          if (lastChapterRef.current === idx) continue;
          const prev = lastChapterRef.current;
          lastChapterRef.current = idx;
          if (prev !== null) setPlayCount((c) => c + 1);
        }
      },
      { rootMargin: "-5% 0px -85% 0px", threshold: 0 },
    );
    for (const el of els) obs.observe(el);
    return () => obs.disconnect();
  }, [isMobile]);

  if (!isMobile) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
    >
      {playCount > 0 && (
        <div
          key={playCount}
          className="absolute left-0 right-0 h-[32svh] animate-light-wipe will-change-transform"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(255,225,185,0.10) 40%, rgba(255,225,185,0.22) 50%, rgba(255,225,185,0.10) 60%, transparent 100%)",
            filter: "blur(24px)",
          }}
        />
      )}
    </div>
  );
}
