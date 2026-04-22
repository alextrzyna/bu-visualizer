import { Nav } from "@/components/ui/Nav";
import Link from "next/link";

type Ref = {
  id: string;
  n: number;
  title: string;
  authors: string;
  year: string;
  where: string;
  note?: string;
  url?: string;
};

const REFS: Ref[] = [
  {
    id: "michelson",
    n: 1,
    title:
      "On the Relative Motion of the Earth and the Luminiferous Ether",
    authors: "A. A. Michelson & E. W. Morley",
    year: "1887",
    where: "American Journal of Science, 34, 333–345",
    note: "The null result that motivated the overthrow of absolute space. Recast by subsequent experiments with vastly tighter bounds (e.g., Hall 1883; Müller et al. 2003) and now among the most precisely tested null results in physics.",
  },
  {
    id: "einstein-sr",
    n: 1,
    title: "Zur Elektrodynamik bewegter Körper",
    authors: "A. Einstein",
    year: "1905",
    where: "Annalen der Physik, 17, 891–921",
    note: "The special-relativity paper. Establishes the relativity of simultaneity as the keystone of the kinematic picture.",
  },
  {
    id: "minkowski",
    n: 2,
    title: "Raum und Zeit (Space and Time)",
    authors: "H. Minkowski",
    year: "1908 (address); 1909 (published)",
    where: "Physikalische Zeitschrift, 10, 75–88",
    note: "The formulation of spacetime as a unified four-dimensional manifold, and the introduction of light-cone structure as the invariant geometric object.",
  },
  {
    id: "rietdijk",
    n: 3,
    title: "A Rigorous Proof of Determinism Derived from the Special Theory of Relativity",
    authors: "C. W. Rietdijk",
    year: "1966",
    where: "Philosophy of Science, 33(4), 341–344",
  },
  {
    id: "putnam",
    n: 4,
    title: "Time and Physical Geometry",
    authors: "H. Putnam",
    year: "1967",
    where: "The Journal of Philosophy, 64(8), 240–247",
    note: "The Andromeda argument in its canonical philosophical form. See also Penrose, The Emperor's New Mind (1989), pp. 303–305 for a popular recounting.",
  },
  {
    id: "boltzmann",
    n: 5,
    title:
      "Weitere Studien über das Wärmegleichgewicht unter Gasmolekülen (Further Studies on the Thermal Equilibrium of Gas Molecules)",
    authors: "L. Boltzmann",
    year: "1872",
    where: "Sitzungsberichte Akademie der Wissenschaften, Wien, 66, 275–370",
    note: "The H-theorem and the statistical grounding of the second law.",
  },
  {
    id: "eddington",
    n: 6,
    title: "The Nature of the Physical World",
    authors: "A. S. Eddington",
    year: "1928",
    where: "Cambridge University Press",
    note: "Introduces the phrase 'time's arrow' (Ch. IV, p. 68 ff).",
  },
  {
    id: "carroll",
    n: 7,
    title: "From Eternity to Here: The Quest for the Ultimate Theory of Time",
    authors: "S. Carroll",
    year: "2010",
    where: "Dutton",
    note: "A sustained modern treatment of the past-hypothesis, the low-entropy beginning of the universe, and why it matters for the arrow of time.",
  },
  {
    id: "price",
    n: 8,
    title: "Time's Arrow and Archimedes' Point: New Directions for the Physics of Time",
    authors: "H. Price",
    year: "1996",
    where: "Oxford University Press",
    note: "Argues that many puzzles about time arise from smuggled temporal assumptions in our own perspective, and advocates a 'view from nowhen'.",
  },
  {
    id: "rovelli",
    n: 9,
    title: "The Order of Time",
    authors: "C. Rovelli",
    year: "2018",
    where: "Riverhead",
    note: "A contemporary, contemplative case that time's familiar features (directedness, presentness, continuity) are thermodynamic and perspectival, not fundamental.",
  },
  {
    id: "eternalism",
    n: 10,
    title: "Being and Becoming in Modern Physics",
    authors: "S. Savitt",
    year: "2021 (revised)",
    where: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/entries/spacetime-bebecome/",
    note: "An even-handed overview of the block-universe / eternalism vs. presentism vs. growing-block debate.",
  },
  {
    id: "sep",
    n: 11,
    title: "The Experience and Perception of Time",
    authors: "R. Le Poidevin",
    year: "2019 (revised)",
    where: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/entries/time-experience/",
  },
  {
    id: "besso",
    n: 12,
    title: "Letter to the family of Michele Besso",
    authors: "A. Einstein",
    year: "March 21, 1955",
    where:
      "In The Collected Papers of Albert Einstein; see A. Fölsing, Albert Einstein: A Biography (1997), p. 741.",
    note: "The source of the celebrated 'stubbornly persistent illusion' passage, written three weeks before Einstein's own death.",
  },
  {
    id: "grw",
    n: 13,
    title: "Unified Dynamics for Microscopic and Macroscopic Systems",
    authors: "G. C. Ghirardi, A. Rimini & T. Weber",
    year: "1986",
    where: "Physical Review D, 34(2), 470–491",
    note: "The canonical objective-collapse proposal. If something like GRW is correct, wavefunction collapse is a real physical event, which arguably reintroduces a privileged 'now' and is in tension with the block picture.",
  },
  {
    id: "everett",
    n: 14,
    title: "‘Relative State’ Formulation of Quantum Mechanics",
    authors: "H. Everett III",
    year: "1957",
    where: "Reviews of Modern Physics, 29(3), 454–462",
    note: "The original many-worlds paper. For the modern, decoherence-based defense of Everett that makes it the most eternalism-friendly interpretation on offer, see D. Wallace, The Emergent Multiverse (Oxford, 2012).",
  },
  {
    id: "wheeler-dewitt",
    n: 15,
    title: "Quantum Theory of Gravity. I. The Canonical Theory",
    authors: "B. S. DeWitt",
    year: "1967",
    where: "Physical Review, 160(5), 1113–1148",
    note: "The Wheeler–DeWitt equation, in which time does not appear as an external parameter — a standing invitation to read time as emergent rather than fundamental.",
  },
  {
    id: "barbour",
    n: 16,
    title: "The End of Time: The Next Revolution in Physics",
    authors: "J. Barbour",
    year: "1999",
    where: "Oxford University Press",
    note: "A radical reading of quantum gravity in which time is fully emergent and the universe is a timeless structure of configurations — a position even more block-like than Einstein's, and genuinely strange.",
  },
  {
    id: "qm-sep",
    n: 17,
    title: "Interpretations of Quantum Mechanics",
    authors: "J. Bub & I. Pitowsky; L. Vaidman; et al.",
    year: "various (revised)",
    where: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/entries/qm-manyworlds/",
    note: "A starting point for the landscape of interpretations and their foundational commitments. For the specific question of how quantum mechanics relates to time and becoming, see also C. Callender, ‘Thermodynamic Asymmetry in Time’ (SEP) and the entries on ‘Collapse Theories’ and ‘Bohmian Mechanics’.",
  },
];

