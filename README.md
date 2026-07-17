# ModelDuel

**Two models predict. Evidence decides.**

ModelDuel is an Education-category learning experience that turns a learner's explanation into two comparable worlds: the learner's current mental model and the scientific model. The learner commits to a prediction, observes both worlds under the same conditions, revises the explanation, and answers one transfer item. The result is a reviewable trace of a conceptual revision attempt and one transfer result—not proof of durable conceptual change.

The two complete challenges focus on common astronomy misconceptions: that Earth's shadow causes the phases of the Moon, and that Earth-Sun distance causes the seasons. Both use the same protected learning sequence and deterministic solar-system foundation.

![ModelDuel production cover showing the Moon-phases capture experience](docs/media/modelduel-cover.png)

## Submission links

- Live demo: [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev)
- Repository: `{{REPOSITORY_URL}}`
- Demo video: `{{VIDEO_URL}}`
- Codex Feedback Session ID: `{{CODEX_FEEDBACK_SESSION_ID}}`

Replace the remaining three placeholders before submission. The Codex Feedback Session ID must come from `/feedback` in the primary build task; never substitute an invented value.

## Current scope

The repository implements complete Moon-phases and seasons browser journeys: text or sketch capture, explicit live or verified analysis, two protected models, prediction locking, deterministic simulation with Three.js rendering, revision feedback, server-authenticated transfer grading, and a Model Revision Trace. The trace ends with a compact same-session teacher review and a learner-controlled clipboard copy or local text download. The handoff makes no API call and creates no account, share link, or server-side record; the active page, system clipboard, browser, or device may still retain a copy. The editable text is a conversation aid, not a signed or teacher-authenticated record. The production configuration routes analysis and PTC to GPT-5.6 Terra and live revision feedback to GPT-5.6 Luna. Each scenario has strict server-owned cases, world specifications, transfer questions, and authored verified samples.

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
8. Inspect the Model Revision Trace from initial belief through transfer result. Review the local teacher-handoff preview; copying or downloading it requires the learner-text confirmation and sends no additional request.
9. Select **New attempt**, choose **Seasons**, and repeat the verified journey. For the Seasons transfer question, choose **The higher-energy hemisphere reverses** before selecting **Lock and check answer**.

### Configured live path

Live analysis requires a server-side `OPENAI_API_KEY`. Enter at least 20 characters of learner text, attach a PNG, JPEG, or WebP sketch up to 3 MiB decoded, or provide both, then deliberately choose the live path. A failed live request remains a disclosed error and never silently falls back to an authored sample. A dated 2026-07-17 production integration smoke completed one paid Terra analysis/PTC request and, only after its usage gate passed, one paid Luna revision request with no HTTP retry. That evidence predates the current quality branch and is not proof of the final build.

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
| `pnpm test:e2e` | Run Playwright journeys in Chromium, Firefox, and WebKit. |
| `pnpm test:e2e:chromium` | Run the Chromium project only for a quick local check. |
| `pnpm video:validate:contracts` | Validate the approved 10-row timeline, selector inventory, production origin, and exact API ledger without external tools or network access. |
| `pnpm video:submission -- --validate-only` | Validate the full local FFmpeg, FFprobe, Chromium, subtitle, and codec toolchain without recording or API calls. |
| `pnpm check` | Run lint, typecheck, Vitest, portable video-contract validation, and the production build. |
| `pnpm cf:typegen` | Build the OpenNext entrypoint, then regenerate checked-in Workers binding and runtime types. |
| `pnpm cf:typecheck` | Rebuild the OpenNext entrypoint and verify checked-in Workers types have no drift. |
| `pnpm cf:build` | Build the OpenNext Worker and static assets. |
| `pnpm cf:preview` | Build and run locally in the Workers `workerd` runtime. |
| `pnpm cf:upload` | Build and upload a preview Worker version without deploying it. |
| `pnpm cf:deploy` | Build and deploy the production Worker. |

