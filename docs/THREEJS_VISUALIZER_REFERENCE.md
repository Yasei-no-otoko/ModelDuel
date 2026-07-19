# Three.js visualizer reference

Reviewed: 2026-07-19
Scope: ModelDuel hero visualization and evidence-world scenes

## Locked runtime

| Package | Project | Current official release | Decision |
| --- | ---: | ---: | --- |
| `three` | 0.185.1 | r185 / 0.185.1 | Keep |
| `@react-three/fiber` | 9.6.1 | 9.6.1 | Keep |
| `@react-three/drei` | Not installed | 10.7.7 stable | Do not add |

The project already uses the current Three.js and React Three Fiber releases.
Drei v11 is prerelease, and ModelDuel does not need another dependency for its
small deterministic scenes or native camera controls.

## Renderer decision

Use React Three Fiber `Canvas` with `WebGLRenderer`. Do not introduce WebGPU for
this submission: React Three Fiber documents WebGPU support as work in progress
and not fully backwards-compatible. ModelDuel has no WebGPU- or TSL-specific
requirement.

## Rendering contract

- Keep every Canvas client-only through `next/dynamic` with `ssr: false`.
- Keep `frameloop="demand"` and call `invalidate()` only after an explicit view
  change.
- Use `dpr={reducedMotion ? 1 : [1, 1.5]}`.
- Preserve R3F defaults: sRGB output, ACES Filmic tone mapping, and modern color
  management.
- Do not enable legacy or linear color modes, manual gamma correction, HDR
  environments, post-processing, remote 3D assets, or continuous decorative
  animation.
- Put a semantic HTML fallback and a render error boundary behind every Canvas.

## Motion and performance

- Use refs and delta-based mutation inside `useFrame`; do not update React state
  or allocate objects per frame.
- Reduced motion means no autonomous 3D animation.
- The hero exists only in the Capture stage; the two evidence canvases exist only
  in Observe. This keeps the maximum simultaneous Canvas count at two.
- Consider a shared Canvas through Drei `View` only if profiling demonstrates a
  context-pressure or mobile-performance regression.

## Accessibility

- Canvas receives a concise `role="img"` label.
- View selection remains in native buttons with descriptive labels and pressed
  state.
- The DOM fallback communicates the same learner-model, scientific-model, and
  evidence distinction without WebGL.
- Essential claims and observations remain in normal document text, never only
  in pixels or color.

## Official sources

- [Three.js r185 release](https://github.com/mrdoob/three.js/releases/tag/r185)
- [Three.js color management](https://threejs.org/manual/en/color-management.html)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- [React Three Fiber Canvas](https://r3f.docs.pmnd.rs/api/canvas)
- [React Three Fiber scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [React Three Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [React Three Fiber v9.6.1 release](https://github.com/pmndrs/react-three-fiber/releases/tag/v9.6.1)
- [Drei View](https://github.com/pmndrs/drei/blob/master/docs/portals/view.mdx)
- [Next.js lazy loading and client-only components](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr)
