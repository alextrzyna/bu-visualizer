"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * FullBleedChapter: one sticky wrapper that holds both the full-width
 * scene and the inset prose card. The card is absolutely positioned
 * within the sticky wrapper so it rides along with the scene, and its
 * own `max-h-full overflow-y-auto` keeps it from ever exceeding the
 * visible area (if the prose is long, the card's own body scrolls).
 *
 * Why this structure (and not sticky-inside-absolute): CSS `sticky`
 * requires a scrolling ancestor, and absolutely-positioned parents
 * don't establish one. Putting the card inside the outer `sticky`
 * element makes it naturally ride with the scene.
 */
export function FullBleedChapter({
  index,
  eyebrow,
  title,
  scene,
  children,
  tone = "default",
  cardSide = "left",
}: {
  index: number;
  eyebrow: string;
  title: string;
  scene: ReactNode;
  children: ReactNode;
  tone?: "default" | "hush";
  cardSide?: "left" | "right";
}) {
  return (
    <section
      data-chapter={index}
      className={cn(
        "relative w-full min-h-[130svh]",
        tone === "hush" ? "bg-[var(--void-0)]" : "bg-[var(--void-1)]",
      )}
    >
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] w-full overflow-hidden">
        {/* scene fills the sticky wrapper */}
        <div className="absolute inset-0">{scene}</div>
        {/* prose card: absolutely positioned, centered vertically, clamped
            to the wrapper's height with internal scroll if needed */}
        <div
          className={cn(
            "absolute inset-y-0 flex items-center pointer-events-none px-6 sm:px-10 lg:px-14",
            cardSide === "left" ? "left-0" : "right-0",
          )}
        >
          <div
            className={cn(
              "pointer-events-auto w-full max-w-[44ch]",
              "max-h-[calc(100%-4rem)] overflow-y-auto overscroll-contain",
              "rounded-2xl border border-[color-mix(in_oklab,var(--ink-0)_8%,transparent)]",
              "bg-[color-mix(in_oklab,var(--void-0)_72%,transparent)] backdrop-blur-xl",
              "shadow-[0_24px_80px_rgba(0,0,0,0.45)]",
              "px-7 sm:px-9 py-8 sm:py-10",
            )}
          >
            <div className="flex items-baseline gap-3 mb-5">
              <span className="font-mono text-[11px] text-[var(--ember-faint)] tabular-nums">
                {String(index).padStart(2, "0")}
              </span>
              <span className="eyebrow">{eyebrow}</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl leading-[1.08] tracking-tight text-[var(--ink-0)] mb-6">
              {title}
            </h2>
            <div className="prose-bu text-[15.5px] leading-[1.7]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