Cloudflare deployment requires both server secrets already configured for the Worker. Never place them in `vars` or command-line history. Before deployment, run the normal checks, `pnpm cf:typegen`, `pnpm cf:typecheck`, and `wrangler deploy --dry-run`; both type commands rebuild the OpenNext entrypoint before asking Wrangler to generate or compare types. Verify the compressed Worker is below the account-plan-specific limit. The production endpoint is [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev); dated integration evidence and the final main deployment/canary are recorded below without secrets, cookie values, or learner data.

### Reproducible submission video

The generator reads the exact 10-row narration table from [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md), records only the production verified-sample path, and publishes an immutable MP4/SRT/contact-sheet/manifest bundle under `~/.gstack/projects/DevPostOpenAI/submission/runs/`. It refuses an in-repository output root, blocks service workers and external HTTP, rejects live analysis, and requires the exact `GET /api/demo` → verified `POST /api/revision` → `POST /api/transfer` ledger.

Narration uses OpenAI `tts-1` with the `nova` voice and displays **AI-generated narration · OpenAI TTS** throughout the video. The first approved generation is cost-gated:

Load `OPENAI_API_KEY` through the parent process environment or a secure secret manager before the first run; never place the key itself in the command line or shell history. The recorder strips API keys, tokens, passwords, cookies, and secrets from FFmpeg, FFprobe, Git, and Chromium child environments.

```bash
MODELDUEL_ALLOW_PAID_TTS=1 pnpm video:submission
```

Only the public, approved narration rows are sent to the Speech API. Generated WAV sources are cached by model, voice, and narration hash inside the managed external output root; a per-row exclusive lock prevents concurrent cache misses from issuing duplicate paid requests. After the cache exists, run `pnpm video:submission` without the opt-in variable. Full recording refuses a dirty worktree and snapshots its commit and source hashes before paid or network work. Do not publish any earlier local draft narrated with a macOS System Voice; current Apple licensing limits System Voice projects to personal, non-commercial use and excludes public sharing.

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
- [Submission media, narration rights, browser, and accessibility reference](docs/SUBMISSION_MEDIA_REFERENCE.md)
- [Final local submission-video evidence](docs/VIDEO_EVIDENCE_2026-07-17.md)
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

The dated 2026-07-17 production integration smoke proved the live Terra analysis/PTC and Luna revision routes for that deployed integration baseline; it is not final-build proof. Codex Feedback Session ID: `{{CODEX_FEEDBACK_SESSION_ID}}` — replace it with the value returned by `/feedback` in the primary build task.

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

The runtime ships no third-party image, audio, video, or 3D media. Astronomy visuals are rendered from application code, package dependencies are declared in the repository, and the source is MIT-licensed. The five production captures below are first-party screenshots of deployed Cloudflare version 3, build `La258MjHHcPyAMa5k13Uz`.

| Production media | Dimensions | Size | Submission role |
| --- | ---: | ---: | --- |
| [`docs/media/modelduel-cover.png`](docs/media/modelduel-cover.png) | 1600×900 | 504,815 B | Devpost cover and landing hero |
| [`docs/media/moon-evidence.png`](docs/media/moon-evidence.png) | 1280×900 | 205,850 B | Moon two-world evidence |
| [`docs/media/model-revision-trace.png`](docs/media/model-revision-trace.png) | 1280×900 | 306,443 B | Completed revision trace and transfer result |
| [`docs/media/seasons-evidence.png`](docs/media/seasons-evidence.png) | 1280×900 | 193,841 B | Seasons two-world evidence |
| [`docs/media/mobile-hero.png`](docs/media/mobile-hero.png) | 375×812 | 194,744 B | Responsive landing and verified CTA |

Production visual QA completed the Moon journey through trace at 1280px and 375px, and the Seasons journey through evidence at 1280px. Each evidence view rendered two canvases with no 2D recovery view. Horizontal overflow, page errors, failed requests, and unexpected console messages were all zero. The capture used no login and made zero analyze calls: the verified CTA remained primary, revision remained authored, authored-source labels stayed visible, and live analysis stayed disabled before confirmation. The screenshot and cover rights audit is complete. The publishable video must use the disclosed OpenAI TTS narration path above; local macOS System Voice drafts are not cleared for public sharing. Any future music or additional media requires a separate rights review.

## Historical integration verification and final gates

