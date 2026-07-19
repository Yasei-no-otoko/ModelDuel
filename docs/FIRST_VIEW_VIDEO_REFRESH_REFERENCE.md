# First-view 3D and submission-video reference

Reviewed: 2026-07-20 JST

## Locked runtimes

| Package | Project version | Decision |
|---|---:|---|
| `@playwright/test` | 1.61.1 | Keep the manual `browser.newContext({ recordVideo })` recorder and close the context before reading the video path. |
| `@react-three/fiber` | 9.6.1 | Use `useFrame` for lightweight direct object mutation; never call React state setters inside the render loop. |
| `three` | 0.185.1 | Keep the current deterministic geometry and WebGL renderer. |

## Current documentation check

- Playwright records the configured viewport into `recordVideo.size`; closing the browser context is required to flush the video before the artifact is consumed.
- The pinned Playwright 1.61.1 recorder remains compatible with the current
  context-level `recordVideo` contract. The newer screencast API is not needed
  for this deterministic 1600 × 900 export.
- Playwright's context-level `reducedMotion` option emulates the corresponding media feature. The refined hero is readable as a still and no longer relies on autonomous motion.
- React Three Fiber's supported continuous-animation path is `useFrame`. Per-frame work should mutate object refs directly and remain small.
- React Three Fiber exposes `frameloop` modes `always`, `demand`, and `never`. The landing hero now uses `demand` for every motion preference because its changes are explicit focus/camera states.
- OpenAI still lists `tts-1` for the Speech endpoint. This refresh reuses the
  approved ten-segment `nova` cache and does not opt into paid generation.
- Devpost still requires a sub-three-minute public YouTube demo with audio that
  explains the product and the use of Codex and GPT-5.6. The deadline is July
  21, 2026 at 5:00 PM PDT / July 22 at 9:00 AM JST.

## Implementation decisions

1. The 3D scene viewport must be visible without scrolling at both 1600 × 900 and 1280 × 720 desktop recording breakpoints.
2. The complete visualizer, including controls and caption, should fit in the 1600 × 900 submission-video frame.
3. Non-semantic float/rotation/pulse transforms are prohibited. Sunlight, umbra, viewing direction, the 90 degree case, and verified evidence remain legible in the default still.
4. `prefers-reduced-motion: reduce` keeps DPR 1; compact viewports also use DPR 1.
5. The recorder may use either motion preference because the interaction-only scene has the same scientific meaning in both modes.
6. The approved narration text remains unchanged so all ten existing OpenAI TTS segments remain cache hits and the refresh requires zero Speech API calls.
7. The evidence sequence uses the product's named `Earth-side view`, `Plane
   view`, and `Case overview` controls. The obsolete drag gesture is not a
   valid camera interaction in the refined evidence view.

## Primary sources

- [Playwright videos](https://playwright.dev/docs/videos)
- [Playwright Video API](https://playwright.dev/docs/api/class-video)
- [Playwright Browser API](https://playwright.dev/docs/api/class-browser)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [React Three Fiber hooks](https://r3f.docs.pmnd.rs/api/hooks)
- [React Three Fiber basic animations](https://r3f.docs.pmnd.rs/tutorials/basic-animations)
- [React Three Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [OpenAI TTS-1 model](https://developers.openai.com/api/docs/models/tts-1)
- [OpenAI Build Week official rules](https://openai.devpost.com/rules)
