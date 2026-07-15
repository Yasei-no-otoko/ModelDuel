# ModelDuel P0 product contract

## Promise

ModelDuel makes a learner's causal model visible, asks for a prediction before revealing evidence, and records whether the learner can revise and transfer the new understanding. P0 covers a complete Moon-phases challenge and a second seasons demonstration; it does not promise an all-subject simulation generator.

## Primary user

A middle-school learner using a desktop browser without an account or headset. A teacher may review the final revision trace, but classroom administration is outside P0.

## State machine

```text
LANDING
  -> CAPTURE (text required; sketch optional)
  -> INTERPRET (structured learner model reviewed by learner)
  -> PREDICT (one answer is locked before evidence)
  -> OBSERVE (learner and scientific worlds run the same case)
  -> REVISE (learner explains what changed and why)
  -> TRANSFER (new condition tests the revised model)
  -> TRACE (initial belief through transfer result)
```

Recoverable validation and network errors remain in the current state with the learner's input preserved. A learner may edit the interpreted model before prediction. After prediction lock, changing the model starts a new attempt; evidence never appears before lock.

## P0 acceptance criteria

### Capture and interpretation

- A learner can submit a non-empty explanation and optionally one validated sketch.
- The server uses the Responses API with `store: false`; secrets never reach browser code.
- Text/image output parses into a strict, versioned learner-model schema.
- The learner can confirm or correct the plain-language interpretation.
- Authored fallback data is labeled and never presented as a live response.

### Prediction and evidence

- The app selects a case where the learner and scientific models predict observably different outcomes.
- The learner must lock a prediction before either outcome is shown.
- A deterministic, allow-listed WorldSpec renders both worlds under identical conditions.
- Moon-phase controls and camera behavior remain usable with keyboard and pointer input.
- The seasons demonstration reuses the solar-system engine and contrasts both hemispheres.

### Revision and transfer

- The learner submits a revised causal explanation after observation.
- A new transfer condition is not a verbatim repeat of the observed case.
- The final trace contains initial belief, locked prediction, observation, revision, and transfer result.
- Failure states do not erase completed steps, fabricate a score, or expose raw model reasoning.

### Quality gate

- The primary flow works at desktop and responsive widths without authentication.
- Semantic headings, labels, focus visibility, and reduced-motion behavior are verified.
- Unit tests cover schemas and deterministic domain logic; Playwright covers the complete P0 path.
- Lint, strict typecheck, unit tests, production build, and Chromium E2E pass on the submission commit.

## Explicitly outside P0

WebXR, teacher class management, free-form arbitrary simulations, voice conversation, additional science domains, and generated executable rendering code.
