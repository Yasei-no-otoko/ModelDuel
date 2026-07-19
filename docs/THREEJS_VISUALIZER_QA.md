# Three.js visualizer QA record

Date: 2026-07-19 JST
Branch: `codex/modelduel-threejs-visualizer`

## Architecture and scope

- Preserved the existing React Three Fiber architecture instead of introducing a second vanilla Three.js runtime.
- Added a client-only landing-page hero visualizer with a semantic static fallback when WebGL is unavailable.
- Evidence views use `frameloop="demand"` and explicit invalidation. The Capture hero uses a small ref-mutation animation loop only while motion is allowed; reduced-motion switches it to demand rendering at DPR 1. All 3D views remain capped at DPR 1.5.
- Limited the experience to at most two simultaneous WebGL canvases: one hero canvas during Capture, or two evidence canvases during Observe. The hero unmounts before the evidence pair mounts.
- Reused deterministic geometry and shader-free materials for the hero, Moon phases, and seasons. No generated code, runtime model loading, or remote visual dependencies are used.
- Evidence scenes are lit by the modeled Sun point light. The conceptual hero keeps restrained fill lighting so its three explanatory layers remain legible.

## Asset and decoder manifest

| Type | Runtime dependency |
|---|---|
| External models | None |
| External textures | None |
| Remote images | None |
| Draco / Meshopt / KTX2 decoders | None |
| New npm packages | None |

The previous observatory illustration was removed from the runtime and repository because the deterministic visualizer now communicates the same concept directly.

## Automated verification

| Check | Result |
|---|---|
| Installed skill validator | Pass |
| `THREEJS_VISUALIZER_SPEC.json` validator | Pass; expected `modelUrl: null` advisory only |
| `pnpm check` | Pass: lint, typecheck, 363/363 Node tests, 7/7 Workers tests, video contract, production build |
| Playwright Chromium + WebKit | Pass: 77 passed, 1 intentional non-Chromium axe skip |
| Targeted Chromium a11y/mobile | Pass: WCAG A/AA, mobile entry, and caption legibility |
| Bundle budget | Pass: 2,126.9 KiB raw total, 1,873.7 KiB JavaScript, 52.2 KiB CSS, 713.2 KiB aggregate gzip |
| `pnpm cf:typecheck` | Pass: OpenNext 1.20.1 build and checked-in Workers types |
| Wrangler deploy dry run | Pass: 8,843.33 KiB raw / 1,705.07 KiB gzip, 43 static asset files |
| `git diff --check` | Pass |

The installed skill's static auditor assumes its vanilla `index.html` / `src/main.ts` scaffold and therefore reports non-applicable findings for this R3F application, including missing vanilla entrypoints and OrbitControls. The R3F-specific checks above, browser probes, interaction tests, and manual inspection are the authoritative verification for this integration.

## Runtime states inspected

- First-view refresh, local production build: one canvas, no fallback, no console errors, and no horizontal overflow. At 1600 × 900 the scene spans y=475.4–731.4 and the complete visualizer ends at y=870.4. At 1280 × 720 the scene spans y=430.6–661.0. At 768 × 1024 it spans y=637.8–853.8 and precedes the input card.
- Observe stage: two canvases, no fallback, no console errors.
- Reduced motion: media query honored, one canvas, reduced DPR, and the continuous hero loop is paused.
- WebGL unavailable: zero canvases and one complete semantic fallback.
- Keyboard focus controls expose Learner claim, Science model, and Shared evidence without requiring pointer drag.

The Three.js `Clock` deprecation warning observed in development comes from the current React Three Fiber dependency path; application code does not instantiate `THREE.Clock`, and no runtime console errors were observed.

## Environment limitation

The local Playwright macOS Firefox Nightly runner hangs on a blank-page `page.evaluate` outside the application. No product-specific Firefox workaround was added. Chromium and WebKit passed locally; the unchanged Firefox project remains enabled for the Ubuntu GitHub Actions gate.

## Captured evidence

Local captures (not committed):

- `/tmp/modelduel-final-hero-1600x900.png`
- `/tmp/modelduel-final-evidence-1600x900.png`
- `/tmp/modelduel-final-reduced-motion.png`
- `/tmp/modelduel-final-no-webgl.png`
