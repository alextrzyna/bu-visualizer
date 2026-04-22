"use client";

import { FullBleedChapter } from "@/components/ui/FullBleedChapter";
import { Chapter3Scene } from "@/components/scenes/Chapter3_LightCone";

export function Chapter3() {
  return (
    <FullBleedChapter
      index={3}
      eyebrow="Chapter Three · Causality"
      title="Here is what stays fixed."
      scene={<Chapter3Scene />}
      tone="hush"
      cardSide="left"
    >
      <p>
        If different observers disagree about the ordering of events,
        what <em>do</em> they agree on? Minkowski’s answer, in 1908, was
        that they agree on a <strong>geometry</strong> — not of space
        and not of time, but of spacetime treated as a single,
        four-dimensional whole
        <a href="/references#minkowski">[2]</a>.
      </p>
      <p>
        The invariant object in that geometry is the{" "}
        <strong>light cone</strong>. Pick any event; the set of future
        events that a flash of light from it could reach forms a cone
        opening upward. The set of past events that could have sent
        light <em>to</em> it forms a mirror cone opening downward.
      </p>
      <p>
        Everything inside these cones stands in a causal relationship
        with the origin event. Everything outside — the entire vast
        “elsewhere” that wraps around it — is too far away for any
        influence to have propagated at or below light speed, and so
        is simply unreachable.
      </p>
      <p>
        What different observers <em>do</em> agree on is this cone
        structure. They may disagree on which of two events was “first”,
        but they never disagree on which event could have caused which.
        Causality is preserved. Simultaneity is not.
      </p>
    </FullBleedChapter>
  );
}
