"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter4Scene } from "@/components/scenes/Chapter4_Andromeda";

export function Chapter4() {
  return (
    <FullBleedChapter
      index={4}
      eyebrow="Chapter Four · A Paradox"
      title="Walk one way, and Andromeda slides."
      scene={<Chapter4Scene />}
      cardSide="right"
    >
      <p>
        In the mid-1960s the Dutch physicist C. W. Rietdijk and, a year
        later, the American philosopher Hilary Putnam, noticed something
        about relativity that still startles people who have not heard
        it before
        <a href="/references#rietdijk">[3]</a>
        <a href="/references#putnam">[4]</a>.
      </p>
      <p>
        Take two people standing next to each other on Earth. One begins
        walking toward the Andromeda galaxy, 2.5 million light-years
        away. The other walks in the opposite direction. Just a few
        steps — a few meters per second.
      </p>
      <p>
        Because their velocities differ, their planes of simultaneity
        are tilted differently. Apply Einstein’s arithmetic and the
        result is not subtle: the two pedestrians’ “nows” intersect
        Andromeda at moments separated by <em>days</em>. In one
        walker’s present, a decision on Andromeda has already been made.
        In the other’s, it hasn’t.
      </p>
      <p>
        Neither walker is wrong. And if the universal <em>now</em> can
        be jostled by a stroll, there is a real question about whether
        it was ever a feature of the universe in the first place —
        rather than a feature of your point of view.
      </p>
    </FullBleedChapter>
  );
}
