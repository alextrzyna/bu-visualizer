"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Nav } from "@/components/ui/Nav";
import { LifeScene } from "@/components/scenes/LifeScene";
import { demo, buildWorldline } from "@/lib/worldline";
import { cn } from "@/lib/cn";

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(day)}, ${y}`;
}

export default function YourLifePage() {
  const life = demo;
  const meta = useMemo(() => buildWorldline(life), [life]);

  const [mode, setMode] = useState<"block" | "experiential">("block");
  const [progress, setProgress] = useState(0.48); // starts near 2026
  const [playing, setPlaying] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  // Switching modes kicks off (or stops) playback in one action so
  // entering Experiential immediately starts flying the camera through
  // the block. If the scrubber is at the end, rewind to the beginning
  // so the user gets a fresh play-through.
  const switchMode = (next: "block" | "experiential") => {
    setMode(next);
    if (next === "experiential") {
      if (progress >= 0.99) setProgress(0);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  // Playback loop for experiential mode
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    let last = performance.now();
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setProgress((p) => {
        // lives of ~80y; playback at 5 years / second means 16 seconds full run
        const next = p + dt / 16;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  const tToDate = (p: number) => {
    const ms = meta.t0 + p * (meta.tEnd - meta.t0);
    const d = new Date(ms);
    const iso = d.toISOString().slice(0, 10);
    return iso;
  };

  const currentDate = tToDate(progress);
  const years = ((new Date(currentDate).getTime() - new Date(life.person.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));

  const hoveredEvent = hovered !== null ? meta.events[hovered] : null;

  // "Active event": the most-significant event temporally near the
  // current time. Ramps up over `windowDays` and fades back down on
  // either side, so as playback or scrubbing crosses a milestone, the
  // event briefly takes over the prominent display area.
  //
  // Only events with significance ≥ 0.65 qualify so trivial annotations
  // don't ever crowd the display; opacity is the smaller of (proximity
  // ramp) and (significance) so a near, very-significant event reads
  // strongest.
  const activeEvent = useMemo(() => {
    const atTime = meta.t0 + progress * (meta.tEnd - meta.t0);
    const MS_DAY = 24 * 3600 * 1000;
    const windowDays = 540; // ~18 months around the event for the fade
    let best: { event: (typeof meta.events)[number]; opacity: number } | null = null;
    for (const e of meta.events) {
      if (e.significance < 0.65) continue;
      const eMs = new Date(e.date + "T00:00:00Z").getTime();
      const distDays = Math.abs(atTime - eMs) / MS_DAY;
      if (distDays > windowDays) continue;
      // Cosine ramp: 1 at the event, 0 at the window edge, eased.
      const ramp = 0.5 + 0.5 * Math.cos((distDays / windowDays) * Math.PI);
      const opacity = Math.min(ramp, e.significance);
      if (!best || opacity > best.opacity) best = { event: e, opacity };
    }
    return best;
  }, [progress, meta]);

  return (
    <main className="relative min-h-screen">
      <Nav />

      {/* Full-bleed scene */}
      <div className="fixed inset-0 top-14 z-0">
        <LifeScene
          life={life}
          mode={mode}
          progress={progress}
          hovered={hovered}
          onHoverEvent={setHovered}
        />
      </div>

      {/* Overlay content */}
      <div className="relative z-10 pt-20 pb-32 px-6 sm:px-10 lg:px-14 pointer-events-none">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr_minmax(0,360px)] gap-6">
          {/* Left: intro + mode switcher. On mobile in Experiential
              mode the prose collapses so the visualization isn't
              competing with a wall of text — only the mode toggle
              remains, giving the reader a way back to Block view. */}
          <div className="pointer-events-auto lg:max-w-sm">
            <div className="rounded-2xl bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] p-7">
              <div
                className={cn(
                  "lg:block",
                  mode === "experiential" ? "hidden" : "block",
                )}
              >
                <div className="eyebrow mb-3">The Capstone</div>
                <h1 className="font-serif text-3xl leading-tight tracking-tight text-[var(--ink-0)] mb-4">
                  A Life in the Block.
                </h1>
                <p className="prose-bu text-[15px]">
                  {life.person.name}, 49 in 2026, living in Seattle —
                  rendered as the <strong>attractor basin</strong> he
                  forms in spacetime over 91 years. The horizontal plane
                  is geography; the vertical axis is time. The bright
                  tube is the trajectory of his attention; the warm glow
                  on the map is the <em>density of return</em> — places
                  his geometry keeps pulling him back to. Other curves
                  are the people he braids his life with — a parent, a
                  partner, two children — each their own attractor.
                </p>
                <p className="prose-bu text-[15px] mt-3 text-[var(--ink-2)]">
                  A composite demonstration life. In the block view the
                  whole basin is always there. In the experiential view
                  the future is dimmed and a camera flies along the
                  groove.
                </p>

                <Link
                  href="/afterword"
                  className="mt-6 inline-flex items-center gap-2 text-[13px] text-[var(--ember)] hover:text-[#f1b97e] underline underline-offset-4 transition-colors"
                >
                  What does this mean? →
                </Link>
              </div>

              <div
                className={cn(
                  "flex gap-2 lg:mt-6",
                  mode === "experiential" ? "mt-0" : "mt-6",
                )}
              >
                <button
                  onClick={() => switchMode("block")}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                    mode === "block"
                      ? "bg-[var(--ember)] text-[var(--void-0)] border-[var(--ember)]"
                      : "bg-transparent text-[var(--ink-1)] border-[var(--rule)] hover:text-[var(--ink-0)]",
                  )}
                >
                  Block view
                </button>
                <button
                  onClick={() => switchMode("experiential")}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors",
                    mode === "experiential"
                      ? "bg-[var(--ember)] text-[var(--void-0)] border-[var(--ember)]"
                      : "bg-transparent text-[var(--ink-1)] border-[var(--rule)] hover:text-[var(--ink-0)]",
                  )}
                >
                  Experiential
                </button>
              </div>
            </div>
          </div>

          {/* Center: prominently displayed "active event" — the most
              significant event near the current time, fading in/out as
              the spotlight passes through. After the experiential
              flythrough ends, an Afterword CTA fades in here so the
              reader has an obvious way forward without hunting through
              the page. */}
          <div className="pointer-events-none flex flex-col items-center gap-6">
            {activeEvent && (
              <div
                className="text-center select-none"
                style={{
                  opacity: activeEvent.opacity,
                  transform: `translateY(${(1 - activeEvent.opacity) * 12}px)`,
                  transition: "opacity 250ms ease, transform 350ms ease",
                  // The card is purely visual — letting clicks pass
                  // through to the scene below.
                  pointerEvents: "none",
                  textShadow: "0 2px 32px rgba(5, 6, 8, 0.95)",
                }}
              >
                <div className="eyebrow text-[var(--ember-faint)] mb-2">
                  {activeEvent.event.kind}
                </div>
                <div className="font-serif text-3xl sm:text-4xl tracking-tight text-[var(--ink-0)] leading-tight max-w-[24ch] mx-auto">
                  {activeEvent.event.label}
                </div>
                <div className="mt-2 font-mono text-[12px] tracking-wider uppercase text-[var(--ink-2)]">
                  {formatDate(activeEvent.event.date)}
                </div>
              </div>
            )}
            <AfterwordCTA
              visible={
                mode === "experiential" && !playing && progress >= 0.99
              }
            />
          </div>

          {/* Right: hovered event detail */}
          <div className="pointer-events-auto lg:ml-auto lg:max-w-sm">
            <div
              className={cn(
                "rounded-2xl bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] p-7 transition-opacity",
                hoveredEvent ? "opacity-100" : "opacity-70",
              )}
            >
              {hoveredEvent ? (
                <>
                  <div className="eyebrow mb-3">{hoveredEvent.kind}</div>
                  <div className="font-serif text-2xl leading-snug text-[var(--ink-0)]">
                    {hoveredEvent.label}
                  </div>
                  <div className="mt-2 text-[13px] font-mono text-[var(--ink-2)]">
                    {formatDate(hoveredEvent.date)}
                  </div>
                </>
              ) : (
                <>
                  <div className="eyebrow mb-3">Hover any node</div>
                  <div className="font-serif text-lg text-[var(--ink-1)]">
                    Hover a node on the worldline to see the event.
                    Drag to orbit in block view.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: time scrubber */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-14 pb-6">
          <div className="pointer-events-auto rounded-2xl bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] p-5">
            <div className="flex items-center gap-4 mb-3 text-[12px] font-mono text-[var(--ink-2)]">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="px-3 py-1 rounded-full bg-[var(--void-2)] text-[var(--ink-0)] border border-[var(--rule)] hover:border-[var(--ember)] transition-colors"
              >
                {playing ? "pause" : "play"}
              </button>
              <span className="tabular-nums text-[var(--ink-1)]">
                {formatDate(currentDate)} &nbsp;·&nbsp; age{" "}
                {years.toFixed(1)}
              </span>
              <span className="ml-auto text-[var(--ink-2)]">
                {life.person.birthDate}
              </span>
              <span className="text-[var(--ink-2)]">
                {(new Date(meta.tEnd).toISOString().slice(0, 10))}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.0005}
              value={progress}
              onChange={(e) => {
                setProgress(Number(e.target.value));
                setPlaying(false);
              }}
              className="w-full accent-[var(--ember)]"
              aria-label="Time"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Pill CTA that appears once the experiential playthrough reaches the
 * end. Fades in smoothly so it feels like a conclusion to the life
 * rather than a button materializing out of nowhere. Always rendered
 * so the transition runs on mount-like state flips; visibility and
 * interactivity gate on the prop.
 */
function AfterwordCTA({ visible }: { visible: boolean }) {
  return (
    <Link
      href="/afterword"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "pointer-events-auto inline-flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--ember)] !text-[var(--void-0)] !no-underline font-medium text-[14px] hover:bg-[#f1b97e] shadow-[0_8px_32px_rgba(232,169,107,0.35)]",
        "transition-opacity duration-700 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      Continue to the Afterword →
    </Link>
  );
}
