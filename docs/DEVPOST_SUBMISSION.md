# Devpost Submission — ModelDuel

> **Submission warning:** Replace every placeholder below before submitting. Do not publish placeholder text. Copy the Codex Feedback Session ID from `/feedback` in the primary build task.

- Live demo: `{{LIVE_DEMO_URL}}`
- Repository: `{{REPOSITORY_URL}}`
- Demo video: `{{VIDEO_URL}}`
- Codex Feedback Session ID: `{{CODEX_FEEDBACK_SESSION_ID}}`

## Deadline

**July 21, 2026 at 5:00 PM PDT / July 22, 2026 at 9:00 AM JST.**

## Paste-ready submission fields

- **Project name:** ModelDuel
- **Tagline:** Two models predict. Evidence decides.
- **Category:** Education
- **Built with:** Codex, OpenAI Responses API, GPT-5.6 Sol and GPT-5.6 Terra, Structured Outputs, Programmatic Tool Calling, Next.js 16, TypeScript, React, Three.js, Zod, Vitest, and Playwright

### Two-line outline

> **ModelDuel turns a student’s explanation or sketch into two runnable 3D worlds—their mental model and the scientific model—and asks them to predict before the evidence is revealed.**
>
> **Built with Codex, it uses GPT‑5.6 vision and structured outputs to infer the learner model, then validated tool orchestration and deterministic application code build the comparison and transfer test—giving teachers a reviewable trace of conceptual revision rather than another AI-generated answer.**

## Long description

### Inspiration

AI tutors can generate clear explanations, but a correct answer does not prove that a learner changed the causal model in their head. Astronomy misconceptions make that gap visible: a learner may memorize Moon-phase vocabulary while still believing that Earth's shadow causes every phase. ModelDuel was inspired by the idea that a misconception should become a testable prediction, not something an AI simply corrects.

### What it does

ModelDuel guides a learner through one protected sequence: capture → interpret → predict → observe → revise → transfer → trace. The learner explains an idea in text, optionally adds a sketch, and deliberately chooses either configured live analysis or an authored verified sample. The app compares a learner model with a scientific model, requires a prediction before revealing evidence, renders both worlds under the same case, asks for a revised explanation, and checks a transfer question. The final Model Revision Trace preserves the initial belief, prediction, observation, revision, and transfer result.

Two complete challenges share this loop. The Moon challenge confronts the belief that Earth's shadow causes regular phases. The Seasons challenge tests the belief that Earth-Sun distance causes summer and winter. Verified samples are visibly labeled, require no account or API key, and never masquerade as live output. The default configuration routes analysis to GPT-5.6 Sol and live revision feedback to GPT-5.6 Terra; these defaults are not role-enforced restrictions on validated model overrides. No real paid live-model smoke is claimed until it is run and recorded.

### How we built it

The browser experience uses Next.js, React, and TypeScript. Zod schemas constrain learner models and server contracts. GPT output is validated before it can cross into the application domain. The application—not the model—owns the allowed cases, WorldSpecs, simulation constants, evidence, transfer answer keys, and grading. Deterministic simulation code produces the astronomy state, and Three.js renders the resulting scenes; GPT never generates or executes arbitrary Three.js code.

The server exposes separate live, verified-sample, revision, and transfer routes. Live learner-data Responses requests use `store: false`. Transfer answer keys remain inside a private server registry, and the client receives an AES-256-GCM authenticated token that binds the session, question, options, answer, rationale, expiry, and live revision context. Unsupported or cross-scenario output fails closed. Live request limits are bounded in memory per client and globally per instance; a production deployment still needs distributed platform or WAF rate limiting.

### How Codex helped

Codex translated the concept into the capture → interpret → predict → observe → revise → transfer → trace state machine. It scaffolded the Next.js and TypeScript application, schemas, routes, domain layer, deterministic simulations, Three.js renderers, and tests. It then iterated on Responses API integration, Programmatic Tool Calling, encrypted evaluation tokens, bounded live request handling, fail-closed validation, race conditions, accessibility, responsive behavior, and design-review findings. The work was kept in scoped commits with supporting documentation.

