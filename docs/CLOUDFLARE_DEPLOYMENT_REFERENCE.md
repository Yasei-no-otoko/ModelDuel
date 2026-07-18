# Cloudflare Workers deployment reference

Last verified against first-party documentation: **2026-07-17**

This file records the Cloudflare runtime contract for ModelDuel before deployment. The production target is a Cloudflare Worker built with OpenNext, not Cloudflare Pages.

## Supported deployment path

- Build Next.js with `@opennextjs/cloudflare@1.20.1` and deploy with `wrangler@4.112.0`.
- Next.js 16 App Router, route handlers, static assets, and server rendering are supported by the OpenNext adapter. ModelDuel does not depend on the unsupported Node.js middleware path.
- Commit an explicit `wrangler.jsonc` and `open-next.config.ts` so builds are reproducible even though Wrangler can now detect supported Next.js projects automatically.
- Use the latest runtime-supported compatibility date and `nodejs_compat`. On 2026-07-17 JST, local workerd still evaluated the calendar in UTC and rejected `2026-07-17` as future-dated, so the verified deployment date is `2026-07-16`. Wrangler enters through `custom-worker.ts`, which forwards OpenNext's generated `.open-next/worker.js` fetch handler and exports the replay Durable Object; `.open-next/assets` is served through the `ASSETS` binding.
- Run `opennextjs-cloudflare build` and a Wrangler dry run before production deployment. `next dev` and `next build` do not prove compatibility with the Workers `workerd` runtime.

This differs from older Pages-oriented examples and from the locally bundled reference snapshot: the current first-party Next.js guide recommends Workers plus OpenNext, current Wrangler supports automatic framework detection, and current OpenNext supports the installed Next.js 16 minor release.

## Runtime bindings and generated types

Server route handlers access Workers bindings with OpenNext's `getCloudflareContext({ async: true })`. `pnpm cf:typegen` first builds the OpenNext entrypoint, then runs `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts` to generate binding and Workers runtime declarations; do not maintain hand-written substitutes for `RateLimit`, `Fetcher`, the Durable Object namespace, or the environment. Wrangler derives `Cloudflare.GlobalProps.mainModule` from `custom-worker.ts`, so generation must always be build-backed and its output must include `REVISION_REPLAY_LEDGER` plus the custom-worker main module.

ModelDuel uses four Workers Rate Limiting bindings:

| Binding | Limit | Period | Purpose |
| --- | ---: | ---: | --- |
| `ANALYSIS_AGGREGATE_LIMITER` | 10 | 60 seconds | Per-location analysis spend ceiling |
| `ANALYSIS_CLIENT_LIMITER` | 2 | 60 seconds | Hashed-client analysis abuse control |
| `REVISION_AGGREGATE_LIMITER` | 20 | 60 seconds | Per-location revision spend ceiling |
| `REVISION_CLIENT_LIMITER` | 4 | 60 seconds | Hashed-client revision abuse control |

Each binding receives an independent integer-string namespace ID. The hashed-client limiter is evaluated first, so a rejected or broken client bucket does not consume aggregate capacity. Accepted clients then pass the aggregate ceiling; rotating addresses cannot bypass that later check. Client keys are SHA-256 hashes of `CF-Connecting-IP`; requests without a usable address share an `unknown` bucket. Raw addresses never enter logs.

Workers Rate Limiting counters are per-POP and intentionally eventually consistent. They are a soft production abuse and spend guard, not an exact global OpenAI budget or billing ledger. ModelDuel therefore also keeps OpenAI request caps, zero SDK retries, and low output ceilings. Binding absence, API failure, malformed binding results, or a missing enable flag fail closed whenever `NODE_ENV=production`; only local development may bypass Cloudflare bindings.

## Durable Object replay boundary

ModelDuel defines `RevisionReplayLedger` as a declarative top-level SQLite `export` and binds it as `REVISION_REPLAY_LEDGER`; legacy migrations are not mixed with this configuration. Each signed token's random `jti` is HMAC-derived into a deterministic name that selects one unique object without exposing the raw identifier. Its synchronous SQLite transitions atomically claim and commit the first paid execution, cache only normalized feedback or a safe terminal error, and reject concurrent or changed replays. The object performs no OpenAI fetch and never holds `blockConcurrencyWhile()` across external I/O. Production and explicit durable-object mode fail closed when OpenNext cannot resolve the binding; only `next dev` may use the timed process-local coordinator. Cleanup runs after the full authorization window and one-minute grace. If `deleteAll()` fails, the handler attempts to schedule a new alarm because Cloudflare's exception-driven alarm retries are limited; a failed re-arm throws so those finite retries can run.

## Secrets and environment

Production secrets:

- `OPENAI_API_KEY`
- `MODELDUEL_EVALUATION_SECRET`

