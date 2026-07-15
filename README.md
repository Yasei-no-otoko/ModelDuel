# ModelDuel

**Two models predict. Evidence decides.**

ModelDuel is an Education-category learning experience that turns a learner's explanation into two comparable worlds: the learner's current mental model and the scientific model. The learner commits to a prediction, observes both worlds under the same conditions, revises the explanation, and demonstrates transfer. The goal is evidence of conceptual change—not another generated answer.

The first complete challenge focuses on the common misconception that Earth's shadow causes the phases of the Moon. A second challenge reuses the same solar-system foundation to contrast distance-based and axial-tilt explanations of the seasons.

## Current scope

This repository currently contains the product contract, an accessible landing experience, shared flow definitions, and automated smoke coverage. Runtime OpenAI calls, the deterministic 3D world engine, prediction locking, revision grading, and the transfer test remain P0 implementation work. The landing-page misconception is an authored example and is never represented as a live model response.

## Requirements

- A supported non-EOL Node.js release satisfying `>=22.13.0` (`.nvmrc` pins Node.js `24.18.0`)
- pnpm `11.13.0` (supported range: `>=11.13.0 <12`)
- An OpenAI API key for server-side runtime work

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Add the API key to `.env.local` only when working on the server integration.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For live AI flows | Server-only OpenAI credential. Never prefix with `NEXT_PUBLIC_`. |
| `OPENAI_MODEL` | No | Normal runtime model; defaults to `gpt-5.6-terra`. |
| `OPENAI_HERO_MODEL` | No | Explicit hero-flow override; defaults to `gpt-5.6-sol`. |

No browser component may import, serialize, log, or proxy the API key. Browser requests terminate at a validated Next.js server route; only that route may create the OpenAI client. All learner-data requests use `store: false`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local Next.js development server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Serve an existing production build. |
| `pnpm lint` | Run ESLint with zero warnings allowed. |
| `pnpm typecheck` | Run strict TypeScript checking without emitting files. |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Run Vitest in watch mode. |
| `pnpm test:e2e` | Run Playwright against Chromium. In CI, build first. |
| `pnpm check` | Run lint, typecheck, unit tests, and production build. |

## Architecture

```text
Browser learning flow
        |
        v
Validated Next.js server routes
        |
        +--> OpenAI Responses API
        |    - image + text understanding
        |    - structured learner model
        |    - validated tool orchestration
        |
        v
Allow-listed WorldSpec
        |
        v
Deterministic Three.js simulation and comparison
        |
        v
Revision trace and transfer result
```

OpenAI does not generate or execute arbitrary Three.js code. It produces schema-constrained data; application code validates that data again and renders only allow-listed bodies, relationships, cameras, and scenarios. See [`docs/OPENAI_SDK_REFERENCE.md`](docs/OPENAI_SDK_REFERENCE.md) for the pinned SDK contract and [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) for the P0 state machine.

## Codex, GPT-5.6, and human judgment

- **Codex** is the build partner: repository creation, implementation, review, tests, documentation, and traceable commits. The submission will link the qualifying Codex session.
- **GPT-5.6 Terra** is the default runtime tier for structured interpretation, grading, and transfer-question work.
- **GPT-5.6 Sol** is an explicit hero-flow override for the strongest sketch interpretation and reasoning quality.
- **Humans** define the science boundaries, approve misconception cases, select the pedagogical sequence, review safety and privacy behavior, and decide whether generated feedback is suitable for learners.

Neither Codex nor GPT-5.6 is treated as the authority on astronomy. Deterministic application rules and human-reviewed content remain the source of truth.

## Authored samples and live responses

An authored fixture may keep a demo coherent when network access is unavailable, but it must be visibly labeled as a sample. A cached or authored response must never be presented as a live GPT response. Live mode must disclose failures rather than silently replacing them with a fixture. Demo capture and submission copy must preserve this distinction.

## Build Week provenance

This repository was initialized from an empty root commit during the eligible Build Week. Application code, product documentation, tests, demo assets, and submission materials are being created within that window. Third-party packages are identified in `package.json`; no pre-existing application code is being represented as Build Week work.

## Submission checklist

- [ ] Complete the Moon-phases input → predict → observe → revise → transfer flow.
- [ ] Complete and label the seasons comparison as the second challenge.
- [ ] Verify live GPT-5.6 requests use the Responses API and `store: false`.
- [ ] Verify authored samples cannot be mistaken for live responses.
- [ ] Run `pnpm check` and `pnpm test:e2e` on the submission commit.
- [ ] Verify desktop and responsive layouts, keyboard flow, and reduced motion.
- [ ] Record the English demo narration at no more than three minutes.
- [ ] Document Build Week commits and any third-party assets.
- [ ] Run `/feedback` in the primary Codex session before submission and add the returned Session ID here and to the Devpost entry.
- [ ] Complete the final Education-category Devpost fields and public repository link.

**Codex Session ID:** Pending `/feedback` immediately before submission.

## License

[MIT](LICENSE)
