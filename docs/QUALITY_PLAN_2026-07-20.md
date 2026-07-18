<!-- /autoplan restore point: /Users/wildman/.gstack/projects/DevPostOpenAI/codex-modelduel-winning-quality-autoplan-restore-20260717-084103.md -->
# ModelDuel Winning Quality Plan

Deadline: 2026-07-20 JST
Branch: `codex/modelduel-winning-quality`
Production: <https://modelduel.yasei.workers.dev>

## Objective

Maximize ModelDuel's probability of placing in the DevPost OpenAI Education category by making the three-minute judging path immediately understandable, technically credible, visually polished, resilient on judge hardware, and fully supported by reproducible submission evidence.

## Pending Premise Gate

The product remains an Education entry and keeps middle-school science as its learning context. Before product-code implementation, confirm the public live-input boundary:

- Approved boundary (2026-07-17): keep deterministic verified samples open to every judge, but limit live Terra/Luna analysis to people 18 or older, or learners using it with teacher or guardian authorization. Require a prospective, attempt-wide confirmation and prohibit names and personal or identifying student information, including in the revised explanation. Do not claim age verification, legal compliance, readiness for unsupervised minor use, or that `store:false` is Zero Data Retention.
- Not adopted: self-directed minor live input, which requires a materially larger child-safety, privacy, age-assurance, moderation, monitoring, escalation, and retention-compliance program that is not credible to complete before the deadline.

The work must improve all four equally weighted judging dimensions:

1. Technological Implementation
2. Design
3. Potential Impact
4. Quality of the Idea

## Product Premises to Validate

- The strongest differentiator is not a generic AI tutor or a generic 3D simulation. It is the evidence loop: a learner's mental model and the scientific model make different predictions, then observation decides.
- Judges must understand that loop within the first 20 seconds and experience a complete revision trace within three minutes.
- The verified sample path must remain deterministic and instant; live Terra/Luna analysis is additive proof, not a dependency for the core demo.
- One excellent lunar-phases journey plus a credible seasons transfer example is more persuasive than broad but shallow subject coverage.
- Technical depth must be visible in the experience and the submission narrative without exposing internal complexity to the learner.
- Accessibility, safe failure modes, cost control, and deterministic fallbacks are part of implementation quality, not post-demo polish.

## Dated pre-quality evidence baseline — 2026-07-16 (superseded)

The bullets below are retained as the conditions that motivated this plan, not as claims about the current implementation. Later quality work made the verified sample primary, added the listed security headers and live-use boundary, and raised the automated gate to 31 Vitest files / 332 tests plus 34 Chromium E2E tests before the cross-browser release-gate work.

- `pnpm check` passes: lint, typecheck, 27 Vitest files, 311 tests, Next production build.
- Playwright Chromium E2E passes 23/23.
- Cloudflare typecheck and Wrangler strict dry-run pass.
- Production audit reports no known vulnerable production dependencies.
- Production root and verified Moon demo return HTTP 200; invalid demo input returns HTTP 400.
- Production root TTFB from Japan is approximately 0.43–0.71 seconds.
- Initial CSS/JS transfer is approximately 509 KB compressed; the largest JS asset is approximately 317 KB compressed.
- Production responses currently lack an explicit CSP, HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- E2E emits repeated `THREE.Clock` deprecation warnings; production WebGL inspection emitted one GPU readback stall warning.
- Production Terra analysis has measured approximately 19.4 seconds, yet the current screen and component hierarchy presents live analysis as the primary CTA and the instant verified sample as secondary.
- The current product framing targets middle-school learners, while public live text and sketch input lacks an explicit adult-supervision boundary, no-personal-information warning, age-appropriate disclosure, and reporting path.
- Submission placeholders remain for repository URL, video URL, and Codex Feedback Session ID.

## Quality Workstreams

### 1. Submission Completeness and Judge Proof

