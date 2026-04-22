"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter6Scene } from "@/components/scenes/Chapter6_Memory";

export function Chapter6() {
  return (
    <FullBleedChapter
      index={6}
      eyebrow="Chapter Six · Consciousness"
      title="The moving light is in you."
      scene={<Chapter6Scene />}
      cardSide="right"
    >
      <p>
        None of this means the feeling of flow is an illusion in any
        dismissive sense. It is a very real thing. The question is{" "}
        <em>where</em> the feeling lives.
      </p>
      <p>
        A promising line of thought — articulated by Huw Price
        <a href="/references#price">[8]</a>, Carlo Rovelli
        <a href="/references#rovelli">[9]</a>, and others — is that the
        sense of passage is a feature of <em>minds</em>, not of the
        universe. A mind that forms memories is a mind that accumulates
        a record of its own past and not of its future. That asymmetry,
        layered on top of the entropic arrow, is enough to make any
        information-processing creature feel as though it is being
        carried forward.
      </p>
      <p>
        A worldline runs from one end of the block to the other. Its
        full shape is always there. A bright point slides along it —
        that is what it is like, from the inside, to be a being with
        memory in a static block. The light isn’t moving through the
        world. The light <em>is</em> the world, noticing itself at one
        coordinate at a time.
      </p>
    </FullBleedChapter>
  );
}