Human decisions remained human-owned: the Education category, target misconceptions, pedagogical sequence, scenario scope, privacy stance, fail-closed requirements, experience priorities, and release acceptance. GPT-5.6 Sol is configured by default for strict learner-model analysis, and GPT-5.6 Terra is configured by default for bounded revision feedback. The deterministic application owns cases, WorldSpecs, simulation, evidence, transfer keys, and grading. Learner-data Responses calls use `store: false`.

### Challenges we ran into

The hardest challenge was making an AI-assisted experience feel generative without handing scientific truth or grading authority to the model. Live and authored paths also had to remain unmistakably separate: a network or configuration failure cannot silently turn into a successful fixture. Other challenges included protecting the prediction before evidence is revealed, keeping transfer keys off the client, handling stale asynchronous responses, supporting WebGL fallbacks, and preserving readable, touch-friendly layouts at narrow mobile widths.

### Accomplishments that we're proud of

- Two complete astronomy journeys reuse one coherent learning loop and deterministic simulation foundation.
- The verified-sample path is account- and key-independent while clearly disclosing its authored source.
- The configured live path is schema-constrained, validated again by application code, and fails closed without silent fallback.
- Predictions are locked before evidence, and transfer grading is authenticated at the server boundary.
- The interface includes source labels, keyboard-visible controls, mobile-safe layouts, and an accessible, strictly validated sketch uploader.
- The repository records build-week provenance, SDK decisions, product boundaries, and submission verification work.

### What we learned

The useful boundary is not “AI versus deterministic code.” It is deciding which responsibility belongs to each. A model is valuable for extracting a learner's claim and giving bounded feedback on revised prose. Deterministic code is better for selecting cases, simulating worlds, revealing evidence, protecting answer keys, and grading transfer. We also learned that provenance labels and explicit failure states are part of the learning design: learners and judges should always know whether they are seeing a configured live result or an authored verified sample.

### What's next

Before submission, we will run and record real Sol and Terra live smoke checks, complete final clean-branch and post-merge gates, deploy the final build, publish the repository, capture only final-build screenshots, record the 2:55 demo, and replace every placeholder in this document. After the hackathon, the same constrained-world pattern could expand to additional science misconceptions and a teacher-facing view of Model Revision Traces. Any impact or learning-gain claim would require a separate classroom evaluation.

## Judging criteria map

| Criterion | ModelDuel evidence |
| --- | --- |
| Technological Implementation | Default GPT-5.6 Sol/Terra routing, image and text capture, schema-constrained Responses, validated tool orchestration, private deterministic registries, authenticated evaluation tokens, fail-closed routes, deterministic simulations, and Three.js renderers. |
| Design | One legible sequence protects prediction before evidence, separates live and verified sources, supports keyboard/touch/mobile use, and ends with a coherent revision trace. |
| Potential Impact | The experience gives learners and teachers a structured record of conceptual revision rather than another generated answer; measured learning gains are not claimed. |
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
7. Inspect the Model Revision Trace.
8. Select **New attempt**, choose **Seasons**, and repeat the verified path.

### Optional live setup

