# The Block Universe — a visualization

**Live site:** https://alextrzyna.github.io/bu-visualizer/

A contemplative, scroll-driven walkthrough of the *block universe* view of
time — the idea that the past, present, and future all exist equally in a
single four-dimensional spacetime, and that our experience of time
"flowing" is a feature of memory-bearing minds, not of reality. The site
ends with an interactive 3D visualization of a single human life as a
worldline threaded through that block.

## What's in it

- **A seven-chapter walkthrough** — full-bleed 3D scenes, scroll-linked
  prose, and footnoted citations to the primary sources (Einstein 1905,
  Minkowski 1908, Rietdijk 1966, Putnam 1967, Boltzmann's H-theorem,
  Eddington's "arrow of time", Carroll, Rovelli, Price).
  1. **The spotlight of now** — naive intuition of time's flow.
  2. **Simultaneity is not absolute** — interactive Lorentz boost; the
     plane of simultaneity tilts as you slide the observer's velocity.
  3. **Here is what stays fixed** — Minkowski light cones; future, past,
     and "elsewhere" labelled.
  4. **Walk one way, and Andromeda slides** — the Rietdijk–Putnam
     argument visualized.
  5. **Why does time seem to flow** — entropy box; particles diffuse
     from a low-entropy corner.
  6. **The moving light is in you** — a worldline with a sliding
     spotlight; the spotlight is consciousness, not the world.
  7. **The block** — the synthesis: many worldlines threaded through one
     wireframe block.
- **The capstone — A Life in the Block** — Greg, a fictional 49-year-old
  Seattle software engineer, rendered as a worldline through 91 years
  of spacetime. Drag the scrubber to move through time. The world map
  beneath the spine zooms and pans to frame whichever city/region Greg
  is in at that moment, and a heat map of his ~30 micro-locations
  (home, office, parks, friends' houses, kids' schools) glows brightest
  on places he visits most. Two viewing modes:
  - **Block view** — the whole life is visible at once; the camera
    auto-orbits.
  - **Experiential** — the camera flies along the worldline,
    autoplaying the life from the current scrubber position.
- **References** — every numbered citation in the prose links to a full
  bibliographic entry on the references page.

## Stack

- **Next.js 16** (App Router, static export for GitHub Pages)
- **React 19** + **TypeScript**
- **React Three Fiber** + **drei** + **postprocessing** for the 3D
  scenes (Bloom + Vignette)
- **Tailwind CSS v4** for layout and theming
- **Three.js** worldline geometry; canvas-rendered Natural Earth
  landmass texture from `world-atlas` / `topojson-client`
- **GSAP**, **Framer Motion**, **Zustand** for interaction polish

## Local development

```bash
npm install
npm run dev          # http://localhost:3000 by default
```

There's also a screenshot helper for visual regression checks during
development:

```bash
npm run shot                              # home page
npm run shot -- /your-life                # the capstone
npm run shot -- / 3                       # home, scrolled to chapter 3
npm run shot -- /your-life 0.35           # capstone at 35% progress

# Resolution / mode overrides via env:
BU_WIDTH=1800 BU_HEIGHT=1100 npm run shot -- /your-life 0.5
BU_MODE=experiential        npm run shot -- /your-life 0.5
```

## Building for static hosting

```bash
NEXT_PUBLIC_BASE_PATH=/bu-visualizer npm run build
# → out/  (push to gh-pages, or let .github/workflows/deploy.yml
#   pick it up on push to main)
```

## A note on the framing

The block-universe view (sometimes called *eternalism*) is one
interpretation of what relativity tells us about time. It is **not** the
unanimous view among physicists or philosophers — competing positions
(*presentism* and the *growing-block* theory) are still seriously
defended. The site presents the block view as the most natural reading
of relativity at face value while linking out to the open debate via
the Stanford Encyclopedia of Philosophy.

---

Built with [Claude Code](https://claude.com/claude-code).
