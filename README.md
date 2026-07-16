# ModelDuel

**Two models predict. Evidence decides.**

ModelDuel is an Education-category learning experience that turns a learner's explanation into two comparable worlds: the learner's current mental model and the scientific model. The learner commits to a prediction, observes both worlds under the same conditions, revises the explanation, and demonstrates transfer. The goal is evidence of conceptual change—not another generated answer.

The two complete challenges focus on common astronomy misconceptions: that Earth's shadow causes the phases of the Moon, and that Earth-Sun distance causes the seasons. Both use the same protected learning sequence and deterministic solar-system foundation.

## Submission links

- Live demo: [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev)
- Repository: `{{REPOSITORY_URL}}`
- Demo video: `{{VIDEO_URL}}`
- Codex Feedback Session ID: `{{CODEX_FEEDBACK_SESSION_ID}}`

Replace the remaining three placeholders before submission. The Codex Feedback Session ID must come from `/feedback` in the primary build task; never substitute an invented value.

## Current scope

The repository implements complete Moon-phases and seasons browser journeys: text or sketch capture, explicit live or verified analysis, two protected models, prediction locking, deterministic simulation with Three.js rendering, revision feedback, server-authenticated transfer grading, and a Model Revision Trace. The production configuration routes analysis and PTC to GPT-5.6 Terra and live revision feedback to GPT-5.6 Luna. Each scenario has strict server-owned cases, world specifications, transfer questions, and authored verified samples.

Live and verified paths are deliberately separate for both scenarios. Live analysis accepts learner text, a sketch, or both. The verified path is explicitly selected and may start from an empty capture; a failed live request never becomes an authored result automatically. The UI labels the source of analysis and revision feedback. The public transfer token keeps the answer key and live revision context encrypted on the server boundary.

## Judge quick test

### Verified sample — no account or key

1. Open ModelDuel and select **Run verified sample**.
2. Select **Make a prediction**.
3. Choose one option, then select **Lock prediction**.
4. Select **Run both worlds and reveal evidence**.
5. Select **Revise my explanation** and enter this full-scoring Moon revision exactly:

   > The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions of the sunlit half. Earth's shadow does not cause the regular phases; it causes a lunar eclipse.

6. Select **Capture revision and continue**.
7. For the Moon transfer question, choose **The Moon is in the Sun's direction**, then select **Lock and check answer**.
8. Inspect the Model Revision Trace from initial belief through transfer result.
9. Select **New attempt**, choose **Seasons**, and repeat the verified journey. For the Seasons transfer question, choose **The higher-energy hemisphere reverses** before selecting **Lock and check answer**.

### Configured live path

Live analysis requires a server-side `OPENAI_API_KEY`. Enter at least 20 characters of learner text, attach a PNG, JPEG, or WebP sketch up to 3 MiB decoded, or provide both, then deliberately choose the live path. A failed live request remains a disclosed error and never silently falls back to an authored sample. The final Cloudflare build completed one paid Terra analysis/PTC smoke and, only after its usage gate passed, one paid Luna revision smoke with no HTTP retry.

## Requirements

- Node.js `>=22.13.0`; [`.nvmrc`](.nvmrc) pins `24.18.0`.
- pnpm `11.13.0` through `packageManager`; supported engine range `>=11.13 <12`.
- No account or API key for verified samples.
- `OPENAI_API_KEY` only for optional live analysis and revision flows.

## Local setup

Install and start the verified experience first:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js. For optional live flows, stop the server, copy the environment template, add the server-side key, and restart:

```bash
cp .env.example .env.local
```

Do not commit `.env.local` or expose its values in screenshots, videos, logs, or browser code.

## Environment

| Variable | Required | Purpose and fallback |
| --- | --- | --- |
| `OPENAI_API_KEY` | Live flows only | Server-side key for live analysis and live revision. Verified samples require no key. Missing or blank live configuration fails closed. |
| `OPENAI_MODEL` | Optional | Revision fallback; defaults to `gpt-5.6-luna`. |
| `OPENAI_HERO_MODEL` | Optional | Analysis fallback; defaults to `gpt-5.6-terra`. |
| `MODELDUEL_ANALYSIS_MODEL` | Optional | First analysis override. Exact chain: `MODELDUEL_ANALYSIS_MODEL` → `OPENAI_HERO_MODEL` → `gpt-5.6-terra`. |
| `MODELDUEL_REVISION_MODEL` | Optional | First revision override. Exact chain: `MODELDUEL_REVISION_MODEL` → `OPENAI_MODEL` → `gpt-5.6-luna`. |
| `MODELDUEL_EVALUATION_SECRET` | Production | Private AES evaluation-token secret. It is required in production and must be at least 32 characters; development alone may generate an ephemeral secret. |
| `MODELDUEL_TRUSTED_PROXY` | Optional | Only `cloudflare` is accepted and requires origin restriction. Vercel is detected internally with `VERCEL=1`; otherwise forwarded headers are ignored. |
| `MODELDUEL_CLOUDFLARE_RATE_LIMITS` | Cloudflare production | `wrangler.jsonc` sets `enabled`; leave blank under `next dev`. Production fails closed if any required Rate Limiting binding is absent or unavailable. |