The dated rows below preserve the 2026-07-17 integration baseline without presenting it as final-build proof. Separate rows record the now-proven pre-merge quality branch, post-merge main gate, and production deployment/canary. The runtime deployment corresponds to main merge `e04443f`; the documentation-only evidence branch follows afterward.

| Verification | Result |
| --- | --- |
| 2026-07-17 integration baseline | Lint, typecheck, tests, builds, dry run, local workerd, dependency audit, and secret scan passed for that dated commit. Historical counts are intentionally not presented as current. |
| 2026-07-17 production public smoke | Root HEAD and Moon verified demo returned HTTP 200 for the dated integration deployment. |
| 2026-07-17 production integration smoke — Terra | HTTP 200, exact four-tool ledger in five PTC rounds, 7,581 total tokens, estimated **$0.013358**. |
| 2026-07-17 production integration smoke — Luna | HTTP 200, 493 total tokens, estimated **$0.001083**. |
| 2026-07-17 pre-merge quality-branch gate — HEAD `682c206` | Vitest **332/332** across **31 files**; Chromium E2E **34/34**; Next.js, OpenNext, Wrangler, and dependency audit **Pass**; **no known vulnerabilities**. |
| Worker and asset evidence — HEAD `682c206` | Worker **8,277.49 KiB raw / 1,619.89 KiB gzip**; Wrangler **18 deployable asset entries**; **14 physical assets**; largest dynamic 3D chunk **896,059 bytes**. |
| Rendered design evidence — HEAD `682c206` | **B+ / 3.37**, AI Slop **B-**, goodwill **93**, Critical/High/Medium findings **0/0/0**. |
| Entry-path performance evidence | Pre-recovery encoded initial JS **229,931 bytes**; final recovery build at HEAD `682c206` **231,708 bytes**; under 4× CPU throttling, the primary CTA became ready in **363 ms** during the performance audit. |
| Final post-merge `main` gate — merge `e04443f` | Vitest **332/332** across **31 files**; Chromium E2E **34/34**; Next.js, OpenNext, `cf:typecheck`, and Wrangler **Pass**; Wrangler dry run **8,277.49 KiB raw / 1,619.88 KiB gzip**; dependency audit **clean**. |
| Final deployment and public canary | Cloudflare version `b4665d5a-b1a2-4af1-9918-af475059d170` (**version 3**) created `2026-07-17T03:04:01.364891Z`, **100% active**, build ID `La258MjHHcPyAMa5k13Uz`. Root, security headers, Moon and Seasons verified journeys, 404 handling, and invalid-request HTTP 400 handling passed at [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev). |

The dated production integration sequence made one Terra HTTP request and one Luna HTTP request with zero HTTP retries. Combined telemetry was 8,074 total tokens and an estimated **$0.014441**; the configured dollar ceilings remain output-only bounds, not an all-in preflight guarantee. That remains historical integration evidence, not final-build cost evidence.

After main merge `e04443f`, the final runtime canary made exactly one live analysis request and one live revision request with zero retries. Analysis returned HTTP 200 in **17.642 seconds**, source `live`, model `gpt-5.6-terra`, with the exact tool order `validate_world_spec` → `simulate_world` → `compare_predictions` → `select_discriminating_case`. Revision returned HTTP 200 in **1.404 seconds**, source `gpt-5.6`, model `gpt-5.6-luna`; the same session and signed evaluation were accepted, conceptual change was `revised` with score `1`, and `liveUseAttestation: true` was carried by both requests. The server-minted cookie was reused with `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Strict`; its value was not recorded. The strict responses did not expose token usage or cost, so neither is guessed or presented as a measured final-build cost.

The deployed runtime still corresponds to main merge `e04443f`. Submission-quality commit `f13a2e5` adds the accessible 3D-canvas role and hardened recording/CI gates, but is not production until it is merged, deployed, and verified. The exact local video candidate is complete and recorded in [the dated video evidence](docs/VIDEO_EVIDENCE_2026-07-17.md); public upload, repository access, `/feedback` Session ID, placeholder replacement, logged-out link checks, and final form submission remain external gates. Track the canonical handoff in [docs/DEVPOST_SUBMISSION.md](docs/DEVPOST_SUBMISSION.md).

## License

[MIT](LICENSE)
