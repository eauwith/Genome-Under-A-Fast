# Genome Under a Fast

An interactive WebGL model tracing one stimulus — intermittent fasting — through five
scales of the genome: nuclear architecture, chromatin/histone marks, DNA methylation,
gene activity, and downstream phenotype. Built with [three.js](https://threejs.org/)
for the 3D scenes and [GSAP](https://gsap.com/) for animated transitions.

Move the metabolic-state slider (Fed → Extended fast) and pick a gene to inspect;
every panel — the nuclear compartment/loop diagram, the nucleosome fiber, the DNA
methylation helix, the expression bars, and the phenotype gauges — recomputes and
animates together. Each 3D scene supports drag-to-rotate and scroll-to-zoom.

Six genes are modeled (SIRT1, FOXO3, PPARGC1A/PGC-1α, ATG7, RPS6KB1, IL6), spanning
both fasting-induced and fasting-suppressed programs, with values that synthesize
established fasting/epigenetics biology (see the in-app "About this model" section
for what's grounded vs. illustrative).

## Structure

```
src/
  data.js             gene dataset (fed/fasted pairs) + interpolation helpers
  theme.js            reads CSS custom properties into JS-usable colors
  sway.js             idle turntable motion for the 3D scenes
  scene-nucleus.js     3D scene: chromosome territories, A/B compartment, CTCF loop
  scene-chromatin.js   3D scene: nucleosome fiber + histone PTM flags
  scene-helix.js       3D scene: DNA double helix + CpG methylation markers
  main.js              DOM wiring, SVG bar/gauge charts, master update loop
  styles.css           design tokens (light/dark) + layout
index.html             dev shell — loads dist/bundle.{js,css}
build-artifact.mjs     inlines the minified bundle into a single self-contained page
```

## Develop

```bash
npm install
npm run build   # writes dist/bundle.js + dist/bundle.css
npm run serve   # serves this directory at http://localhost:8935
```

Then open `http://localhost:8935/index.html`. Re-run `npm run build` after editing
anything in `src/`.

## Build the standalone artifact

```bash
npm run build:artifact
```

Writes `dist/artifact.html` — a single self-contained file (CSS and minified JS
inlined, no external requests) suitable for publishing anywhere as one page.

## Disclaimer

Educational model, not medical advice. Exact percentages and the smooth 0–100 slider
are an illustrative synthesis, not measurements from one dataset — see the in-app
methodology notes for details and caveats.
