# Cloudflare revision replay reference

Verified on 2026-07-17 before implementing the live-revision replay boundary.

## Current guidance that changed the implementation

- OpenNext's generated Worker exports only `fetch`. A custom Worker must reuse
  that handler and explicitly export application Durable Object classes, then
  become Wrangler's `main` entry point.
- New Durable Object namespaces should use declarative top-level `exports`
  with `storage: "sqlite"`. The older `migrations` form is legacy and is
  mutually exclusive with `exports`.
- A Durable Object should represent one coordination atom. ModelDuel therefore
  derives an HMAC key from each random signed-token `jti` and routes that key to
  a deterministic object name rather than exposing the raw `jti` or using one
  global ledger.
- RPC methods are preferred over a custom `fetch` protocol. Persistent storage
  transitions provide the ordering boundary; no OpenAI request is made inside
  a Durable Object or `blockConcurrencyWhile` section.
- An alarm deletes the short-lived fingerprint and normalized result one minute
  after the signed token's authorization window, avoiding a cleanup race at the
  exact clock-skew boundary. Because exception-driven alarm retries stop after
  six attempts, deletion failures are caught and the handler attempts to re-arm
  once per minute. A failed re-arm throws so those finite retries can run. Raw learner explanations are never stored in
  the object, although normalized feedback may reflect them until cleanup.
- `next dev` uses an explicit process-local ephemeral implementation so local
  live-flow development remains possible. Production never falls back when the
  Durable Object binding is missing or unavailable.
- Cloudflare's current Vitest pool release supports Vitest 4.1, matching this
  repository. This differs from older examples constrained to Vitest 3.

## Primary references

- [OpenNext custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [Cloudflare rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Create stubs and use RPC](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/)
- [Test Durable Objects](https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/)
