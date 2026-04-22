"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter7Scene } from "@/components/scenes/Chapter7_Reveal";
import Link from "next/link";

export function Chapter7() {
  return (
    <FullBleedChapter
      index={7}
      eyebrow="Chapter Seven · Synthesis"
      title="The block."
      scene={<Chapter7Scene />}
      tone="hush"
      cardSide="left"
    >
      <p>
        Gather what we have. Simultaneity is not absolute. Causality is.
        The deep structure is a four-dimensional geometry, not a
        three-dimensional stage across which a universal <em>now</em>
        {" "}sweeps. The sense of flow is a property of memory-bearing
        minds in a low-entropy universe, not of the universe itself.
      </p>
      <p>
        Put together, the picture is the <strong>block universe</strong>
        {" "}— sometimes called <em>eternalism</em> by philosophers of
        time <a href="/references#eternalism">[10]</a>. Every event
        that ever was, is, or will be is present in the block,
        coordinate-addressable, on equal ontological terms. Your tenth
        birthday and your last one are neighbors in the same object.
      </p>
      <p>
        This is not a consensus view — competing pictures,{" "}
        <em>presentism</em> and the <em>growing-block</em> theory, are
        still seriously defended
        <a href="/references#sep">[11]</a>. But among physicists who
        take relativity at face value, the block is the most natural
        reading, and it has been for over a century.
      </p>
      <blockquote>
        “For us believing physicists, the distinction between past,
        present, and future is only a stubbornly persistent illusion.”
        <span className="block mt-2 not-italic text-sm text-[var(--ink-2)]">
          — Albert Einstein, March 1955
          <a href="/references#besso">[12]</a>
        </span>
      </blockquote>
      <p>
        Now look closely at any one life inside the block. What you see
        isn’t a path so much as a <strong>basin</strong> — a region of
        spacetime the dynamics of that person keep returning to. Their
        bed, the streets they walk, the people they’re closest to. Push
        them out of it and they roll back in. Not because they choose
        to, but because the geometry of who they are tilts that way.
        The self is less a chooser than a <em>shape</em>, and the
        shape is the <strong>attractor</strong>.
      </p>
      <p>
        Picture a marble in a bowl: the marble doesn’t pick where the
        bottom is, the bowl does. A life works the same way — only the
        bowl is built up over decades, out of habits, obligations,
        proximity, attachment, and the quiet cost of going elsewhere.
        The deeper the bowl, the more recognizably <em>that person</em>
        a life becomes; the more concentrated their trajectory in the
        block.
      </p>
      <p className="mt-8">
        <Link
          href="/your-life"
          className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-[var(--ember)] !text-[var(--void-0)] !no-underline font-medium text-[14px] hover:bg-[#f1b97e] transition-colors"
        >
          See a life as an attractor basin →
        </Link>
      </p>
    </FullBleedChapter>
  );
}