- Remove every avoidable submission placeholder or turn it into a clearly owned external gate.
- Produce a judge-ready README path with one-click demo instructions, expected outputs, architecture proof, cost proof, and fallback behavior.
- Recut the demo to 2:40–2:45, then finish the narration, capture checklist, screenshot checklist, and final-link validation.
- Record which features were built with Codex and how the major implementation decisions are evidenced by commits and tests.

### 2. Three-Minute Hero Journey

- Make the value proposition, current stage, and layout legible without narration.
- Reduce time from landing to the first prediction.
- Make the instant verified challenge the primary/default CTA; label live analysis as an approximately 20-second technical proof.
- Keep the learner's prediction locked before evidence is shown.
- Make the contradiction and model revision visually unmistakable.
- End with a compact Model Revision Trace that provides evidence of a conceptual revision attempt without claiming durable learning gains.
- Preserve deterministic verified samples and explicit provenance for live results.

### 3. Visual, Responsive, and Accessible Quality

- Audit every judging-path screen, component, and layout for information hierarchy, typography, contrast, focus order, keyboard behavior, touch targets, reduced motion, loading, error, partial, and fallback states.
- Test desktop Chromium, Firefox, WebKit, narrow mobile viewports, and a WebGL-disabled path.
- Add automated accessibility checks where they provide stable signal.
- Avoid a broad redesign unless the rendered experience proves it necessary.

### 4. Performance and Runtime Reliability

- Measure route-level bundle composition and defer Three.js / React Three Fiber until the comparison experience needs it when safe.
- Preserve instant verified-demo interaction while reducing initial JavaScript transfer and main-thread work.
- Remove or explain Three.js deprecation and GPU-readback warnings.
- Verify caching semantics for immutable build assets and `no-store` semantics for API/demo data.
- Establish budgets for initial transfer, interaction readiness, API latency, and Worker CPU where measurable.

### 5. Security, Privacy, and Abuse Resistance

- Add compatible security headers without breaking Next.js, WebGL, Workers assets, or OpenAI API calls.
- Keep secrets server-only and verify no key-shaped values are tracked.
- Add the approved adult/teacher-supervision boundary, no-personal-information instruction, age-appropriate AI disclosure, and reporting path to the live flow.
- Preserve strict schemas, request-size limits, fixed error enums, PTC call/round limits, `store:false`, safe logs, and fail-closed rate limiting.
- Treat hashed IP rate limiting as a soft abuse guard, not identity or billing enforcement.
- Threat-model prompt injection, malformed sketches, oversized inputs, replay, quota exhaustion, log leakage, and frame embedding.

### 6. OpenAI Orchestration and Cost Efficiency

- Preserve production routing: `gpt-5.6-terra` for analysis and `gpt-5.6-luna` for revision.
- Reconcile current official Responses API guidance for encrypted reasoning items and stateless `store:false` continuation.
- Keep exact Programmatic Tool Calling transcript and ledger validation.
- Keep image detail and prompt caching choices evidence-based.
- Run no paid smoke test until all local, mocked, dry-run, and production-read gates pass; then call each paid endpoint at most once without retry.

### 7. Engineering Safety and CI

- Add Cloudflare typecheck, Wrangler dry-run, and production dependency audit to CI when stable and appropriately secret-free.
- Expand E2E coverage without making WebGL tests flaky.
- Add regression tests for every behavior change and every discovered failure path.
- Refactor large components only where required to make a high-value change safe; avoid deadline-driven architecture churn.

## Release Gates

### Replay-control blocker — closed locally on 2026-07-18

The pre-publication security scan `d9e79820-7d63-4836-84f1-6125601f1825` reviewed 38/38 selected surfaces on immutable commit `34f45b2` and reported one Medium/P2 finding (CWE-294). A live-revision token mints a `jti` but does not atomically consume it, so the same valid token can reach repeated gateway attempts when presented with fresh caller keys while its TTL and rate-limit capacity remain. TTL, output caps, zero SDK retries, and per-POP rate limits constrain this behavior but do not close it.