Both are server-only and are declared as required secrets in Wrangler configuration. Deployment must fail when either is absent. Local values belong in ignored `.env.local` or `.dev.vars` files and must never be committed, printed, copied into `vars`, or exposed through `NEXT_PUBLIC_*` names.

Non-secret production variables select the trusted Cloudflare proxy mode, enable Workers rate bindings, and pin the Terra analysis/PTC and Luna revision model IDs. With Node.js compatibility, Workers secrets are also available through `process.env`, which keeps the existing server-only gateway compatible with OpenNext.

## Observability and privacy

Workers console-log observability is enabled at 5% sampling with invocation logs disabled. Automatic traces are disabled for the initial deployment because a root HTTP span can retain a request URL containing a raw session identifier. The allow-listed OpenAI usage log contains only operation, model, service tier, completion status, aggregate token counts, a versioned price estimate, and the pricing-version date. It must never contain learner text, images, raw request or evaluation IDs, reasoning contents, tool transcripts, upstream response bodies, raw client addresses, URLs, or exception messages.

## Limits relevant to ModelDuel

- Workers request bodies are well above ModelDuel's validated 4.3 MB analysis-body ceiling.
- Workers memory is 128 MB. Sketches are decoded only after a 3 MiB application limit and are not retained in repair prompts.
- Worker bundle size is limited by account plan (3 MiB compressed on Free and 10 MiB on Paid). The account plan is treated conservatively as Free until verified, so release requires a Wrangler-reported compressed bundle below 3 MiB plus an inventory of `.open-next/assets` file count and largest asset.
- Free-plan HTTP requests have a 10 ms CPU limit. External OpenAI fetch wait does not consume CPU, but OpenNext routing, validation, cryptography, and serialization still do. A successful production smoke and its Workers CPU outcome are release gates; a dry run alone cannot prove this limit.
- External fetch wait time is distinct from Worker CPU time. ModelDuel still enforces its own per-call and route-wide timeouts.

`pnpm cf:typegen` must be followed by `pnpm cf:typecheck`. The latter rebuilds OpenNext before running `wrangler types cloudflare-env.d.ts --env-interface CloudflareEnv --check`, so the generated main-module import, bindings, and runtime types are compared against the same deterministic build state.

## Pre-deployment verification snapshot

The 2026-07-17 OpenNext build and Wrangler dry run passed without uploading or deploying:

- Wrangler 4.111.0 reported **8,255.25 KiB raw / 1,613.37 KiB gzip**, below the conservative 3 MiB compressed Worker ceiling.
- `.open-next/assets` contained **12 regular files** totaling about 2.9 MiB on disk. The largest asset was a generated JavaScript chunk at **1,253,594 bytes**.
- Wrangler resolved all four Rate Limiting bindings, the `ASSETS` binding, trusted-proxy/rate-enable variables, and the Terra/Luna model variables.
- Generated Workers types passed Wrangler's `--check` drift validation.
- Local `workerd` preview returned HTTP 200 for `/` and the Moon verified-sample `/api/demo` route. The initial `2026-07-17` compatibility date failed as future-dated under UTC; rebuilding with `2026-07-16` passed.

These results proved build and configuration readiness before the production release. The Free-plan 10 ms HTTP CPU limit was not proven by the dry run, and per-POP Rate Limiting remains a soft budget boundary. The subsequent production evidence is recorded separately below.

## Production verification snapshot

The final runtime commit was deployed on 2026-07-17 JST to [modelduel.yasei.workers.dev](https://modelduel.yasei.workers.dev). Wrangler reported a **33 ms startup time**, and deployment status showed one active version receiving **100%** of traffic. The public root returned HTTP 200 to a HEAD check; the root GET returned 9,926 bytes, and the Moon verified-sample route returned HTTP 200 with a 3,098-byte response that passed its source, scenario, two-world, and transfer-question checks.

The paid smoke used no HTTP retry. One text-only Terra analysis returned HTTP 200 in 19,378 ms, produced the exact four-tool ledger over five PTC rounds, and emitted no `ptc_failure`. Its six Responses calls used 7,581 total tokens and an estimated **$0.013358**. The usage gate passed before the application made one Luna revision request, which returned HTTP 200 in 1,742 ms with 493 total tokens and an estimated **$0.001083**. The successful sequence totaled 8,074 tokens and an estimated **$0.014441**. Cloudflare live tail reported `Ok` outcomes for both POST requests without exposing learner data, response bodies, secrets, encrypted evaluation tokens, or request identifiers.

The live tail format did not expose exact Worker CPU time, so CPU duration and the account-plan-specific limit remain unverified operational metadata. The successful `Ok` outcomes show that these requests completed on the deployed Worker, but they are not a substitute for exact CPU telemetry. Per-POP Rate Limiting also remains an eventually consistent abuse guard rather than a global billing cap.

## First-party references

- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
- [OpenNext bindings](https://opennext.js.org/cloudflare/bindings)
- [OpenNext environment variables](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
