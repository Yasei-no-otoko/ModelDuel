# ModelDuel analytical 3D visualization contract

Approved baseline: the current production Evidence Lab composition at 1600 × 900
and 375 × 812. This iteration refines its scientific visual language without
replacing the approved page hierarchy.

## Claim and audience

The same sealed observation distinguishes an Earth-shadow claim from the
scientific illumination-and-viewing-angle model. The primary audiences are a
middle-school learner who must understand the causal difference and a hackathon
judge who must verify that the 3D view is functional rather than decorative.

## Truth invariants

- Gold arrows encode incoming sunlight direction, never a quantitative energy
  value.
- Violet tapered geometry encodes only the learner's proposed Earth umbra.
- Cyan vectors encode the Earth-to-Moon viewing relationship.
- Green rings and readouts encode server-verified evidence.
- The Moon first-quarter case remains 90 degrees elongation, 50% illuminated,
  with no Earth-shadow intersection.
- Body sizes and distances are visually exaggerated and remain labelled not to
  scale.
- Both seasons panels retain the physical 23.44 degree axial tilt. The learner
  panel expresses that its distance-only model ignores the tilt's causal effect;
  it must not imply that the learner claims Earth is physically upright.
- Seasons halo equality encodes the learner model's same-hemisphere-response
  prediction. Unequal halo size in the science panel encodes the validated
  north/south relative incident-energy values.

## Data-to-scene mapping

| Concept | WebGL mark | Semantic DOM redundancy |
| --- | --- | --- |
| Sunlight direction | Gold line with arrowhead | `Sunlight direction` legend |
| Learner shadow claim | Violet tapered cone | `Proposed umbra misses Moon` legend |
| Viewing relation | Cyan line with arrowhead | `Earth-to-Moon view` legend |
| Sealed quarter phase | Green 90 degree arc and Moon target | Angle and verified-result text |
| Seasons energy | North/south halo radius | Exact energy values in legend and evidence card |
| Selected model | Thin amber/cyan/green focus ring | Pressed button and live caption |

## Renderer and interaction

- React Three Fiber 9.6.1 owns every Three.js 0.185.1 renderer.
- Capture owns one Canvas. Observe owns two Canvases after Capture unmounts.
- `frameloop="demand"` is mandatory. There is no autonomous bob, pulse,
  rotation, particle field, or independent animation loop.
- Hero camera states are `learner`, `scientific`, and `evidence`.
- Evidence camera states are `overview`, `earth`, and `plane`; `overview` is the
  deterministic reset frame.
- Canvas controls are native buttons. No insight depends on drag, hover, or
  color alone.
- Desktop DPR is bounded to 1–1.5. Viewports at 520px and below, plus all
  reduced-motion sessions, use DPR 1.

## Failure and accessibility contract

- Capability detection must create the actual WebGL2 renderer used by Three.js;
  a WebGL1-only context is not sufficient.
- Renderer construction failure, React render failure, or a runtime
  `webglcontextlost` event must replace the Canvas with the complete semantic
  HTML diagram.
- Context loss is a permanent fallback for the affected Canvas. It does not
  mutate the cached device capability or force healthy sibling Canvases into a
  stale shared state.
- Canvas exposes an accessible image name. Exact claims, values, legends,
  controls, and conclusions remain in the DOM.
- The fallback and Canvas are mutually exclusive for each viewport.
- The default and final still frames are the shared-evidence overview and must
  communicate the conclusion without motion.

## Acceptance frames and checks

- Hero: 1600 × 900, 1280 × 720, 768 × 1024, and 375 × 812.
- Evidence: Moon and Seasons overview plus named alternate views.
- One Canvas in Capture, two in Observe, zero under forced WebGL failure.
- No horizontal overflow, no console/page errors, and 44px minimum native
  controls on mobile.
- Focus state, pressed state, camera state, caption, and live announcement stay
  synchronized.
- Reduced-motion and settled default screenshots remain stable across time.
