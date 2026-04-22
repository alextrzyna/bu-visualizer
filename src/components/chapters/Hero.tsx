"use client";

import { HeroScene } from "@/components/scenes/HeroScene";

export function Hero() {
  return (
    <section className="relative w-full min-h-[100svh] flex flex-col justify-center overflow-hidden">
      <div className="absolute inset-0">
        <HeroScene />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-10 lg:px-14 py-32 pointer-events-none">
        <div className="max-w-2xl">
          <div className="eyebrow mb-6">A Visualization</div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-[var(--ink-0)]">
            The Block
            <br />
            Universe.
          </h1>
          <p className="mt-10 max-w-xl font-serif text-lg sm:text-xl text-[var(--ink-1)] leading-relaxed">
            A contemplative walkthrough of the idea that the passage of
            time may not be a feature of reality, but of us — and what a
            human life looks like once you accept the consequence.
          </p>
          <div className="mt-14 flex items-center gap-4 text-[13px] text-[var(--ink-2)] font-mono pointer-events-auto">
            <span className="inline-block w-8 h-px bg-[var(--ember-faint)]" />
            <span>scroll to begin</span>
          </div>
        </div>
      </div>
    </section>
  );
}
