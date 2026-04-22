"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * FullBleedChapter renders two layouts driven by Tailwind's `md:` gate
 * (viewport ≥ 768px = desktop):
 *
 *   Desktop: a sticky 100svh wrapper holds the scene (absolutely filling
 *     the wrapper) and the prose card (absolutely positioned, vertically
 *     centered). Prose card rides with the scene during scroll.
 *
 *   Mobile: the same sticky wrapper shrinks to 55svh and pins only the
 *     scene. The prose lives in a separate in-flow pane below the sticky
 *     wrapper, with a soft gradient seam that blends the bottom of the
 *     scene into the prose pane's background.
 *
 * The scene is mounted once. The prose content (children + header) is
 * rendered twice — once in each branch, with `hidden md:flex` /
 * `md:hidden` gating which is visible — to avoid a JS-driven hydration
 * flash. Prose is cheap (text + anchors, no state), so double-mounting
 * is a non-issue.
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
  const seamColor = tone === "hush" ? "var(--void-0)" : "var(--void-1)";
  const header = (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-mono text-[11px] text-[var(--ember-faint)] tabular-nums">
        {String(index).padStart(2, "0")}
      </span>
      <span className="eyebrow">{eyebrow}</span>
    </div>
  );

  return (
    <section
      data-chapter={index}
      className={cn(
        "relative w-full md:min-h-[130svh]",
        tone === "hush" ? "bg-[var(--void-0)]" : "bg-[var(--void-1)]",
      )}
    >
      {/* Sticky scene wrapper. Mobile: 55svh, pins while chapter scrolls.
          Desktop: full viewport height, holds the prose overlay too.
          On mobile the wrapper gets z-10 and an opaque seam background
          so that the prose pane (later in DOM, lower z) cannot paint
          over the scene as it scrolls up through the viewport. The
          seam gradient is the visible fade. */}
      <div
        className="sticky top-14 h-[55svh] md:h-[calc(100svh-3.5rem)] w-full overflow-hidden z-10 md:z-auto"
        style={{
          // Opaque bg on mobile covers any prose that would otherwise
          // render through the WebGL canvas's transparent regions.
          // Desktop relies on the card being inside the sticky, so no
          // bg is needed there.
          background: `var(--void-0)`,
        }}
      >
        <div className="absolute inset-0">{scene}</div>

        {/* Mobile-only seam: taller (140px) gradient at the bottom edge
            so the scene's bottom fades to opaque seamColor. Because the
            sticky wrapper is z-10 and opaque, any prose text scrolling
            up into the scene's zone is hidden; this gradient is what
            makes that handoff a soft fade instead of a hard cut. */}
        <div
          aria-hidden
          className="md:hidden absolute left-0 right-0 bottom-0 h-[140px] pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, ${seamColor} 70%, ${seamColor} 100%)`,
          }}
        />

        {/* Desktop prose card — absolutely positioned inside the sticky
            wrapper so it rides along with the scene. */}
        <div
          className={cn(
            "hidden md:flex absolute inset-y-0 items-center pointer-events-none px-6 sm:px-10 lg:px-14",
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
            {header}
            <h2 className="font-serif text-3xl sm:text-4xl leading-[1.08] tracking-tight text-[var(--ink-0)] mb-6">
              {title}
            </h2>
            <div className="prose-bu text-[15.5px] leading-[1.7]">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only in-flow prose pane. Sits below the sticky scene. */}
      <div className="md:hidden relative px-6 pt-10 pb-20">
        {header}
        <h2 className="font-serif text-[28px] leading-[1.1] tracking-tight text-[var(--ink-0)] mb-5">
          {title}
        </h2>
        <div className="prose-bu text-[15.5px] leading-[1.7]">{children}</div>
      </div>
    </section>
  );
}
