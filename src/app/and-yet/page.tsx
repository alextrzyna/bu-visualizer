"use client";

import { useEffect, useRef, useState } from "react";
import { Nav } from "@/components/ui/Nav";
import { AndYetScene } from "@/components/scenes/AndYetScene";
import Link from "next/link";

/**
 * The coda. Everything before this has argued the block picture from
 * classical physics and drawn its hard consequences for agency. This
 * page is the exhale: quantum mechanics does not break the block, but
 * depending on how you read it, the block may not be the sealed room
 * the afterword made it sound like.
 *
 * Three beats, same scroll-driven rig as the afterword:
 *
 *   I · The bummer.      Acknowledge what the block, straight, costs us.
 *   II · The crack.      Three QM interpretations, framed by what each
 *                        does for agency. The door isn't closed.
 *   III · The exhale.    Nothing is settled, and that is good news.
 */
export default function AndYet() {
  const scrollRef = useRef(0);
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

      <div
        className="fixed left-0 right-0 top-14 h-[55svh] md:h-[calc(100svh-3.5rem)] overflow-hidden z-20 md:z-0 bg-[var(--void-0)] md:bg-transparent"
      >
        <AndYetScene scrollRef={scrollRef} />
        <div
          aria-hidden
          className="md:hidden absolute left-0 right-0 bottom-0 h-[140px] pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, var(--void-0) 70%, var(--void-0) 100%)",
          }}
        />
      </div>

      <div className="relative z-10 pointer-events-none">
        <Reflection
          eyebrow="And yet · I"
          title="The honest cost."
          paragraphs={[
            "The afterword was not generous. If the block is the whole story, then the future is already a place, your choices were always the choices you were going to make, and the sense that you are steering is a feature of the curve, not the work of someone standing outside it.",
            "That is a hard thing to carry, and it deserves to be said plainly before anything softens it. We have spent seven chapters showing that the block picture follows straightforwardly from the physics. We should spend at least a breath acknowledging that, taken straight, it is a bummer.",
            "Now — and only now — it’s fair to ask whether the block really is the whole story.",
          ]}
        />

        <Reflection
          eyebrow="And yet · II"
          title="Quantum mechanics leaves the door ajar."
          paragraphs={[
            "Everything in this site so far has been built from special relativity and thermodynamics: classical physics, sharpened. But the universe is not classical at its smallest scales. Quantum mechanics describes a world in which outcomes are not fixed until they are measured — and its foundations are famously, honestly unsettled. Depending on which interpretation turns out to be right, the sealed block admits different amounts of light.",
            "On collapse readings — Copenhagen, and the objective-collapse models of Ghirardi, Rimini, and Weber — each measurement is a real, irreducible event. The future does not exist as a completed thing the way the block suggests; it becomes real, in small increments, as the wavefunction collapses. This is the strongest anti-block reading of quantum mechanics, and it has not been ruled out.",
            "On Everett’s many-worlds picture, nothing collapses: the wavefunction evolves unitarily, and every outcome is realized on some branch. The block isn’t broken — it’s a branching tree of blocks, and the self that feels like it is choosing really is, in the only sense available, taking every road. The curve that you are is one thread through that tree.",
            "On the retrocausal and timeless proposals — Price’s view from nowhen, the two-state-vector formalism, Wheeler–DeWitt quantum gravity, and Barbour’s radical reading of it — the block survives, but in a form where the future can participate in the present, and where time itself is something that emerges from more fundamental, timeless structure. Here the block is *deeper* than Einstein’s, and stranger.",
            "None of these is settled. All of them are live. What they share is a single, quiet point: physics has not actually closed the question of whether the future is fixed.",
          ]}
        />

        <Reflection
          eyebrow="And yet · III"
          title="Something like freedom."
          paragraphs={[
            "This is not a rescue operation. You don’t get libertarian free will back by waving at quantum randomness — a coin flip in the brain is not authorship, and everybody who has thought seriously about this has said so.",
            "But the picture is less closed than the afterword makes it feel. The block may not be a prison. It may be a photograph of something still being taken. We do not know, at the most fundamental level, whether the future is settled — only that it looks settled from the vantage point of relativity and entropy, which are not the deepest layer.",
            "So: sit with the shape. Let the afterword’s hard conclusions land. And then hold them a little loosely. The weight was real. It may also be the weight of an open question rather than a verdict.",
            "The noticing continues either way.",
          ]}
        />

        <div className="relative pt-24 pb-40 px-6 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl text-center pointer-events-auto">
            <p className="font-serif text-[var(--ink-2)] text-sm">
              <Link
                href="/references"
                className="text-[var(--ember)] underline underline-offset-4"
              >
                References
              </Link>
              {"  ·  "}
              <Link
                href="/"
                className="text-[var(--ink-1)] hover:text-[var(--ink-0)]"
              >
                Return to the beginning
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
