# ModelDuel contributor guidance

## Design System

Always read `DESIGN.md` before making visual or UI decisions. Font choices,
colors, spacing, motion, brand construction, and the distinction between learner,
scientific, and verified evidence are defined there. Do not deviate without an
explicit product decision. In QA, flag code that does not match `DESIGN.md`.

UI/UX Pro Max is a research catalog, not a source of truth. Read
`docs/UI_UX_PRO_MAX_REFERENCE.md` before using its scripts. Do not introduce
Tailwind, shadcn/ui, remote fonts, generated `design-system/` output, or other UI
dependencies through that skill without a separate decision.