Option 2 is implemented on the dedicated replay-hardening branch: each signed-token `jti` maps through an HMAC-derived name to one SQLite-backed Durable Object. Its atomic `claim`/`commit`/`complete` state machine returns completed results for an identical request, rejects a changed fingerprint, and prevents a second upstream request while work is in progress. Production fails closed if the binding is missing; local development uses an explicitly selected, short-lived memory coordinator. Cleanup is alarm-driven and attempts to re-arm after storage failure without storing raw token IDs or raw learner explanations; a failed re-arm throws so Cloudflare's finite alarm retries can run.

The immutable 25-file delta scan `62747eff-3ba1-4245-b2b5-a3c53a55cca6` completed with **0 reportable findings**. An independent final release audit then identified an alarm-arm availability edge and an imprecise retention sentence; the claim now rolls back before returning if its first cleanup alarm cannot be armed, and the copy names the authorization window instead of a fixed minute count. The final candidate gate passed ESLint, TypeScript, **344/344 Node tests across 34 files**, **7/7 workerd tests**, the submission-video contract, Next.js/OpenNext builds, generated Worker types, Wrangler dry run (**8,849.96 KiB raw / 1,704.45 KiB gzip**), Chromium **36/36**, and a production dependency audit with no known vulnerabilities. A prior same-host WebKit run passed **35 tests with 1 intentional non-Chromium axe skip**; the pinned Firefox build remains the documented host-graphics exception rather than a claimed pass. Production deployment and free post-deploy boundary verification remain the next gates; no repository or video publication is implied.

All gates must pass on the quality branch before merge:

- Clean worktree and intentional diff only.
- ESLint and TypeScript pass with no new warnings.
- All Vitest suites pass.
- Production Next.js build passes.
- Chromium, Firefox, and WebKit E2E pass or an evidence-backed platform exception is documented.
- Accessibility audit has no critical or serious findings in the judging path.
- Cloudflare typecheck and strict Wrangler dry-run pass.
- Production dependency audit reports no known vulnerabilities.
- Bundle/performance budgets pass or an explicit measured tradeoff is documented.
- Security headers and API behavior are verified in production after deployment.
- One paid Terra analysis and one paid Luna revision smoke pass only after the cost gate, with usage and estimated cost recorded without learner content.
- README, DevPost submission checklist, demo video evidence, repository access, and feedback Session ID are complete or explicitly identified as external user-owned gates.

## Implementation Order

1. Validate premises and judge journey against official rules and current app behavior.
2. Close disqualification/submission gaps.
3. Improve the hero journey and visible evidence of conceptual change.
4. Add compatible security headers and CI coverage.
5. Reduce initial bundle/runtime warnings without destabilizing the 3D path.
6. Expand browser, accessibility, fallback, and production canary coverage.
7. Run final paid API smoke under a strict no-retry cost gate.
8. Merge verified commits to `main`, deploy, and re-run production evidence checks.

## Explicitly Not in Scope Before the Deadline

- Native headset-only XR requirements.
- Broad teacher class-management features.
- Arbitrary user-generated physics or unrestricted generated code.
- Full support for additional science subjects beyond the two existing astronomy examples.
- Large framework migrations or aesthetic rewrites without measured judging-path benefit.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Make verified sample the primary judge CTA | Mechanical | Bias toward action | It is instant and deterministic; live analysis consumes roughly 19 seconds of a three-minute judging window | Keeping the slower live call as the visual default |
| 2 | CEO | Target a 2:40–2:45 video | Mechanical | Completeness | Preserves room for platform timing variance while remaining safely under the rules' three-minute limit | Shipping at 2:55 with five seconds of tolerance |
| 3 | CEO | Claim evidence of revision, not proof of durable conceptual change | Mechanical | Explicit over clever | One revision plus one transfer item is auditable evidence but not a longitudinal learning outcome | Overstated learning-effect claims |
| 4 | CEO | Adult/teacher-supervised boundary for live input | User confirmation | Safety and feasibility | OpenAI requires extra safeguards for minors and `store:false` is not ZDR | Unsupervised minor live input without the larger compliance program |
