# Three.js visualizer QA record

Date: 2026-07-19 JST
Implementation merge: `96b93d4`
Production version: `cd38e435-7875-4125-bfbb-c7f5a4d092d0`

## Analytical data-visualization refinement

Branch: `codex/modelduel-threejs-data-refinement`

- Replaced the autonomous hero bob/tilt/pulse loop and decorative star field
  with interaction-only, `frameloop="demand"` rendering.
- Added explicit sunlight arrows, a learner-claim umbra, the sealed 90 degree
  Moon angle, Earth-to-Moon viewing vectors, and a verified 50% / no-shadow
  readout. Every mark has a semantic DOM legend.
- Derived both hero worlds from the same perpendicular Sun-Earth-Moon layout,
  so the labelled 90 degree case is also geometrically 90 degrees on screen.
- Replaced arbitrary degree stepping with the named `Case overview`,
  `Earth-side view`, and `Plane view` camera states.
- Kept the physical 23.44 degree axis in both Seasons panels. The learner panel
  now encodes an equal-response prediction while the science panel maps the
  validated north/south relative-energy values to unequal halos.
- Changed the shared capability gate from a WebGL1-or-WebGL2 probe to actual
  Three.js `WebGLRenderer` construction inside the lazy 3D chunk. Runtime
  `WEBGL_lose_context` now swaps only the affected Canvas to the complete
  semantic fallback without corrupting the shared capability snapshot.
- Compact and reduced-motion viewports use DPR 1; other views remain capped at
  1.5. Mobile scene legends occupy the lower viewport band instead of extending
  the page.

Local verification for this refinement:

| Check | Result |
| --- | --- |
| `pnpm check` | Pass: lint, typecheck, 363/363 Node, 7/7 workerd, 46-test video contract, production build |
| Playwright Chromium | Pass: 46/46 |
| Playwright WebKit | Pass: 44 passed / 2 intentional Chromium-only skips |
| Renderer-loss and construction-failure probes | Pass: semantic fallback only, zero inert camera controls |
| Responsive visual inspection | Pass: 1600×900 and 375×812 hero; 1280px Moon; 375px Moon interactive and forced fallback; 375px Seasons |
| `pnpm cf:typecheck` | Pass: OpenNext build and checked-in Workers bindings |
| Wrangler dry run | Pass: 44 assets; 10,260.84 KiB raw / 1,987.87 KiB gzip |
| Paid API usage | None; verified samples only |

The detailed data-to-scene, camera, motion, fallback, and acceptance contract is
[`THREEJS_DATA_VISUALIZATION_CONTRACT.md`](./THREEJS_DATA_VISUALIZATION_CONTRACT.md).

The sections below preserve the earlier `96b93d4` release record. Where motion,
test totals, bundle totals, or production state differ, the analytical
refinement section above is authoritative for the current branch.

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
| Playwright Chromium + WebKit | Pass: 85 passed, 1 intentional non-Chromium axe skip |
| Ubuntu Chromium + Firefox + WebKit CI | Pass: 127 passed, 2 intentional non-Chromium axe skips |
| Targeted Chromium a11y/mobile | Pass: WCAG A/AA, mobile entry, and caption legibility |
| Bundle budget | Pass: 2,126.9 KiB raw total, 1,873.7 KiB JavaScript, 52.2 KiB CSS, 713.2 KiB aggregate gzip |
| `pnpm cf:typecheck` | Pass: OpenNext 1.20.1 build and checked-in Workers types |
| Cloudflare deployment | Pass: 8,844.13 KiB raw / 1,705.10 KiB gzip, 43 static asset files, startup 45 ms |
| `git diff --check` | Pass |

The installed skill's static auditor assumes its vanilla `index.html` / `src/main.ts` scaffold and therefore reports non-applicable findings for this R3F application, including missing vanilla entrypoints and OrbitControls. The R3F-specific checks above, browser probes, interaction tests, and manual inspection are the authoritative verification for this integration.

## Runtime states inspected

- First-view refresh, Cloudflare production: one canvas, `data-motion="running"`, no fallback, no console errors, and no horizontal overflow. At 1600 × 900 the scene spans y=475.4–731.4 and the complete visualizer ends at y=870.4. At 1280 × 720 the scene spans y=430.6–661.0. At 768 × 1024 it spans y=637.8–853.8 and precedes the input card.
- Observe stage: two canvases, no fallback, no console errors.
- Reduced motion: media query honored, one canvas, reduced DPR, and the continuous hero loop is paused.
- WebGL unavailable: zero canvases and one complete semantic fallback.
- Keyboard focus controls expose Learner claim, Science model, and Shared evidence without requiring pointer drag.

The Three.js `Clock` deprecation warning observed in development comes from the current React Three Fiber dependency path; application code does not instantiate `THREE.Clock`, and no runtime console errors were observed.

## Environment limitation

The local Playwright macOS Firefox Nightly runner hangs on a blank-page `page.evaluate` outside the application. No product-specific Firefox workaround was added. Chromium and WebKit passed locally; the unchanged Firefox project remains enabled for the Ubuntu GitHub Actions gate.

## Captured evidence

Committed production captures are listed in [`README.md`](../README.md#media-and-licensing). The 1600×900 cover and 375×812 mobile capture show the first-view 3D entry; Moon and Seasons evidence captures each show the deterministic two-Canvas comparison.
