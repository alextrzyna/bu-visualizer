"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * ChapterLayout: a two-column scroll section.
 * Left (scrolling): prose. Right (sticky): the 3D scene.
 * On small screens, stacks: scene becomes a shorter banner above the prose.
 */
export function ChapterLayout({
  index,
  eyebrow,
  title,
  scene,
  children,
  tone = "default",
}: {
  index: number;
  eyebrow: string;
  title: string;
  scene: ReactNode;
  children: ReactNode;
  tone?: "default" | "hush";
}) {
  return (
    <section
      data-chapter={index}
      className={cn(
        "relative w-full",
        tone === "hush" ? "bg-[var(--void-0)]" : "bg-[var(--void-1)]",
      )}
    >
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-0">
        {/* Prose column */}
        <div className="px-6 sm:px-10 lg:px-14 py-28 lg:py-40 order-2 lg:order-1">
          <div className="max-w-[46ch]">
            <div className="flex items-baseline gap-3 mb-10">
              <span className="font-mono text-[11px] text-[var(--ember-faint)] tabular-nums">
                {String(index).padStart(2, "0")}
              </span>
              <span className="eyebrow">{eyebrow}</span>
            </div>
            <h2 className="font-serif text-4xl sm:text-5xl leading-[1.05] tracking-tight text-[var(--ink-0)] mb-10">
              {title}
            </h2>
            <div className="prose-bu">{children}</div>
          </div>
        </div>
        {/* Scene column — sticky on desktop */}
        <div className="order-1 lg:order-2 relative">
          <div className="lg:sticky lg:top-14 h-[56svh] sm:h-[64svh] lg:h-[calc(100svh-3.5rem)] w-full">
            {scene}
          </div>
        </div>
      </div>
      <div className="hairline" />
    </section>
  );
}
