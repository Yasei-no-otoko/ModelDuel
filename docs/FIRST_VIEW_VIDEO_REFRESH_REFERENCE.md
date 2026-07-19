# First-view 3D and submission-video reference

Reviewed: 2026-07-19 JST

## Locked runtimes

| Package | Project version | Decision |
|---|---:|---|
| `@playwright/test` | 1.61.1 | Keep the manual `browser.newContext({ recordVideo })` recorder and close the context before reading the video path. |
| `@react-three/fiber` | 9.6.1 | Use `useFrame` for lightweight direct object mutation; never call React state setters inside the render loop. |
| `three` | 0.185.1 | Keep the current deterministic geometry and WebGL renderer. |

## Current documentation check

- Playwright records the configured viewport into `recordVideo.size`; closing the browser context is required to flush the video before the artifact is consumed.
- Playwright's context-level `reducedMotion` option emulates the corresponding media feature. The previous submission recorder forced `reduce`, which is appropriate for accessibility screenshots but would intentionally stop the new hero motion in the demo video.
- React Three Fiber's supported continuous-animation path is `useFrame`. Per-frame work should mutate object refs directly and remain small.
- React Three Fiber exposes `frameloop` modes `always`, `demand`, and `never`. The landing hero may use `always` when motion is allowed because it unmounts before the two evidence canvases mount; reduced-motion users keep demand rendering.

## Implementation decisions

1. The 3D scene viewport must be visible without scrolling at both 1600 × 900 and 1280 × 720 desktop recording breakpoints.
2. The complete visualizer, including controls and caption, should fit in the 1600 × 900 submission-video frame.
3. Motion is limited to slow, non-semantic float/rotation/pulse transforms. It must not change the deterministic test case or scientific evidence.
4. `prefers-reduced-motion: reduce` keeps the scene static and at DPR 1.
5. The recorder uses `reducedMotion: "no-preference"` so the video demonstrates the motion requested for the landing page. This does not change the public accessibility behavior.
6. The approved narration text remains unchanged so all ten existing OpenAI TTS segments remain cache hits and the refresh requires zero Speech API calls.

## Primary sources

- [Playwright videos](https://playwright.dev/docs/videos)
- [Playwright Video API](https://playwright.dev/docs/api/class-video)
- [Playwright Browser API](https://playwright.dev/docs/api/class-browser)
- [React Three Fiber hooks](https://r3f.docs.pmnd.rs/api/hooks)
- [React Three Fiber basic animations](https://r3f.docs.pmnd.rs/tutorials/basic-animations)
- [React Three Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