All learner-data Responses requests use `store: false`. Live analysis and revision budgets are charged only after validation, configuration, and signed-context preflight. Local tests may inject an isolated in-memory store explicitly; runtime code keeps no module-global mutable counter. Cloudflare production is configured with fail-closed Rate Limiting bindings that check the hashed client before the per-POP aggregate ceiling.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server. |
| `pnpm build` | Create a production build. |
| `pnpm start` | Run the production build. |
| `pnpm lint` | Run lint checks. |
| `pnpm typecheck` | Run TypeScript checks. |
| `pnpm test` | Run unit and integration tests. |
| `pnpm test:watch` | Run tests in watch mode. |
| `pnpm test:e2e` | Run Playwright journeys. |
| `pnpm check` | Run `lint && typecheck && test && build`. |
| `pnpm cf:typegen` | Build the OpenNext entrypoint, then regenerate checked-in Workers binding and runtime types. |
| `pnpm cf:typecheck` | Rebuild the OpenNext entrypoint and verify checked-in Workers types have no drift. |
| `pnpm cf:build` | Build the OpenNext Worker and static assets. |
| `pnpm cf:preview` | Build and run locally in the Workers `workerd` runtime. |
| `pnpm cf:upload` | Build and upload a preview Worker version without deploying it. |
| `pnpm cf:deploy` | Build and deploy the production Worker. |

Cloudflare deployment requires both server secrets already configured for the Worker. Never place them in `vars` or command-line history. Before deployment, run the normal checks, `pnpm cf:typegen`, `pnpm cf:typecheck`, and `wrangler deploy --dry-run`; both type commands rebuild the OpenNext entrypoint before asking Wrangler to generate or compare types. Verify the compressed Worker is below the conservative 3 MiB Free-plan limit. The verified production Worker is [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev); deployment and live-call evidence are recorded below without secret or request identifiers.

## Architecture

```text
Browser learning flow
→ Validated Next.js server routes
→ OpenAI Responses API (image + text understanding; structured learner model; validated tool orchestration)
→ Allow-listed WorldSpec
→ Deterministic simulation and Three.js comparison rendering
→ Revision trace and transfer result
```

OpenAI does not generate or execute arbitrary Three.js code. It produces schema-constrained data; application code validates that data again and renders only allow-listed bodies, relationships, cameras, and scenarios.

The server routes are:

- `POST /api/analyze` for configured live analysis.
- `GET` or `POST /api/demo` for the explicit authored verified path.
- `POST /api/revision` for `live` or `verified-sample` revision mode.
- `POST /api/transfer` for deterministic server grading.

### Documentation

- [Devpost submission working document](docs/DEVPOST_SUBMISSION.md)
- [OpenAI SDK integration reference](docs/OPENAI_SDK_REFERENCE.md)
- [Cloudflare Workers deployment reference](docs/CLOUDFLARE_DEPLOYMENT_REFERENCE.md)
- [Product specification](docs/PRODUCT_SPEC.md)

### Authored samples

Authored samples are an explicit, visibly labeled verified path. No cached or authored result is presented as live. A live failure is disclosed without fixture fallback.

### Trust boundary

GPT extracts learner claims and revision prose, but it does not select simulation constants, author a WorldSpec, run arbitrary browser code, choose a transfer answer, or grade the learner. A private server registry validates worlds, reruns deterministic simulations, compares causal prediction codes, selects the discriminating case, and mints an opaque evaluation token from the private answer bank. Unsupported or cross-scenario output fails safely.

The evaluation token is AES-256-GCM encrypted and authenticated. It binds the session, question, options, answer, rationale, expiry, and live revision context. With `VERCEL=1`, the server trusts only `x-vercel-forwarded-for`. Cloudflare mode trusts only `CF-Connecting-IP` and requires origin restriction. Otherwise, forwarded headers are ignored and requests use the unknown-client bucket.

## How Codex was used

Codex performed these implementation roles under human direction:

