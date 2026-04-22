"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter1Scene } from "@/components/scenes/Chapter1_Spotlight";

export function Chapter1() {
  return (
    <FullBleedChapter
      index={1}
      eyebrow="Chapter One · Intuition"
      title="The spotlight of now."
      scene={<Chapter1Scene />}
      tone="hush"
      cardSide="left"
    >
      <p>
        Close your eyes for a second and listen to your own experience.
        There is a vivid, bright <em>now</em>. Behind it, fading like the
        wake of a boat, lies the past — real once, no longer. Ahead lies
        the future — not yet real, still to come. The present is a
        moving edge, and the universe is reborn at it, moment by moment.
      </p>
      <p>
        This is how time feels. It is not, however, how the best
        theories of physics describe it. In those theories, the notion
        of a universal <em>now</em> — a single moment the universe is
        currently having — turns out to be surprisingly hard to defend.
      </p>
      <p>
        Over the next few sections we will take the intuition apart
        gently, piece by piece. What we will be left with is a stranger
        and, in its own way, more beautiful picture: the{" "}
        <strong>block universe</strong>, in which past, present, and
        future exist on equal terms, and in which your entire life is
        already, in some sense, a whole shape.
      </p>
      <p className="text-[var(--ink-2)] text-sm mt-12 font-sans">
        Scroll to continue.
      </p>
    </FullBleedChapter>
  );
}
