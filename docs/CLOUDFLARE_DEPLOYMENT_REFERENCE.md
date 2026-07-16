# Cloudflare Workers deployment reference

Last verified against first-party documentation: **2026-07-17**

This file records the Cloudflare runtime contract for ModelDuel before deployment. The production target is a Cloudflare Worker built with OpenNext, not Cloudflare Pages.

## Supported deployment path

- Build Next.js with `@opennextjs/cloudflare@1.20.1` and deploy with `wrangler@4.111.0`.
- Next.js 16 App Router, route handlers, static assets, and server rendering are supported by the OpenNext adapter. ModelDuel does not depend on the unsupported Node.js middleware path.
- Commit an explicit `wrangler.jsonc` and `open-next.config.ts` so builds are reproducible even though Wrangler can now detect supported Next.js projects automatically.
- Use a current compatibility date and `nodejs_compat`. The worker entry point is `.open-next/worker.js`, and `.open-next/assets` is served through the `ASSETS` binding.
- Run `opennextjs-cloudflare build` and a Wrangler dry run before production deployment. `next dev` and `next build` do not prove compatibility with the Workers `workerd` runtime.

This differs from older Pages-oriented examples and from the locally bundled reference snapshot: the current first-party Next.js guide recommends Workers plus OpenNext, current Wrangler supports automatic framework detection, and current OpenNext supports the installed Next.js 16 minor release.

## Runtime bindings and generated types

Server route handlers access Workers bindings with OpenNext's `getCloudflareContext({ async: true })`. `wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts` generates the binding declaration checked by TypeScript; do not maintain a second hand-written environment type.

ModelDuel uses four Workers Rate Limiting bindings:

| Binding | Limit | Period | Purpose |
| --- | ---: | ---: | --- |
| `ANALYSIS_AGGREGATE_LIMITER` | 10 | 60 seconds | Per-location analysis spend ceiling |
| `ANALYSIS_CLIENT_LIMITER` | 2 | 60 seconds | Hashed-client analysis abuse control |
| `REVISION_AGGREGATE_LIMITER` | 20 | 60 seconds | Per-location revision spend ceiling |
| `REVISION_CLIENT_LIMITER` | 4 | 60 seconds | Hashed-client revision abuse control |

Each binding receives an independent integer-string namespace ID. The aggregate limiter is evaluated before the client limiter so a saturated spend ceiling cannot be bypassed by rotating addresses. Client keys are SHA-256 hashes of `CF-Connecting-IP`; requests without a usable address share an `unknown` bucket. Raw addresses never enter logs.

Workers Rate Limiting counters are local to a Cloudflare location and intentionally eventually consistent. They are a production abuse and spend guard, not an exact global billing ledger. ModelDuel therefore also keeps OpenAI request caps, zero SDK retries, and low output ceilings. Binding absence, API failure, or malformed binding results fail closed in production.

## Secrets and environment

Production secrets:

- `OPENAI_API_KEY`
- `MODELDUEL_EVALUATION_SECRET`

Both are server-only and are declared as required secrets in Wrangler configuration. Deployment must fail when either is absent. Local values belong in ignored `.env.local` or `.dev.vars` files and must never be committed, printed, copied into `vars`, or exposed through `NEXT_PUBLIC_*` names.

Non-secret production variables select the trusted Cloudflare proxy mode, enable Workers rate bindings, and pin the Sol and Terra model IDs. With Node.js compatibility, Workers secrets are also available through `process.env`, which keeps the existing server-only gateway compatible with OpenNext.

## Observability and privacy

Workers observability is enabled with low sampling. OpenAI telemetry contains only operation, model, service tier, completion status, aggregate token counts, a versioned price estimate, and the pricing-version date. It must never contain learner text, images, raw request or evaluation IDs, reasoning contents, tool transcripts, upstream response bodies, raw client addresses, or exception messages.

## Limits relevant to ModelDuel

- Workers request bodies are well above ModelDuel's validated 4.3 MB analysis-body ceiling.
- Workers memory is 128 MB. Sketches are decoded only after a 3 MiB application limit and are not retained in repair prompts.
- Worker bundle size is limited by account plan (3 MiB compressed on Free and 10 MiB on Paid). The OpenNext bundle must be measured before upload.
- External fetch wait time is distinct from Worker CPU time. ModelDuel still enforces its own per-call and route-wide timeouts.

## First-party references

- [Next.js on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
- [OpenNext bindings](https://opennext.js.org/cloudflare/bindings)
- [OpenNext environment variables](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