- Translated the concept into the capture → interpret → predict → observe → revise → transfer → trace sequence.
- Scaffolded the Next.js and TypeScript application, schemas, API routes, domain layer, and deterministic Three.js scenes.
- Iterated on Responses integration, Programmatic Tool Calling, encrypted evaluation tokens, bounded live requests, and fail-closed behavior.
- Found and addressed tests, stale-response races, accessibility issues, responsive breakpoints, and design-review findings.
- Kept implementation, review fixes, tests, and documentation in scoped commits.

Human-owned decisions include the Education category, target learners and misconceptions, pedagogical sequence, Moon and Seasons scope, privacy stance, trust boundary, experience priorities, and final release acceptance. GPT-5.6 Terra is configured for strict learner-model analysis and PTC, and GPT-5.6 Luna is configured for bounded revision feedback. The deterministic application owns cases, WorldSpecs, simulation, evidence, transfer keys, and grading. Learner-data Responses calls use `store: false`.

The final Cloudflare build proved the live integration with one successful Terra analysis/PTC request and one successful Luna revision request. Codex Feedback Session ID: `{{CODEX_FEEDBACK_SESSION_ID}}` — replace it with the value returned by `/feedback` in the primary build task.

## Build Week provenance

This repository was initialized from an empty root during the build week. The entries below are representative commits from this repository and do not make a broader rewrite or prior-asset claim.

| Commit | Timestamp | Evidence |
| --- | --- | --- |
| `8f1886b` | 2026-07-15 16:02 JST | Empty repository initialization. |
| `e26700a` | 2026-07-15 16:13 JST | Official SDK integration contract. |
| `543b71d` | 2026-07-15 19:56 JST | Verified Moon flow and state machine. |
| `f8b5b51` | 2026-07-15 21:12 JST | Secure configured live analysis and revision boundary. |
| `0a31dd8` | 2026-07-15 22:18 JST | Complete Seasons challenge. |
| `a945e33` | 2026-07-15 23:05 JST | FINDING-001: revision status and trace. |
| `b9bd4f6` | 2026-07-15 23:15 JST | FINDING-002: learner-facing scenario copy. |
| `b944cab` | 2026-07-15 23:23 JST | FINDING-003: mobile entry and progress. |
| `05ac1bb` | 2026-07-15 23:35 JST | FINDING-004: mobile Seasons comparison. |
| `e480554` | 2026-07-15 23:50 JST | FINDING-005: caption legibility and contrast. |
| `3c987e2` | 2026-07-16 00:07 JST | FINDING-006: accessible sketch upload. |

## Media and licensing

The runtime ships no third-party image, audio, video, or 3D media. Astronomy visuals are rendered from application code, package dependencies are declared in the repository, and the source is MIT-licensed. Final screenshots, demo video, music, or other submission media are separate deliverables and are not claimed as inspected here; audit any such additions before publishing.

## Submission verification

The Cloudflare production build was verified locally and live on 2026-07-17 JST. The runtime commit is deployed at [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev), merged to `main`, and verified again on `main`.

| Verification | Result |
| --- | --- |
| ESLint | **Pass** — zero warnings. |
| Strict TypeScript | **Pass**. |
| Vitest unit/API | **311/311** across **27 files**. |
| Next.js 16.2.10 production build | **Pass**. |
| Chromium E2E | **23/23 Pass**. |
| OpenNext/Workers build | **Pass** with `@opennextjs/cloudflare@1.20.1`. |
| Wrangler dry run | **Pass** — 1,614.05 KiB gzip and all bindings resolved. |
| Local workerd smoke | **Pass** — `/` and `/api/demo` returned HTTP 200. |
| Production public smoke | **Pass** — root HEAD and Moon verified demo returned HTTP 200; the deployment is 100% current. |
| Production Terra smoke | **Pass** — HTTP 200, exact four-tool ledger in five PTC rounds, 7,581 total tokens, estimated **$0.013358**. |
| Production Luna smoke | **Pass** — HTTP 200, 493 total tokens, estimated **$0.001083**. |
| Production dependency audit | **No known vulnerabilities**. |
| Tracked live-token/private-key scan | **0 matches**. |

The successful live sequence made one Terra HTTP request and one Luna HTTP request with zero HTTP retries. Combined telemetry was 8,074 total tokens and an estimated **$0.014441**; the configured dollar ceilings remain output-only bounds, not an all-in preflight guarantee. External gates still pending are exact Workers CPU telemetry/account-plan confirmation, public repository access, the `/feedback` Session ID, final media/video/screenshots, and placeholder replacement. Track the canonical handoff in [docs/DEVPOST_SUBMISSION.md](docs/DEVPOST_SUBMISSION.md); the external submission is not yet complete.

## License

[MIT](LICENSE)
