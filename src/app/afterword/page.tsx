"use client";

import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/ui/Nav";
import { AfterwordScene } from "@/components/scenes/AfterwordScene";
import Link from "next/link";

/**
 * The closing chapter. Three reflections, each a sustained beat in
 * one continuous scene driven by page-scroll progress.
 *
 * The page is intentionally tall (~330svh) so the user has to slow
 * down — the scene needs time to read, and the prose is meant to be
 * sat with rather than skimmed.
 */
export default function Afterword() {
  // Live scroll progress (0..1 across the scrollable page region).
  // Stored as a ref so the canvas-side useFrame can read it without
  // forcing React re-renders on every scroll event.
  const scrollRef = useRef(0);
  // We also mirror it in state for the prose card's progressive
  // brightness — but throttled, so we don't kick a render every frame.
  const [, setScrollState] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
        scrollRef.current = p;
        const now = performance.now();
        if (now - last > 80) {
          last = now;
          setScrollState(p);
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className="relative">
      <Nav />

      {/* The scene is fixed. On desktop it fills the viewport below the
          nav and sits behind the prose cards (z-0). On mobile it pins
          to the top 55svh and is pushed ABOVE the prose (z-20) with an
          opaque void-0 background and a seam gradient at the bottom,
          matching the chapter walkthrough treatment. */}
      <div
        className="fixed left-0 right-0 top-14 h-[55svh] md:h-[calc(100svh-3.5rem)] overflow-hidden z-20 md:z-0 bg-[var(--void-0)] md:bg-transparent"
      >
        <AfterwordScene scrollRef={scrollRef} />
        {/* Mobile-only seam fade */}
        <div
          aria-hidden
          className="md:hidden absolute left-0 right-0 bottom-0 h-[140px] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, var(--void-0) 70%, var(--void-0) 100%)",
          }}
        />
      </div>

      {/* Tall scrollable region. Each reflection takes ~110svh so the
          user has time to read it and the camera time to ease through
          its corresponding station. */}
      <div className="relative z-10 pointer-events-none">
        <Reflection
          eyebrow="Afterword · I"
          title="Permanence."
          paragraphs={[
            "The line you saw is what you are, in the only sense of ‘you’ the block universe permits — a four-dimensional shape, with a beginning and an end, every coordinate of which is real on equal terms.",
            "Your tenth birthday is not gone. The afternoon you spent on a porch with your grandmother is not gone. The first time you held your child is not gone. They are at coordinates you no longer occupy. You did not lose them; you walked away from them.",
            "Loss is real — you cannot reach back to them — but it is the loss of access, not of existence. That is a smaller and stranger kind of loss than the one we instinctively grieve.",
          ]}
        />

        <Reflection
          eyebrow="Afterword · II"
          title="No agency."
          paragraphs={[
            "If the future already exists as a feature of the block, the libertarian sense of choice — the ability to have done otherwise — does not survive. This is uncomfortable. It is also straightforwardly implied by the picture.",
            "Compatibilist redefinitions of ‘free will’ (‘you act from your own desires’) preserve the word but concede the substance: your desires are also fixed. The deliberation is real, the consequences follow, but the outcome was always going to be what it is. You don’t choose your deliberation either; you just do it.",
            "The honest reframe is one of self-conception. You are not the chooser sitting behind the worldline, authoring it forward. You are the worldline. The whole curve, not its leading edge. The ‘I’ that seems to make each moment is itself a feature of the curve, not a thing standing outside it.",
            "Spinoza, Sam Harris, Galen Strawson, parts of the Buddhist tradition all land somewhere here. People still suffer. Care still matters. The shape that you are still has some forms that, from the inside, feel better than others. Why this is true even without authorship is its own long question.",
          ]}
        />

        <Reflection
          eyebrow="Afterword · III"
          title="Attention."
          paragraphs={[
            "What’s left, then? Not ‘choose to look closer’ — we’ve already let go of that.",
            "Noticing is what the basin does at its leading edge. The attractor’s present-moment surface — the rim of the bowl where the rolling actually happens. It’s not chosen; it’s what the geometry produces, frame after frame. And it’s the only thing that meets the moment as it becomes permanent — the only thing that registers, in real time, the events that will then be forever-true.",
            "The shape ahead of you, from the block’s point of view, is already drawn. From inside, the rim is still moving. Both descriptions are correct. The lived part is not less real for having been determined. It is simply the form your existence takes — the inside of a basin, looked at from one of its coordinates.",
            "Past the conclusion, the visualization is what remains. The shape is still there. Pull back far enough and yours is one basin in a field of basins, deformed by the ones that ran close. Stay long enough and the noticing happens by itself.",
          ]}
        />

        <div className="relative pt-24 pb-40 px-6 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl text-center pointer-events-auto">
            <Link
              href="/and-yet"
              className="inline-block font-serif text-[var(--ink-0)] text-2xl sm:text-3xl tracking-tight hover:text-[var(--ember)] transition-colors"
            >
              …and yet <span aria-hidden>→</span>
            </Link>
            <p className="mt-4 font-serif text-[var(--ink-2)] text-sm italic max-w-md mx-auto">
              A last note, before the references. Quantum mechanics has something
              to say about all of this.
            </p>
            <p className="mt-10 font-serif text-[var(--ink-2)] text-[13px]">
              <Link
                href="/"
                className="text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              >
                Return to the beginning
              </Link>
              {"  ·  "}
              <Link
                href="/references"
                className="text-[var(--ink-2)] hover:text-[var(--ink-1)]"
              >
                References
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Reflection({
  eyebrow,
  title,
  paragraphs,
}: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
}) {
  const body = (
    <div className="prose-bu text-[15.5px] leading-[1.75]">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
  return (
    <section className="relative min-h-[110svh] px-6 sm:px-10 lg:px-14 md:flex md:items-center md:py-24">
      <div className="md:mx-auto md:max-w-7xl w-full">
        {/* Mobile: plain prose block positioned just below the scene
            (nav + 55svh + 16px margin) so the eyebrow and title land
            fully below the seam gradient, not inside it. */}
        <div
          className="md:hidden pb-12 pointer-events-auto"
          style={{ paddingTop: "calc(3.5rem + 55svh + 16px)" }}
        >
          <div className="eyebrow mb-5 text-[var(--ember-faint)]">
            {eyebrow}
          </div>
          <h2 className="font-serif text-[28px] leading-[1.1] tracking-tight text-[var(--ink-0)] mb-5">
            {title}
          </h2>
          {body}
        </div>
        {/* Desktop: card overlay (unchanged). */}
        <div className="hidden md:block pointer-events-auto max-w-[44ch] rounded-2xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)] bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.45)] px-7 sm:px-9 py-9 sm:py-11">
          <div className="eyebrow mb-5 text-[var(--ember-faint)]">
            {eyebrow}
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl leading-[1.08] tracking-tight text-[var(--ink-0)] mb-7">
            {title}
          </h2>
          {body}
        </div>
      </div>
    </section>
  );
}
