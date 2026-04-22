"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter5Scene } from "@/components/scenes/Chapter5_Entropy";

export function Chapter5() {
  return (
    <FullBleedChapter
      index={5}
      eyebrow="Chapter Five · The Arrow"
      title="Why, then, does time seem to flow?"
      scene={<Chapter5Scene />}
      tone="hush"
      cardSide="left"
    >
      <p>
        If there is no privileged <em>now</em>, why is our experience so
        relentlessly directional? Smoke rises, never unrises. Memories
        run backward into the past, never forward. Why?
      </p>
      <p>
        The dominant modern answer, going back to Boltzmann
        <a href="/references#boltzmann">[5]</a> and brought into sharp
        focus by Eddington, who coined the phrase <em>arrow of time</em>
        {" "}in 1928
        <a href="/references#eddington">[6]</a>, is that the direction
        of time is not fundamental but <strong>statistical</strong>.
      </p>
      <p>
        The box contains particles that start in a tight, low-entropy
        cluster in one corner (a faint ember ghost remains there as a
        reminder of the beginning). The underlying laws that move them
        are time-symmetric: rewind the film and nothing violates
        physics. And yet the film, run forward, almost always shows the
        cluster dispersing.
      </p>
      <p>
        The universe we live in began, for reasons still debated
        <a href="/references#carroll">[7]</a>, in an astonishingly
        low-entropy state. Everything we call “the flow of time” — the
        breaking of an egg, the cooling of coffee, a body growing old,
        a memory being formed — is a small local entailment of that
        single, enormous initial fact.
      </p>
    </FullBleedChapter>
  );
}
