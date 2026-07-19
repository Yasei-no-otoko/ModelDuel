# Devpost Submission — ModelDuel

> **Submission warning:** Replace the video placeholder below before submitting. Do not publish placeholder text. The public repository and primary build task's Codex Feedback Session ID are recorded.

- Live demo: [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev)
- Repository: [github.com/Yasei-no-otoko/ModelDuel](https://github.com/Yasei-no-otoko/ModelDuel)
- Demo video: `{{VIDEO_URL}}`
- Codex Feedback Session ID: `019f648c-0eb8-7b60-ad84-28ce35bbac4b`

## Deadline

**July 21, 2026 at 5:00 PM PDT / July 22, 2026 at 9:00 AM JST.**

Re-verified on 2026-07-19 JST against the official rules and FAQ. The current package satisfies the documented repository, license, README, working-demo, sub-three-minute narrated-video, Codex/GPT-5.6 explanation, and primary-thread Feedback Session ID requirements. The only unresolved submission placeholder is the user-owned public YouTube URL.

## Paste-ready submission fields

- **Project name:** ModelDuel
- **Tagline:** Two models predict. Evidence decides.
- **Category:** Education
- **Built with:** Codex, OpenAI Responses API, GPT-5.6 Terra and GPT-5.6 Luna, Structured Outputs, Programmatic Tool Calling, Next.js 16, TypeScript, React, Three.js, Zod, Vitest, Playwright, Cloudflare Workers, and OpenNext

### Two-line outline

> **ModelDuel turns a student’s explanation or sketch into two runnable 3D worlds—their mental model and the scientific model—and asks them to predict before the evidence is revealed.**
>
> **Built with Codex, it uses GPT‑5.6 vision and structured outputs to infer the learner model, then validated tool orchestration and deterministic application code build the comparison and transfer test—giving teachers a reviewable trace of conceptual revision rather than another AI-generated answer.**

## Long description

### Inspiration

AI tutors can generate clear explanations, but a correct answer does not prove that a learner changed the causal model in their head. Astronomy misconceptions make that gap visible: a learner may memorize Moon-phase vocabulary while still believing that Earth's shadow causes every phase. ModelDuel was inspired by the idea that a misconception should become a testable prediction, not something an AI simply corrects.

### What it does

ModelDuel guides a learner through one protected sequence: capture → interpret → predict → observe → revise → transfer → trace. The learner explains an idea in text, optionally adds a sketch, and deliberately chooses either configured live analysis or an authored verified sample. The app compares a learner model with a scientific model, requires a prediction before revealing evidence, renders both worlds under the same case, asks for a revised explanation, and checks a transfer question. The final Model Revision Trace preserves the initial belief, prediction, observation, revision, and transfer result. A compact same-session teacher review shows the before state, evidence and revision, and unseen transfer result. After reviewing a clear learner-text boundary, the learner may copy or download an allow-listed plain-text handoff; that action adds no API request, account, share link, or server-side record. The editable text is a conversation aid rather than a signed, tamper-proof, or teacher-authenticated record, and the active page, system clipboard, browser, or device may retain or sync a copy.

Two complete challenges share this loop. The Moon challenge confronts the belief that Earth's shadow causes regular phases. The Seasons challenge tests the belief that Earth-Sun distance causes summer and winter. Verified samples are visibly labeled, require no account or API key, and never masquerade as live output. The production configuration routes analysis and PTC to GPT-5.6 Terra and live revision feedback to GPT-5.6 Luna. A dated 2026-07-17 production integration smoke completed one paid Terra analysis/PTC request and one paid Luna revision request with no HTTP retry; it is not proof of the final build.

The first intended pilot is one middle-school astronomy lesson in which a teacher asks learners to complete one duel independently, then uses the same-session trace and authored discussion cue for a short follow-up conversation. Feasibility will be measured by completion without teacher rescue, correct handling of prediction-before-evidence, and performance on the unseen transfer item. Those descriptive pilot measures would test the workflow and inform iteration; they are not a causal learning-gain claim.

### How we built it

The browser experience uses Next.js, React, and TypeScript. Zod schemas constrain learner models and server contracts. GPT output is validated before it can cross into the application domain. The application—not the model—owns the allowed cases, WorldSpecs, simulation constants, evidence, transfer answer keys, and grading. Deterministic simulation code produces the astronomy state, and Three.js renders the resulting scenes; GPT never generates or executes arbitrary Three.js code.

The server exposes separate live, verified-sample, revision, and transfer routes. Live learner-data Responses requests use `store: false`. Transfer answer keys remain inside a private server registry, and the client receives an AES-256-GCM authenticated token that binds the session, question, options, answer, rationale, expiry, and live revision context. Each signed token's random `jti` selects a unique SQLite Durable Object through an HMAC-derived name. It atomically commits the first live-revision execution, returns the cached normalized result for the same input with fresh response metadata, and rejects changed or indeterminate replays without another model call. It stores an HMAC-derived key and fingerprint rather than the token, raw `jti`, session/request IDs, or revised explanation. Cleanup is scheduled after the authorization window plus a one-minute grace. A storage deletion failure attempts to re-arm cleanup once per minute; a failed re-arm throws so Cloudflare's finite alarm retries can run. A schema-valid unsupported or cross-scenario claim stops after extraction and before tool orchestration, does not auto-retry, and offers only an explicit API-free verified-sample path. Four fail-closed Cloudflare Rate Limiting bindings implement hashed-client and aggregate limits for analysis and revision. Their configuration, local `workerd` behavior, production bindings, deployed live paths, and exact API-free judge ledger were re-verified for final merge `96b93d4` and Cloudflare version `cd38e435-7875-4125-bfbb-c7f5a4d092d0`.

### How Codex helped

Codex translated the concept into the capture → interpret → predict → observe → revise → transfer → trace state machine. It scaffolded the Next.js and TypeScript application, schemas, routes, domain layer, deterministic simulations, Three.js renderers, and tests. It then iterated on Responses API integration, Programmatic Tool Calling, encrypted evaluation tokens, bounded live request handling, fail-closed validation, race conditions, accessibility, responsive behavior, and design-review findings. The work was kept in scoped commits with supporting documentation.

Human decisions remained human-owned: the Education category, target misconceptions, pedagogical sequence, scenario scope, privacy stance, fail-closed requirements, experience priorities, and release acceptance. GPT-5.6 Terra is configured for strict learner-model analysis and PTC, and GPT-5.6 Luna is configured for bounded revision feedback. The deterministic application owns cases, WorldSpecs, simulation, evidence, transfer keys, and grading. Learner-data Responses calls use `store: false`.

### Challenges we ran into

The hardest challenge was making an AI-assisted experience feel generative without handing scientific truth or grading authority to the model. Live and authored paths also had to remain unmistakably separate: a network or configuration failure cannot silently turn into a successful fixture. Other challenges included protecting the prediction before evidence is revealed, keeping transfer keys off the client, handling stale asynchronous responses, supporting WebGL fallbacks, and preserving readable, touch-friendly layouts at narrow mobile widths.

### Accomplishments that we're proud of

- Two complete astronomy journeys reuse one coherent learning loop and deterministic simulation foundation.
- The verified-sample path is account- and key-independent while clearly disclosing its authored source.
- The configured live path is schema-constrained, validated again by application code, and fails closed without silent fallback.
- Predictions are locked before evidence, and transfer grading is authenticated at the server boundary.
- The completed attempt becomes a compact teacher-review summary plus an explicit learner-controlled local handoff, without creating a teacher account, share link, or new API call.
- The interface includes source labels, keyboard-visible controls, mobile-safe layouts, and an accessible, strictly validated sketch uploader.
- The repository records build-week provenance, SDK decisions, product boundaries, and submission verification work.

### What we learned

The useful boundary is not “AI versus deterministic code.” It is deciding which responsibility belongs to each. A model is valuable for extracting a learner's claim and giving bounded feedback on revised prose. Deterministic code is better for selecting cases, simulating worlds, revealing evidence, protecting answer keys, and grading transfer. We also learned that provenance labels and explicit failure states are part of the learning design: learners and judges should always know whether they are seeing a configured live result or an authored verified sample.

### What's next

The first-view 3D runtime merge `96b93d4` is deployed as Cloudflare version `cd38e435-7875-4125-bfbb-c7f5a4d092d0`; the responsive 3D probes, free production judge path, bindings, security headers, and zero-paid-call presentation capture passed. The current exact 2:45 local candidate is run `20260719T092408557Z-fec2df68-b1ea-4ea6-9b0a-fb97131df4b5` from generator commit `96b93d4`. The repository is public and the primary Codex Feedback Session ID is recorded. Before submission, the user will publish the video, replace the sole remaining `{{VIDEO_URL}}` placeholder, verify playback while logged out, and submit the Devpost form; Codex does not publish the video. After the hackathon, the constrained-world pattern could expand to additional science misconceptions and a separately evaluated classroom pilot. Any impact or learning-gain claim would require that evaluation rather than being inferred from this prototype.

### Production verification

### Dated production integration smoke — 2026-07-17

At the dated integration-smoke point, the runtime at [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev) completed a text-only Terra analysis with HTTP 200 in 19,378 ms, the exact four-tool ledger in five PTC rounds, and no PTC failure. Its six Responses calls used 7,581 total tokens for an estimated **$0.013358**. Only after that usage gate passed, one Luna revision returned HTTP 200 in 1,742 ms with 493 total tokens for an estimated **$0.001083**. The successful sequence totaled 8,074 tokens and an estimated **$0.014441**, with zero HTTP retries. The evidence records aggregate counters and model IDs only; it excludes prompts, learner and feedback text, secrets, encrypted evaluation tokens, and request identifiers. This evidence predates the current quality branch and is not proof that the final build is merged or deployed.

## Judging criteria map

| Criterion | ModelDuel evidence |
| --- | --- |
| Technological Implementation | GPT-5.6 Terra/Luna routing, image and text capture, schema-constrained Responses, validated tool orchestration, private deterministic registries, authenticated evaluation tokens, fail-closed routes, Cloudflare distributed rate bindings, deterministic simulations, and Three.js renderers. |
| Design | One legible sequence protects prediction before evidence, separates live and verified sources, supports keyboard/touch/mobile use, and ends with a compact review plus an explicit learner-controlled local handoff. |
| Potential Impact | In a proposed one-lesson middle-school astronomy pilot, one conceptual-revision attempt becomes editable plain text for teacher discussion. Completion, prediction-before-evidence integrity, and unseen-transfer performance provide concrete feasibility signals; ModelDuel does not claim grades, durable learning, or causal learning gains. |
| Quality of the Idea | The learner's own misconception becomes a runnable, falsifiable world that competes with a scientific model under the same evidence. |

## How to verify ModelDuel locally

This is the canonical how-to for judges and submission reviewers. For implementation rationale, see [OpenAI SDK reference](OPENAI_SDK_REFERENCE.md) and [product specification](PRODUCT_SPEC.md).

### Prerequisites

- Node.js `>=22.13.0`; `.nvmrc` pins `24.18.0`.
- pnpm `11.13.0` (`packageManager`), supported range `>=11.13 <12`.
- No account or OpenAI API key for verified samples.
- `OPENAI_API_KEY` only for optional live flows.

### Setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js.

### Verify the authored Moon journey

1. Select **Run verified sample**.
2. Select **Make a prediction**, choose one option, and select **Lock prediction**.
3. Select **Run both worlds and reveal evidence**.
4. Select **Revise my explanation** and enter:

   > The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions of the sunlit half. Earth's shadow does not cause the regular phases; it causes a lunar eclipse.

5. Select **Capture revision and continue**.
6. For the Moon transfer question, choose **The Moon is in the Sun's direction**, then select **Lock and check answer**.
7. Inspect the Model Revision Trace, then review the teacher-handoff preview. Confirm the learner-text boundary to copy or download the allow-listed local text; this adds no network request.
8. Select **New attempt**, choose **Seasons**, and repeat the verified path.

### Optional live setup

After the verified journey works, copy the environment template:

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`, keep the configured Terra and Luna model names, and restart the development server. Enter at least 20 characters of learner text, attach a PNG/JPEG/WebP sketch, or provide both. A failed live request must remain an explicit failure; it must not become a verified result. The dated production integration smoke above is historical paid integration evidence; local behavior must not be presented as production proof, and the dated smoke must not be presented as final-build proof.

For production, set `MODELDUEL_EVALUATION_SECRET` to a private value of at least 32 characters. Development can generate an ephemeral secret; production fails configuration when the value is missing or too short.

### Commands

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
| `pnpm check` | Run lint, typecheck, tests, and build. |

### Verification

Run both gates before release:

```bash
pnpm check
pnpm test:e2e
```

Then repeat the verified Moon and Seasons journeys in the final production build at desktop and mobile widths. Do not report a test count unless it comes from the final recorded gate.

### Troubleshooting

- **`CONFIGURATION_REQUIRED` on a live action:** confirm `OPENAI_API_KEY` is set server-side and the configured model names are available. Verified samples do not need the key.
- **Production evaluation configuration fails:** `MODELDUEL_EVALUATION_SECRET` must be present and at least 32 characters after trimming.
- **A live request fails instead of showing a sample:** this is intentional fail-closed behavior. Select the verified path explicitly if you want the authored sample.
- **Sketch is rejected:** use PNG, JPEG, or WebP up to 3 MiB decoded, or continue with at least 20 characters of text.
- **Unexpected client identity behind a proxy:** use `MODELDUEL_TRUSTED_PROXY=cloudflare` only with origin restriction. Vercel is detected with `VERCEL=1`; otherwise forwarded headers are ignored.

## Endpoint and configuration reference

### Routes

| Endpoint | Purpose | Key/model behavior |
| --- | --- | --- |
| `POST /api/analyze` | Validate live text/sketch input and request a structured learner-model analysis. | Requires `OPENAI_API_KEY`; analysis model fallback is `MODELDUEL_ANALYSIS_MODEL` → `OPENAI_HERO_MODEL` → `gpt-5.6-terra`. |
| `GET /api/demo` | Retrieve an explicit authored verified sample. | No OpenAI key; source remains visibly verified. |
| `POST /api/demo` | Request the explicit authored verified sample through the scenario contract. | No OpenAI key; never represented as live. |
| `POST /api/revision` | Return revision feedback in `live` or `verified-sample` mode. | Live mode requires the key; revision fallback is `MODELDUEL_REVISION_MODEL` → `OPENAI_MODEL` → `gpt-5.6-luna`. |
| `POST /api/transfer` | Authenticate the evaluation token and deterministically grade the selected transfer answer. | No model chooses the answer or performs grading. |

### Environment

| Variable | Requirement and behavior |
| --- | --- |
| `OPENAI_API_KEY` | Server-only and required only for live analysis/revision. Missing or blank live configuration fails with `CONFIGURATION_REQUIRED`. |
| `MODELDUEL_ANALYSIS_MODEL` | First analysis override; falls back to `OPENAI_HERO_MODEL`, then `gpt-5.6-terra`. |
| `OPENAI_HERO_MODEL` | Secondary analysis fallback; `.env.example` uses `gpt-5.6-terra`. |
| `MODELDUEL_REVISION_MODEL` | First revision override; falls back to `OPENAI_MODEL`, then `gpt-5.6-luna`. |
| `OPENAI_MODEL` | Secondary revision fallback; `.env.example` uses `gpt-5.6-luna`. |
| `MODELDUEL_EVALUATION_SECRET` | AES evaluation-token secret. Required in production and at least 32 characters; development alone may create an ephemeral secret. |
| `MODELDUEL_TRUSTED_PROXY` | Optional. Only `cloudflare` is accepted and requires restricted origin access. Vercel is detected internally with `VERCEL=1`; otherwise forwarding headers are ignored. |

All learner-data Responses requests use `store: false`. Live budgets are charged only after validation, gateway configuration, and signed-context preflight. A signed token's random `jti` selects one Durable Object through an HMAC-derived name, adding short-lived application-side retention solely for replay safety: HMAC-derived state plus normalized live-revision feedback until scheduled cleanup succeeds. It does not retain the raw token, raw `jti`, session/request IDs, or revised explanation. Cleanup is scheduled after the authorization window and grace, with an attempted one-minute re-arm after a storage failure and Cloudflare's finite retries if re-arming fails. Local development uses timed process-local eviction, while tests inject isolated stores. Cloudflare production is configured with fail-closed per-POP hashed-client and aggregate bindings, which are soft abuse/spend guards rather than an exact global OpenAI budget. See [OpenAI SDK reference](OPENAI_SDK_REFERENCE.md) for SDK-level details and [product specification](PRODUCT_SPEC.md) for the full domain contract.

## 2:45 demo narration and shot list

Use the verified sample for the recorded working journey. Keep its authored-source label visible. Show the configured live controls and documented production proof without presenting authored output as a live response.

| Time | Shot | Exact narration |
| --- | --- | --- |
| 0:00–0:13 | Hero, animated 3D model comparison, its three focus controls, and the Moon/Seasons challenge selector. | “AI can generate an answer. ModelDuel is a science experience for Moon phases and seasons that asks learners to expose a causal model, predict with it, and revise only after evidence appears.” |
| 0:13–0:30 | Moon capture card; show text, sketch input, and click **Run verified sample**. Keep the authored-source disclosure visible. | “A learner explains why the Moon changes shape and may add a sketch. I start the instant verified sample: it needs no account, makes no paid call, and is always labeled as authored, so judges can run the complete journey reliably.” |
| 0:30–0:51 | Show the interpreted learner model, configured live label, and a brief overlay of the validated tool ledger; do not execute a paid call. | “The optional live path sends text or vision input to GPT-5.6 Terra. Structured output extracts a bounded learner model, while validated Programmatic Tool Calling requires the exact allow-listed ledger before a result can enter the experience. A failed live request stays a visible error; it never becomes this verified sample.” |
| 0:51–1:04 | Click **Make a prediction**, choose an option, and lock it while evidence remains sealed. | “Before any evidence appears, I choose and lock a prediction. That commitment turns the learner’s explanation into a falsifiable claim and prevents the result from being rewritten after observation.” |
| 1:04–1:28 | Reveal the two Moon worlds, cycle the scientific model through **Earth-side view** and **Plane view**, reset to **Case overview**, and hold on the verified observation. | “Now both worlds run the same deterministic Moon case. One predicts that Earth’s shadow causes regular phases. The scientific world keeps half the Moon illuminated while its orbit changes Earth’s viewing angle. The application, not GPT, owns the WorldSpec, simulation constants, physical evidence, and Three.js rendering, so model prose can never redefine scientific truth.” |
| 1:28–1:48 | Open revision, enter the full-scoring explanation, and show the visibly authored feedback/source. | “After seeing the contradiction, the learner writes a revised causal explanation. In the configured live path, GPT-5.6 Luna gives bounded feedback on that prose. In this recording, the verified feedback remains visibly authored. Either way, the learner’s locked prediction and the deterministic observation remain unchanged.” |
| 1:48–2:08 | Answer transfer, lock it, and reveal the Model Revision Trace. | “A new transfer question checks the revised explanation in a different case. The server protects the answer key and grades the choice; GPT does neither. The trace connects the initial belief, prediction, observation, revision attempt, and transfer result—reviewable evidence of revision, not proof of durable learning.” |
| 2:08–2:30 | Architecture diagram with exact four-tool sequence, then the live-use confirmation and privacy copy. | “The live architecture uses schema-constrained Responses, store false, strict validation, and the validated tool sequence: validate the WorldSpec, simulate, compare predictions, then select a discriminating case. Live input is gated by a self-attestation for adults or teacher-or-guardian-authorized learners and a no-personal-information confirmation. ModelDuel does not independently verify age or authorization, and it fails closed across privacy, rate, token, and scenario boundaries.” |
| 2:30–2:42 | Primary Codex task, representative scoped commits, and final test summary; show no secrets or environment files. | “Codex built the state machine, routes, deterministic simulations, Three.js views, encrypted transfer boundary, and test suite, then iterated through races, accessibility, responsive design, security review, and scoped commits.” |
| 2:42–2:45 | Return to hero/tagline. | “ModelDuel. Two models predict. Evidence decides.” |

### Recording gates

- State live Terra or Luna success only from the recorded production evidence, never from an authored sample or local fixture.
- Never show `.env*` files, API keys, evaluation secrets, request headers, encrypted tokens, or other credentials.
- Keep the final cut at or below 2:45 and retain audible narration.
- Show the verified source label whenever the authored path is used.

## Screenshot list

Captured from the current first-view 3D production deployment, Cloudflare version `cd38e435-7875-4125-bfbb-c7f5a4d092d0`. These are production images, not audit “before” images.

| Production media path | Dimensions | Size | Role |
| --- | ---: | ---: | --- |
| `docs/media/modelduel-cover.png` | 1600×900 | 152,499 B | Devpost cover and animated 3D landing hero |
| `docs/media/moon-evidence.png` | 1280×900 | 114,198 B | Moon two-world evidence |
| `docs/media/model-revision-trace.png` | 1280×900 | 230,353 B | Completed revision trace and transfer result |
| `docs/media/seasons-evidence.png` | 1280×900 | 127,349 B | Seasons two-world evidence |
| `docs/media/mobile-hero.png` | 375×812 | 63,196 B | Responsive landing, verified CTA, and 3D entry |

Production visual QA completed Moon at 1280px and 375px through the trace, and Seasons at 1280px through evidence. Both evidence views rendered two canvases and no 2D recovery view. Horizontal overflow, page errors, failed requests, and unexpected console messages were all zero. The journeys used no login, made zero analyze calls, used only verified authored revision, kept authored-source labels visible, exposed one primary verified CTA, and kept live analysis disabled before confirmation.

## Final submission checklist

### Code and tests

- [x] Complete and review the 2026-07-17 pre-merge local quality gate at HEAD `682c206`.
- [x] Merge the approved work to `main` with merge commit `e04443f`.
- [x] Run and record the post-merge `main` gate: Vitest **332/332** across **31 files**, Next.js/OpenNext **Pass**, `cf:typecheck` **Pass**, Wrangler dry run **8,277.49 KiB raw / 1,619.88 KiB gzip**, dependency audit **clean**.
- [x] Run and record Chromium E2E **34/34** after the merge.
- [x] Merge the learner-controlled teacher handoff to `main` with merge commit `6186358`.
- [x] Run and record the historical `6186358` post-merge gate: Vitest **335/335** across **32 files**; Chromium plus WebKit **69 passed / 1 intentional non-Chromium axe skip**; Chromium axe **Pass**; Next.js/OpenNext/Workers types/Wrangler **Pass**; dry run **8,286.05 KiB raw / 1,621.89 KiB gzip**; dependency audit **clean**.
- [x] Run the camera-accessibility candidate gate: named camera orientations and polite action announcements for Moon and Seasons; no inert controls in WebGL or renderer fallbacks; Chromium plus WebKit **71 passed / 1 intentional non-Chromium axe skip**; Chromium axe **Pass**; Next.js/OpenNext/Workers types/Wrangler **Pass**; dry run **8,288.12 KiB raw / 1,622.49 KiB gzip**; dependency audit **clean**.
- [x] Run the Option 2 replay-hardening candidate gate: per-`jti` SQLite Durable Object coordination; Codex Security 25-file delta scan **0 reportable findings**, followed by independent alarm-failure review and rollback hardening; Node **344/344** across **34 files**; workerd **7/7**; Chromium **36/36**; Next.js/OpenNext/Workers types/Wrangler **Pass**; dry run **8,849.96 KiB raw / 1,704.45 KiB gzip**; dependency audit **clean**.
- [x] Run the final merged `e5e7b03` gate: frozen install; Node **356/356** across **34 files**; workerd **7/7**; Chromium **38/38**; WebKit **37 passed / 1 intentional non-Chromium axe skip**; Next.js/OpenNext/Workers types/Wrangler **Pass**; dry run **8,855.59 KiB raw / 1,705.90 KiB gzip**; production dependency audit **clean**; standard Codex Security scan **96/96 sources** with **0 reportable findings**.
- [x] Run the Evidence Lens `1649c4b` gate: Node **360/360** across **36 files**; workerd **7/7**; Chromium **38/38**; capture/evidence/trace accessibility **Pass**; Next.js/OpenNext/Workers types/Wrangler **Pass**; dry run **8,852.91 KiB raw / 1,707.73 KiB gzip**.
- [x] Run the first-view 3D `96b93d4` gate: Node **363/363** across **37 files**; workerd **7/7**; local Chromium plus WebKit **85 passed / 1 intentional skip**; Ubuntu Chromium/Firefox/WebKit **127 passed / 2 intentional skips**; responsive 3D, reduced-motion, capture/evidence/trace accessibility, Next.js/OpenNext/Workers types/Wrangler **Pass**.
- [x] Prove the free Moon and Seasons judge journeys at browser runtime: exact same-origin `GET /api/demo` → verified-sample `POST /api/revision` → `POST /api/transfer`, with zero `/api/analyze` and zero external HTTP requests.
- [x] Verify production visual journeys: Moon desktop and mobile through trace; Seasons desktop through evidence; zero overflow, page errors, failed requests, or unexpected console messages; no live submit.

Pre-merge local gate at HEAD `682c206`: Vitest **332/332** across **31 files**; Chromium E2E **34/34**; Next.js, OpenNext, and Wrangler **Pass**; Worker **8,277.49 KiB raw / 1,619.89 KiB gzip**; dependency audit **no known vulnerabilities**. Wrangler reported **18 deployable asset entries** backed by **14 physical assets**; the largest dynamic 3D chunk was **896,059 bytes**. The rendered design audit scored **B+ / 3.37**, AI Slop **B-**, goodwill **93**, with Critical/High/Medium findings **0/0/0**. The performance audit recorded **229,931 encoded bytes** of initial JS before the outer recovery addition and **231,708 encoded bytes** for the final recovery build at HEAD `682c206`; under 4× CPU throttling, the primary CTA became ready in **363 ms**.

Current post-merge `main` runtime gate: **Complete for first-view 3D merge `96b93d4`**. The current video candidate was generated from that exact commit against the matching production deployment and opens on the animated 3D comparison.

Submission-quality candidate gate on 2026-07-17 JST: `pnpm check` passed with Vitest **335/335** across **32 files** and a successful Next.js production build; Chromium plus WebKit E2E completed with **69 passed / 1 intentional non-Chromium axe skip**; the Chromium axe scan passed capture, evidence, and trace for WCAG 2.0/2.1/2.2 A/AA tags. OpenNext/Workers typecheck, Wrangler dry run (**8,286.05 KiB raw / 1,621.89 KiB gzip**), and production dependency audit all passed. At that dated gate, the local Playwright Firefox build could not launch even for an empty page because of a host graphics failure (`RenderCompositorSWGL failed mapping default framebuffer, no dt`), so Ubuntu CI still had to supply the three-engine evidence.

Current public submission gate at main merge `96b93d4`: [GitHub Actions run `29681260428`](https://github.com/Yasei-no-otoko/ModelDuel/actions/runs/29681260428) passed lint, typecheck, **363/363** unit tests across **37 files**, **7/7** workerd tests, submission-video contract validation, Next.js production build, Cloudflare Worker build/typecheck, Wrangler bundle validation, and the production dependency audit. Its Ubuntu Chromium/Firefox/WebKit job completed successfully with **127 passed / 2 intentional skips**. No paid API request was made.

### GPT-5.6 proof

- [x] Preserve the dated 2026-07-17 Terra/Luna production integration smoke as historical integration evidence, not final-build proof.
- [x] Apply the minimum-cost gate to the replay-hardening candidate: preserve the dated Terra/Luna integration proof and make no additional paid model call before all local, deployment, and free-boundary checks pass.
- [x] Build the pre-merge OpenNext Worker at HEAD `682c206`: **8,277.49 KiB raw / 1,619.89 KiB gzip**; account-plan-specific production confirmation remains pending.
- [x] Verify pre-merge generated Cloudflare binding types and inventory: **18 deployable entries**, **14 physical assets**, largest dynamic 3D chunk **896,059 bytes**.
- [x] Verify visible live-source labels and fail-closed behavior on the pre-merge quality branch.
- [x] Capture safe final-build proof of configured Terra/Luna model usage without exposing prompts, learner data, cookie values, or secrets.
- [x] Confirm final-build learner-data Responses requests still use `store: false`.

Paid live canary inherited from earlier main merge `e04443f`: one analysis returned HTTP 200 in **17.642 seconds**, source `live`, model `gpt-5.6-terra`, with the exact tool order `validate_world_spec` → `simulate_world` → `compare_predictions` → `select_discriminating_case`. One revision returned HTTP 200 in **1.404 seconds**, source `gpt-5.6`, model `gpt-5.6-luna`; the same session and signed evaluation were accepted, conceptual change was `revised` with score `1`, and `liveUseAttestation: true` was present on both requests. The server-minted cookie was reused with `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Strict`; its value was not recorded. The strict responses did not expose token usage or cost. This is not presented as a paid canary of merge `6186358`; the handoff release used only the free verified production path.

Final paid canary for merge `e5e7b03`: only after all local, dry-run, deployed-binding, header, and free-ledger gates passed, one Terra analysis returned HTTP 200 in **18.363 seconds**, source `live`, model `gpt-5.6-terra`, with the same exact four-tool order. The same session then made one Luna revision request, which returned HTTP 200 in **3.477 seconds**, source `gpt-5.6`, model `gpt-5.6-luna`, conceptual change `revised`, and score `1`. HTTP and SDK retries were zero, and no further paid canary was run. Raw learner data, feedback, cookies, capabilities, secrets, and identifiers were not retained.

### Deployment and repository

- [x] Configure a production evaluation secret of at least 32 characters.
- [x] Configure and locally verify four fail-closed Cloudflare Rate Limiting bindings for live endpoints.
- [x] Verify all four production Rate Limiting bindings through deployed Cloudflare version 3 metadata.
Operational follow-up, not a submission gate: exact production CPU p95 and account Workers Paid telemetry remain unclaimed because the connector exposed neither an exact CPU metric nor a Workers Paid subscription entry.
- [x] Historical deployment for main merge `6186358`: [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev), Cloudflare version `e400d0d7-3fb1-47be-8872-ef9caeefb5d9`, build ID `nkFYXp8co99asrn8bVd1U`.
- [x] Verify HTTP 200, CSP/HSTS/nosniff, the exact free three-request verified ledger, teacher summary/handoff visibility, confirmation-disabled controls, boundary text, internal-metadata exclusion, and zero failed requests or console errors.
- [x] Clear the Medium/P2 live-revision token replay blocker locally with per-`jti` atomic Durable Object control, prove a reused valid token with fresh caller keys cannot make a second upstream request, and complete the 25-file security delta scan with zero reportable findings.
- [x] Deploy Option 2 main merge `3d65845` as Cloudflare version `cc6bc7c5-13e6-463d-a8d6-533267a2d468`; verify the created `RevisionReplayLedger`, Terra/Luna and Rate Limit bindings, root/security headers, and exact free production judge ledger without a paid model call.
- [x] Deploy final implementation merge `e5e7b03` as Cloudflare version `37596678-0018-4415-b9bd-5671d67068bb`; verify 100% traffic, both required secrets by name, the Durable Object, all four Rate Limit bindings, Terra/Luna routing, latest scope copy, HSTS/CSP/nosniff, and the exact free production judge ledger.
- [x] Deploy Evidence Lens runtime merge `1649c4b` as Cloudflare version `857b32b6-7ae0-4eec-8be2-75421eaf77ba`; verify root HTTP 200, HSTS/CSP, the free Moon verified sample, Terra/Luna and all Worker bindings, and zero paid calls during production visual capture.
- [x] Deploy first-view 3D merge `96b93d4` as Cloudflare version `cd38e435-7875-4125-bfbb-c7f5a4d092d0`; verify responsive one-Canvas animation at 1600×900, 1280×720, and 768×1024, the exact free three-request ledger, no browser errors or horizontal overflow, and zero paid calls.
- [x] Publish the MIT-licensed repository and verify anonymous README access; initial publication SHA `e7ed952ef9616744c6eeea09f6ec4b0434c83972`.
- [ ] Replace the remaining video placeholder after the user-owned YouTube upload.

### Codex evidence

- [x] Upload the primary build task through Codex's official feedback workflow; returned Session ID `019f648c-0eb8-7b60-ad84-28ce35bbac4b`.
- [x] Replace the Codex Feedback Session ID placeholder.
- [x] Capture the primary Codex build objective, representative scoped commits, and final gates in the 2:30–2:42 video segment.
- [x] Confirm the media reflects the final Evidence Lens product implementation; later repository changes are submission documentation and cross-browser test coverage only.

### Video and media

- [x] Capture and inventory five current first-view 3D production screenshots from Cloudflare version `cd38e435-7875-4125-bfbb-c7f5a4d092d0` with `/api/analyze` blocked and observed call count **0**.
- [x] Select `docs/media/modelduel-cover.png` as the Devpost cover/thumbnail and README hero.
- [x] Confirm the deterministic authored-source label is visible and no live submit occurs in the production screenshot journeys.
- [x] Complete the rights audit for the five first-party production screenshots and cover.
- [x] Record the exact 2:45 shot list with audible English narration; current run `20260719T092408557Z-fec2df68-b1ea-4ea6-9b0a-fb97131df4b5` records the animated 3D hero from merge `96b93d4` and 363/7/43 plus Security 96/96/0 evidence from that exact generator commit.
- [x] Verify the exact three-request authored ledger, zero live model calls, zero external HTTP, and no cookies or request/response payloads in the recording manifest.
- [x] Audit the current video media: first-party browser capture, OpenAI TTS `nova` with persistent disclosure and 10/10 cache hits, no music, H.264/AAC/mov_text, full decode pass, matching hashes, and checked 10-frame contact sheet. See [current evidence](VIDEO_EVIDENCE_2026-07-19.md).
- [ ] User-owned manual gate: upload the final video to YouTube as **Public** (not Unlisted or Private), verify it while logged out, and replace `{{VIDEO_URL}}`. Codex only maintains [the title and description copy](YOUTUBE_PUBLICATION_COPY.md) and does not publish.

### Devpost form

- [ ] Paste the project name, tagline, Education category, built-with list, outline, and long description.
- [x] Confirm the live demo, repository URL, and Codex Feedback Session ID values.
- [ ] Add the user-owned public video URL, then verify all final links and playback in a logged-out browser.
- [x] Review the current official rules, FAQ, repository requirements, Feedback Session ID guidance, and public YouTube video requirements on 2026-07-19 JST.
- [ ] Submit before the deadline and retain confirmation.

## Official sources

- [OpenAI Build Week rules](https://openai.devpost.com/rules)
- [OpenAI Build Week FAQ](https://openai.devpost.com/details/faqs)
- [OpenAI Build Week](https://openai.devpost.com/)
- [Devpost Help: How do I set up the submission period?](https://help.devpost.com/article/145-how-do-i-set-up-the-submission-period)
- [Devpost Help: How to enter a submission](https://help.devpost.com/article/122-how-to-enter-a-submission)
- [Devpost Help: Uploading a demo video](https://help.devpost.com/article/85-uploading-a-demo-video)
- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
