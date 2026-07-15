# ModelDuel P0 product contract

## Promise

ModelDuel makes a learner's causal model visible, asks for a prediction before revealing evidence, and records whether the learner can revise and transfer the new understanding. P0 covers complete Moon-phases and seasons challenges; it does not promise an all-subject simulation generator.

## Primary user

A middle-school learner using a desktop browser without an account or headset. A teacher may review the final revision trace, but classroom administration is outside P0.

## State machine

```text
LANDING
  -> CAPTURE (live text or sketch; verified sample may start empty)
  -> INTERPRET (structured learner model reviewed by learner)
  -> PREDICT (one answer is locked before evidence)
  -> OBSERVE (learner and scientific worlds run the same case)
  -> REVISE (learner explains what changed and why)
  -> TRANSFER (new condition tests the revised model)
  -> TRACE (initial belief through transfer result)
```

Recoverable validation and network errors remain in the current state with the learner's input preserved. The learner reviews and confirms the interpreted model before prediction. Evidence never appears before the prediction is locked and the learner explicitly runs the comparison.

## P0 acceptance criteria

### Capture and interpretation

- In live mode, a learner can submit a non-empty explanation, one validated sketch, or both. An explicitly selected verified sample may start from an empty capture.
- The server uses the Responses API with `store: false`; secrets never reach browser code.
- Text/image output parses into a strict, versioned learner-model schema.
- The learner reviews and confirms the plain-language interpretation; P0 does not provide free-form editing at this step.
- Authored verified data is explicitly selected, labeled, and never presented as a live response or automatic fallback.

### Prediction and evidence

- The app selects a case where the learner and scientific models predict observably different outcomes.
- The learner must lock a prediction before either outcome is shown.
- A deterministic, allow-listed WorldSpec renders both worlds under identical conditions.
- Both scenario renderers provide pointer controls, keyboard-focusable viewpoints, and a semantic fallback when WebGL is unavailable.
- Moon phases contrasts Earth-shadow and viewing-angle models; seasons contrasts distance-only and axial-tilt models across both hemispheres.

### Revision and transfer

- The learner submits a revised causal explanation after observation.
- A new transfer condition is not a verbatim repeat of the observed case.
- The final trace contains initial belief, locked prediction, observation, revision, and transfer result.
- Failure states do not erase completed steps, fabricate a score, or expose raw model reasoning.

### Scenario isolation

- The scenario selector is available only during capture. Changing it starts a fresh session and resets every downstream step atomically.
- Analyze, revision, and transfer responses are accepted only for the active session and scenario. Aborted or stale cross-scenario responses cannot repopulate a reset flow.
- Moon phases and seasons each complete the same capture → interpret → predict → observe → revise → transfer → trace journey.

### Seasons science boundary

- Earth's axial tilt changes the angle and concentration of incoming sunlight, and the two hemispheres experience opposite seasons. This causal framing follows [NASA Space Place](https://spaceplace.nasa.gov/seasons/en/), [NOAA NESDIS](https://www.nesdis.noaa.gov/about/k-12-education/understanding-our-planet/why-does-earth-have-seasons), and [NOAA NDBC](https://www.ndbc.noaa.gov/education/seasons.shtml).
- Earth-Sun distance variation is included in the deterministic comparison, but it is not the primary seasonal driver and cannot explain opposite seasons in the two hemispheres.
- Displayed energy values are simplified relative incident-energy indices for comparing the two causal models, not a full climate, temperature, or day-length forecast.

### Quality gate

- The primary flow works at desktop and responsive widths without authentication.
- Semantic headings, labels, focus visibility, and reduced-motion behavior are verified.
- Unit tests cover schemas and deterministic domain logic; Playwright covers the complete P0 path.
- Lint, strict typecheck, unit tests, production build, and Chromium E2E pass on the submission commit.

## Explicitly outside P0

WebXR, teacher class management, free-form arbitrary simulations, voice conversation, additional science domains, and generated executable rendering code.