After the verified journey works, copy the environment template:

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`, keep the configured Sol and Terra model names, and restart the development server. Enter at least 20 characters of learner text, attach a PNG/JPEG/WebP sketch, or provide both. A failed live request must remain an explicit failure; it must not become a verified result. Do not state that live Sol or Terra succeeded until a real paid smoke has completed.

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
| `POST /api/analyze` | Validate live text/sketch input and request a structured learner-model analysis. | Requires `OPENAI_API_KEY`; analysis model fallback is `MODELDUEL_ANALYSIS_MODEL` → `OPENAI_HERO_MODEL` → `gpt-5.6-sol`. |
| `GET /api/demo` | Retrieve an explicit authored verified sample. | No OpenAI key; source remains visibly verified. |
| `POST /api/demo` | Request the explicit authored verified sample through the scenario contract. | No OpenAI key; never represented as live. |
| `POST /api/revision` | Return revision feedback in `live` or `verified-sample` mode. | Live mode requires the key; revision fallback is `MODELDUEL_REVISION_MODEL` → `OPENAI_MODEL` → `gpt-5.6-terra`. |
| `POST /api/transfer` | Authenticate the evaluation token and deterministically grade the selected transfer answer. | No model chooses the answer or performs grading. |

### Environment

| Variable | Requirement and behavior |
| --- | --- |
| `OPENAI_API_KEY` | Server-only and required only for live analysis/revision. Missing or blank live configuration fails with `CONFIGURATION_REQUIRED`. |
| `MODELDUEL_ANALYSIS_MODEL` | First analysis override; falls back to `OPENAI_HERO_MODEL`, then `gpt-5.6-sol`. |
| `OPENAI_HERO_MODEL` | Secondary analysis fallback; `.env.example` uses `gpt-5.6-sol`. |
| `MODELDUEL_REVISION_MODEL` | First revision override; falls back to `OPENAI_MODEL`, then `gpt-5.6-terra`. |
| `OPENAI_MODEL` | Secondary revision fallback; `.env.example` uses `gpt-5.6-terra`. |
| `MODELDUEL_EVALUATION_SECRET` | AES evaluation-token secret. Required in production and at least 32 characters; development alone may create an ephemeral secret. |
| `MODELDUEL_TRUSTED_PROXY` | Optional. Only `cloudflare` is accepted and requires restricted origin access. Vercel is detected internally with `VERCEL=1`; otherwise forwarding headers are ignored. |

All learner-data Responses requests use `store: false`. Live budgets are charged only after validation, configuration, and signed-context preflight. In-memory per-client and global live limits are per-instance defense in depth, not a claim that distributed production rate limiting is enabled. See [OpenAI SDK reference](OPENAI_SDK_REFERENCE.md) for SDK-level details and [product specification](PRODUCT_SPEC.md) for the full domain contract.

## 2:55 demo narration and shot list

Use the verified sample for the recording unless real Sol and Terra smoke checks have succeeded and the source labels are visible.

| Time | Shot | Exact narration |
| --- | --- | --- |
| 0:00–0:12 | Hero and tagline. | “AI can give a student an answer. ModelDuel asks a harder question: did the student's causal model actually change?” |
| 0:12–0:30 | Moon capture card; show text and the optional sketch control, then select the verified sample. | “A learner explains why the Moon changes shape and can add a sketch. For this recording, I use the explicit verified sample, which needs no account or API key and never pretends to be live.” |
| 0:30–0:48 | Learner-model card and visible verified-source label; briefly show the live-path label without executing it. | “The default live configuration routes analysis to GPT-5.6 Sol to extract a strict learner model from text or image input. Here, an authored sample demonstrates the same validated contract, and its source stays clearly labeled.” |
| 0:48–1:03 | Select **Make a prediction**, choose an option, and lock it. | “Before any evidence appears, the learner must make and lock a prediction. That commitment turns an explanation into something the two worlds can test.” |
| 1:03–1:29 | Run the learner and scientific worlds side by side; rotate the view and reveal evidence. | “Both worlds now run under the same deterministic case. One treats Earth's shadow as the cause of regular phases. The scientific world keeps half the Moon illuminated while the orbit changes our viewing angle. The evidence exposes which causal model survives.” |
| 1:29–1:48 | Open revision, enter the full-scoring explanation, and continue. | “The learner revises the explanation after observing the contradiction. The default live configuration routes bounded revision feedback to GPT-5.6 Terra; this verified journey uses visibly authored feedback and makes no live-call claim.” |
| 1:48–2:09 | Answer transfer, lock it, then reveal the Model Revision Trace. | “A new transfer question checks whether the revised model generalizes. The server—not the model—protects the answer key and grades the choice. The trace connects initial belief, prediction, observation, revision, and transfer result.” |
| 2:09–2:23 | Select **New attempt**, switch to **Seasons**, and show the two comparison cards. | “The Seasons challenge reuses the same learning loop to test the distance misconception against axial tilt and opposite seasons across the hemispheres.” |
| 2:23–2:37 | Architecture diagram: browser, validated routes, Responses, allow-listed WorldSpec, deterministic renderer. | “Schema-constrained Responses stop at a strict trust boundary. Application code owns cases, WorldSpecs, simulation, evidence, transfer keys, and grading, and every learner-data request uses store false.” |
| 2:37–2:50 | Codex task, scoped commit timeline, and tests without secrets or environment files. | “Codex turned the concept into the complete state machine, scaffolded the stack, hardened API and token boundaries, and iterated through tests, races, accessibility, responsive behavior, and design review in scoped commits.” |
| 2:50–2:55 | Return to hero and tagline. | “ModelDuel. Two models predict. Evidence decides.” |

### Recording gates

- Never show or state that live Sol or Terra succeeded until a real paid smoke has completed against the final build.
- Never show `.env*` files, API keys, evaluation secrets, request headers, encrypted tokens, or other credentials.
- Keep the final cut at or below 2:55 and retain audible narration.
- Show the verified source label whenever the authored path is used.

## Screenshot list

Capture only the final merged production build. Do not include audit “before” images.

1. Hero/capture state with the ModelDuel promise and source choices.
2. Moon learner world and scientific world with evidence visible.
3. Completed Model Revision Trace.
4. Seasons comparison showing the shared two-world system.

## Final submission checklist

### Code and tests

- [x] Finish on a clean branch and review the final diff.
- [x] Merge the approved work to `main`.
- [x] Run and record `pnpm check` after the merge.
- [x] Run and record `pnpm test:e2e` after the merge.
- [ ] Manually verify Moon and Seasons on the final desktop and mobile build.

Recorded on main at `89941ff`: Vitest unit/API **283/283** across **26 files**, Chromium E2E against `next start` **23/23**, Next.js 16.2.10 production build **Pass**, and production dependency audit **No known vulnerabilities**.

### GPT-5.6 proof

- [ ] Run a real paid Sol analysis smoke against the final build.
- [ ] Run a real paid Terra revision smoke against the final build.
- [ ] Verify visible live-source labels and fail-closed behavior.
- [ ] Capture safe proof of configured model usage without exposing prompts, learner data, or secrets.
- [ ] Confirm learner-data Responses requests still use `store: false`.

### Deployment and repository

- [ ] Configure a production evaluation secret of at least 32 characters.
- [ ] Add distributed platform or WAF rate limiting for live endpoints.
- [ ] Deploy the final merged commit.
- [ ] Publish the intended repository and verify judge access.
- [ ] Replace the live-demo and repository placeholders.

### Codex evidence

- [ ] Run `/feedback` in the primary build task.
- [ ] Replace the Codex Feedback Session ID placeholder.
- [ ] Capture the primary Codex task and representative scoped commits.
- [ ] Confirm the evidence reflects the final merged implementation.

### Video and media

- [ ] Capture only final-build screenshots.
- [ ] Record the exact 2:55 shot list with audible English narration.
- [ ] Remove secrets, environment files, private tokens, and unrelated personal data from every frame.
- [ ] Audit any added video, music, screenshots, fonts, or other media for rights and attribution.
- [ ] Upload the final video to YouTube as public, verify playback and embedding while logged out, then replace `{{VIDEO_URL}}`.

### Devpost form

- [ ] Paste the project name, tagline, Education category, built-with list, outline, and long description.
- [ ] Add the final demo, repository, video, and Codex Feedback Session ID values.
- [ ] Verify all links in a logged-out browser.
- [ ] Review the official rules, FAQ, required fields, and video guidance.
- [ ] Submit before the deadline and retain confirmation.

## Official sources

- [OpenAI Open Model Hackathon rules](https://openai.devpost.com/rules)
- [OpenAI Open Model Hackathon FAQ](https://openai.devpost.com/details/faqs)
- [OpenAI Open Model Hackathon](https://openai.devpost.com/)
- [Devpost Help: How do I set up the submission period?](https://help.devpost.com/article/145-how-do-i-set-up-the-submission-period)
- [Devpost Help: How to enter a submission](https://help.devpost.com/article/122-how-to-enter-a-submission)
- [Devpost Help: Uploading a demo video](https://help.devpost.com/article/85-uploading-a-demo-video)
- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