export default function References() {
  return (
    <main className="relative">
      <Nav />
      <div className="mx-auto max-w-3xl px-6 sm:px-10 py-32">
        <div className="eyebrow mb-3">References</div>
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-[var(--ink-0)] mb-10">
          Sources &amp; further reading.
        </h1>
        <p className="prose-bu">
          This site is a popular treatment, not a textbook — but every
          claim in it can be traced back to a source, and we’ve tried to
          be scrupulous in doing so. Primary papers are cited where
          feasible; secondary literature is included when it’s a more
          accessible entry point.
        </p>
        <div className="mt-14 space-y-10">
          {REFS.map((r) => (
            <div
              key={r.id}
              id={r.id}
              className="border-l-2 border-[var(--rule)] pl-6 scroll-mt-24"
            >
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-mono text-[11px] text-[var(--ember-faint)]">
                  [{r.n}]
                </span>
                <span className="eyebrow">{r.year}</span>
              </div>
              <div className="font-serif text-xl text-[var(--ink-0)] mb-1">
                {r.title}
              </div>
              <div className="text-[var(--ink-1)] text-[15px] mb-1">
                {r.authors}
              </div>
              <div className="text-[var(--ink-2)] text-[14px] font-mono mb-3">
                {r.where}
              </div>
              {r.note && (
                <div className="prose-bu text-[15px]">{r.note}</div>
              )}
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-[var(--ember)] text-[14px] underline underline-offset-4"
                >
                  {r.url}
                </a>
              )}
            </div>
          ))}
        </div>
        <div className="mt-20 hairline pt-10">
          <p className="prose-bu text-[15px] text-[var(--ink-2)]">
            Inaccuracies are the maintainers’ responsibility, not the
            cited authors’. Corrections welcome.{" "}
            <Link href="/" className="text-[var(--ember)] underline">
              Return to the walkthrough.
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
