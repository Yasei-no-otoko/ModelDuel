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

Three.js r185 no longer supports WebGL1. The previous landing-page probe accepted
either `webgl2` or `webgl`, which could report a false positive before renderer
construction. Capability detection now creates and disposes the actual
`WebGLRenderer` inside the client-only 3D chunk, and every Canvas switches to its
semantic fallback on a runtime `webglcontextlost` event.

## Rendering contract

- Keep every Canvas client-only through `next/dynamic` with `ssr: false`.
- Keep `frameloop="demand"` and call `invalidate()` only after an explicit named
  view change.
- Use DPR 1 on compact viewports and for reduced motion; cap other viewports at
  1.5.
- Preserve R3F defaults: sRGB output, ACES Filmic tone mapping, and modern color
  management.
- Do not enable legacy or linear color modes, manual gamma correction, HDR
  environments, post-processing, remote 3D assets, or continuous decorative
  animation.
- Put a semantic HTML fallback and a render error boundary behind every Canvas.

## Motion and performance

- Do not use a continuous frame loop for this static comparison. The prior
  bob/rotation/pulse motion was visually attractive but did not encode data.
- The default frame is a complete still. Focus and camera buttons request only
  the frames required for their state change.
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
- [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [React Three Fiber Canvas](https://r3f.docs.pmnd.rs/api/canvas)
- [React Three Fiber scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [React Three Fiber performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls)
- [React Three Fiber v9.6.1 release](https://github.com/pmndrs/react-three-fiber/releases/tag/v9.6.1)
- [Drei View](https://github.com/pmndrs/drei/blob/master/docs/portals/view.mdx)
- [Next.js lazy loading and client-only components](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr)

`InstancedMesh` remains intentionally unused: each scene contains only a few
semantic bodies/vectors, so instancing would add indirection without a meaningful
draw-call reduction.
