# OpenAI SDK implementation reference

Last verified against first-party documentation and the installed SDK: **2026-07-17**

This file is the implementation contract for ModelDuel's OpenAI integration. Keep API calls on the server, pin the SDK version, and prefer the Responses API examples below over older Chat Completions snippets.

The repository currently pins `openai@6.47.0`; the installed package and its exported Responses types were inspected alongside the first-party references listed at the end of this document. The application itself requires Node.js `>=22.13.0` and pins Node.js `24.18.0` in `.nvmrc`.

## Runtime and model policy

- Pin `openai@6.47.0`.
- Use `gpt-5.6-terra` for the hero analysis and PTC flow, including text and sketch interpretation.
- Use `gpt-5.6-luna` for live revision feedback.
- Resolve model IDs at request time so imports and production builds do not instantiate an OpenAI client.
- Validate configured model IDs before sending a request.

These choices supersede the original concept note's Sol/Terra routing. ModelDuel uses Terra for the judged analysis and validated PTC path, then Luna for bounded revision feedback. The exact routing order is:

- Analysis: `MODELDUEL_ANALYSIS_MODEL`, then `OPENAI_HERO_MODEL`, then `gpt-5.6-terra`.
- Revision: `MODELDUEL_REVISION_MODEL`, then `OPENAI_MODEL`, then `gpt-5.6-luna`.

Missing or invalid live configuration produces a safe error. It never silently switches a live request to the verified sample.

## Token and cost-control contract

GPT-5.6 defaults to medium reasoning when `reasoning.effort` is omitted. ModelDuel therefore sets every request deliberately rather than inheriting that cost-bearing default:

| Operation | Model | Reasoning | Verbosity | Output ceiling |
| --- | --- | --- | --- | ---: |
| Learner-model extraction | Terra | `none` | `low` | 650 |
| Revision feedback | Luna | `none` | `low` | 450 |
| PTC first round | Terra | `low` | `low` | 900 |
| PTC continuation | Terra | `low` | `low` | 600 |

All requests use the standard service tier, zero SDK retries, and `store: false`. Structured extraction and revision requests select explicit 30-minute cache mode but intentionally define neither a cache key nor a breakpoint, so unique learner content does not cause an explicit cache write. PTC alone uses implicit 30-minute caching with a scenario-scoped key (`modelduel:ptc:v1:<scenario>`), so stable instructions and tool schemas can be reused without mixing scenario semantics. Learner sketches use low-detail vision because the task requires a coarse causal diagram, not fine text or photographic inspection.

### 2026-07-17 current-documentation delta

OpenAI's current [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) continues to favor the Responses API and its TypeScript `responses.parse` / `zodTextFormat` example. A refusal can fall outside the requested schema, so ModelDuel must retain an explicit refusal branch rather than assuming every response parses. [Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching) describes automatic GPT-5.6 reuse for eligible prompts; explicit cache keys or breakpoints belong only after measuring a stable prefix and must never turn unique learner text into a reusable prefix. Current [GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/model-guidance?model=gpt-5.6-terra) favors lean prompts and bounded PTC. This is a documentation delta only: no SDK or model change is approved, and `openai@6.47.0` remains pinned.

The production orchestrator is capped at six rounds and four tool calls. Six rounds cover the conservative sequential shape of one required function per turn, a separate `program_output` turn, and a final-message turn; grouped tool calls still complete earlier. `parallel_tool_calls` is disabled so the model cannot spend the four-call budget concurrently. Success requires the exact ledger `validate_world_spec` → `simulate_world` → `compare_predictions` → `select_discriminating_case` plus a final assistant message; tool completion alone is not a successful response. Continuations remain enabled because the final message can arrive after the last tool output. The first production smoke returned HTTP 502 with `ORCHESTRATION_INVALID` under the previous three-round cap. That outcome was consistent with round exhaustion, but no per-turn diagnostics existed to prove the cause; the six-round fix addresses that failure mode and adds bounded diagnostics. The failed smoke is not evidence of a successful live analysis.

The fixed production build then completed a text-only Terra analysis in one HTTP request with no retry: HTTP 200 in 19,378 ms, the exact four-tool ledger, five PTC rounds, and no `ptc_failure`. Six Terra Responses calls—one learner extraction and five orchestration turns—used 7,182 input tokens (5,160 cached and 1,645 cache-write), 399 output tokens, 18 reasoning tokens, and 7,581 total tokens, for an estimated **$0.013358**. Only after that post-response usage gate passed, one Luna revision HTTP request completed in 1,742 ms with 375 input, 118 output, and 493 total tokens for an estimated **$0.001083**. The successful sequence therefore used 8,074 total tokens and an estimated **$0.014441**. Raw learner data, feedback, encrypted evaluation tokens, secrets, and request identifiers were not retained in this evidence.

The output ceilings are paired with bounded schemas rather than truncating a larger contract: learner summaries are at most 240 characters, causal and spatial relation lists contain at most four entries, predicted observations contain at most three 160-character entries, revision summaries are at most 280 characters, strengths contain at most three 160-character entries, and the next step is at most 200 characters. A no-repair success can emit at most 4,550 Terra tokens plus 450 Luna tokens, or **$0.07095 maximum output spend** at standard prices. Including one allowed structured repair in both stages raises the output ceiling to 5,200 Terra tokens plus 900 Luna tokens, or **$0.0834**, before input and cache charges. These are output-only ceilings, not a hard all-in guarantee below $0.10: input, cache-write, and cached-input charges are additional and cannot be known exactly before the response. A production smoke is one-shot with no HTTP retry; its actual usage and estimated charge are reviewed from post-response usage telemetry before any further live request.

Usage telemetry is emitted once per upstream call as a JSON `openai_usage` event and contains only aggregate token counters and a versioned price estimate. Standard-tier estimates use the prices verified on 2026-07-17: Terra $2.50/M input, $0.25/M cached input, $3.125/M cache-write input, and $15/M output; Luna $1/M input, $0.10/M cached input, $1.25/M cache-write input, and $6/M output. Cache-write and reasoning counters are recorded separately when present. Production PTC turns emit bounded JSON diagnostics containing only round/status/byte counts, allow-listed output and function names, ledger progress, and presence flags. PTC validation failures emit only `ptc_failure` plus a fixed reason enum such as `ROUND_LIMIT`; no model or learner payload is accepted by that logger. Learner content, images, raw identifiers, tool arguments or outputs, generated text or code, reasoning, transcripts, response bodies, and exception messages are prohibited from telemetry.

The current UI and API support both `moon-phases` and `seasons` through the live path and an explicitly selected verified-sample path. Browser requests carry the selected scenario ID; the server applies the matching strict schema and resolves private case, world, and transfer IDs from its registry. Examples below sometimes use Moon phases for readability, not as a limit on the shipped scope.

## Server-only client

```ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

`OPENAI_API_KEY` must exist only in the server environment. Never expose it in browser JavaScript, a `VITE_*` or `NEXT_PUBLIC_*` variable, client-side storage, logs, screenshots, or source control. The browser calls a validated ModelDuel server endpoint; that endpoint calls OpenAI.

Every ModelDuel OpenAI request sets `store: false`, because learner explanations and sketches may contain personal or classroom data. `store: false` disables application response storage for these requests, but default abuse-monitoring logs may still include prompts and responses and may be retained for up to 30 days. Zero Data Retention requires OpenAI approval and applicable organization/project controls; this prototype does not claim ZDR. See OpenAI's [data controls](https://developers.openai.com/api/docs/guides/your-data).

The product boundary keeps the authored, API-free verified sample open to everyone. Live GPT input is limited to people 18 or older, or learners using it with teacher or guardian authorization. The live button remains disabled until the user prospectively confirms that they will not include personal or identifying student information anywhere in the live attempt, including the revised explanation. The exact-true attestation is enforced by the server before either live analysis or live revision can reach rate limiting or a model call; it is not stored as evidence. ModelDuel does not request a name, date of birth, age, or proof of authorization. This confirmation is a product safeguard; it is not age verification or a claim of legal compliance. See OpenAI's [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) and [data controls](https://developers.openai.com/api/docs/guides/your-data).

## Responses API, including image input

Use `client.responses.create` or `client.responses.parse`, not Chat Completions. A sketch is supplied as an `input_image` content item alongside text:

```ts
const response = await openai.responses.create({
  model: "gpt-5.6-terra",
  store: false,
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "Infer the learner's causal model for the selected astronomy scenario." },
      { type: "input_image", image_url: sketchDataUrl, detail: "low" },
    ],
  }],
});
```

Production accepts only canonical local PNG, JPEG, or WebP data URLs. It validates the declared MIME type, base64 spelling, decoded magic bytes, and a 3 MiB decoded-size limit. Learner-supplied remote URLs and unsupported media types are rejected before an OpenAI call.

## Structured output in TypeScript

For Zod-backed structured output, use `responses.parse` with `zodTextFormat`. The format belongs under `text.format`; do not copy the older `response_format` placement. The snippet below uses a Moon-phases statement as one input example; seasons uses the same request shape with its scenario-specific schema.

```ts
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const LearnerModel = z.object({
  misconceptionType: z.string(),
  confidence: z.number().min(0).max(1),
  predictedObservations: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-5.6-terra",
  store: false,
  input: "The Moon changes shape because Earth's shadow covers it.",
  text: {
    format: zodTextFormat(LearnerModel, "learner_model"),
  },
});

const learnerModel = response.output_parsed;
```

The SDK parser eagerly invokes the format's raw parser. ModelDuel therefore wraps that parser only to retain up to 4 KiB of schema-invalid raw text for one text-only repair. Only `SyntaxError` and `ZodError` are repairable. Transport errors, SDK defects, refusals, incomplete responses, and API errors propagate through the safe failure taxonomy and never enter the repair path. Sketch bytes are omitted from every repair request.

Treat `output_parsed === null`, refusals, incomplete responses, and a second schema failure as explicit application failures. Do not manufacture a valid learner model or `WorldSpec` after parsing fails.

## Function tools use the Responses flat shape

Responses function tools put `name`, `description`, `parameters`, and `strict` directly on the tool object. Do **not** use the Chat Completions `{ type: "function", function: { ... } }` wrapper. The illustrative schema below is the Moon-phases branch; production also enforces a strict seasons branch with Sun/Earth bodies, a distance-only learner claim, axial tilt, and server-owned registry IDs.

```ts
const tools = [{
  type: "function" as const,
  name: "validate_world_spec",
  description: "Validate a constrained astronomy WorldSpec.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      worldSpec: {
        type: "object",
        properties: {
          bodies: {
            type: "array",
            items: { type: "string", enum: ["sun", "earth", "moon"] },
            minItems: 3,
            maxItems: 3,
            uniqueItems: true,
          },
          cameraOrigin: { type: "string", enum: ["earth"] },
          learnerClaim: {
            type: "object",
            properties: {
              earthShadowCausesPhases: { type: "boolean" },
            },
            required: ["earthShadowCausesPhases"],
            additionalProperties: false,
          },
        },
        required: ["bodies", "cameraOrigin", "learnerClaim"],
        additionalProperties: false,
      },
    },
    required: ["worldSpec"],
    additionalProperties: false,
  },
}];

const response = await openai.responses.create({
  model: "gpt-5.6-terra",
  store: false,
  input: "Validate this constrained learner world.",
  tools,
});
```

Validate tool arguments again in application code. A schema-valid request is not automatically physically meaningful or authorized. ModelDuel resolves model output to private, allow-listed world and case IDs; GPT does not author arbitrary simulation code or physical constants.

## Programmatic Tool Calling (PTC)

Enable PTC with a marker tool whose only field is `type: "programmatic_tool_calling"`. Put `allowed_callers` and `output_schema` on each function tool that PTC may call, not on the marker.

```ts
const ptcMarker = {
  type: "programmatic_tool_calling" as const,
};

const simulateWorldTool = {
  type: "function" as const,
  name: "simulate_world",
  description: "Run one validated astronomy WorldSpec.",
  allowed_callers: ["programmatic"],
  strict: true,
  parameters: {
    type: "object",
    properties: {
      worldSpecId: { type: "string" },
      caseId: { type: "string" },
    },
    required: ["worldSpecId", "caseId"],
    additionalProperties: false,
  },
  output_schema: {
    type: "object",
    properties: {
      observationId: { type: "string" },
      illuminatedFraction: { type: "number" },
    },
    required: ["observationId", "illuminatedFraction"],
    additionalProperties: false,
  },
};

const tools = [ptcMarker, simulateWorldTool];
```

With `store: false`, request encrypted reasoning by adding `include: ["reasoning.encrypted_content"]`. A continuation must resend all response items in their original order. This includes program items, reasoning items with encrypted content, function calls, function-call outputs, and `program_output` items. Do not extract only the apparent function call or rebuild the sequence from scratch.

Each `program_output.call_id` must match the `call_id` of a known `program` item. Its official status is either `completed` or `incomplete`. An `incomplete` item is an intermediate result: replay it and continue, remember the latest status per program call, and accept a final assistant message only after no program call remains incomplete. A later `completed` status for the same call resolves the intermediate state.

When appending a function-call output, preserve the exact `caller` value from its corresponding model-emitted function call. The caller distinguishes a direct model call from a call made inside the PTC program; dropping, normalizing, or rewriting it breaks the call chain.

```ts
const first = await openai.responses.create({
  model: "gpt-5.6-terra",
  store: false,
  include: ["reasoning.encrypted_content"],
  input: initialInput,
  tools,
});

// Each validated output keeps the emitted call_id and caller unchanged.
const continued = await openai.responses.create({
  model: "gpt-5.6-terra",
  store: false,
  include: ["reasoning.encrypted_content"],
  input: [
    ...initialInput,
    ...first.output,
    ...toolOutputsInCallOrder,
  ],
  tools,
});
```

Production accepts calls only from known program callers, rejects duplicate item and call IDs, enforces the exact four-tool ledger order, and forwards every response output item before appending tool outputs in call order. The four tools are `validate_world_spec`, `simulate_world`, `compare_predictions`, and `select_discriminating_case`.

PTC does not make arbitrary generated code safe for the browser. ModelDuel's simulation remains a deterministic, allow-listed engine. The hosted program may orchestrate only named tools, and each tool enforces its own schemas, byte limits, identity checks, and physical registry.

## Current request and security boundaries

- OpenAI SDK timeout: 20 seconds per call.
- SDK retries: zero; application retries are explicit and retain the same request identifiers.
- Route-wide signal: client abort combined with a 50-second timeout.
- Orchestration: at most six rounds, four calls, and 32 response output items per turn.
- Function arguments: 4 KiB; deterministic tool output: 8 KiB.
- Raw SDK response serialization: 128 KiB; accumulated transcript: 512 KiB.
- Sketch: canonical PNG, JPEG, or WebP data URL, maximum decoded size 3 MiB.
- Analyze JSON request body: 4,300,000 bytes, enforced while streaming even without `Content-Length`.
- Local tests may inject an isolated in-memory rate-limit store explicitly; runtime code has no module-global mutable counter. Cloudflare production uses fail-closed per-POP bindings for a hashed-client limit followed by an aggregate ceiling.
- Vercel mode is inferred only from its platform-provided `VERCEL=1` environment variable and trusts only `x-vercel-forwarded-for`.
- Cloudflare mode requires `MODELDUEL_TRUSTED_PROXY=cloudflare`, trusts only `CF-Connecting-IP`, and requires an origin restricted to Cloudflare proxy traffic.
- Without a trusted proxy mode, forwarded address headers are ignored and requests share the conservative unknown-client bucket.

Rate-limit accounting happens immediately before the first paid model call and only after gateway configuration and request-specific validation. Invalid configuration, invalid images, invalid signed revision context, and verified-sample revision requests do not consume the live-model request budget. A rejected or failed client binding does not consume aggregate capacity; an accepted client then passes the per-POP aggregate ceiling. These bindings are eventually consistent soft guards, so OpenAI request, retry, and output caps remain the hard application-side cost controls.

The public transfer token is an AES-256-GCM encrypted, server-authenticated envelope. It binds the session, question identity, option set, answer, rationale, expiry, and—for live analysis only—the private revision context. Browser revision requests return that opaque token rather than resubmitting trusted world, case, or misconception fields. Transfer grading remains deterministic on the server.

No raw SDK response, reasoning item, sketch data URL, evaluation token, exception body, or upstream error message is serialized into a client error or written to an application log.

## Decisions for ModelDuel

| Concern | Adopted decision |
| --- | --- |
| API surface | Responses API only |
| Analysis model | `gpt-5.6-terra` by default |
| Revision model | `gpt-5.6-luna` by default |
| Structured data | `responses.parse` plus `zodTextFormat` under `text.format` |
| Schema repair | At most once, text-only, and only for local JSON or Zod failures |
| Simulation | Private registry and deterministic application code |
| Tool orchestration | Flat Responses tools with validated PTC caller and transcript handling |
| Retention request flag | `store: false` on every OpenAI request |
| Secret handling | Server-only API and evaluation keys; no direct browser-to-OpenAI requests |
| Grading | Encrypted server token and deterministic transfer evaluation |

## First-party references

- [OpenAI JavaScript and TypeScript SDK](https://github.com/openai/openai-node)
- [OpenAI Node SDK v6.47.0 release](https://github.com/openai/openai-node/releases/tag/v6.47.0)
- [OpenAI API libraries](https://developers.openai.com/api/docs/libraries)
- [Responses API migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Images and vision guide](https://developers.openai.com/api/docs/guides/images-vision)
- [Function calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- [Programmatic Tool Calling guide](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
- [Conversation state and stateless encrypted reasoning](https://developers.openai.com/api/docs/guides/conversation-state)
- [Model catalog](https://developers.openai.com/api/docs/models)
- [GPT-5.6 Terra model](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [GPT-5.6 Luna model](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Your data and API retention controls](https://developers.openai.com/api/docs/guides/your-data)
- [Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
- [API key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare origin IP restoration and origin restriction guidance](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/)

If a future SDK type definition disagrees with this document, stop and check the current first-party documentation before changing the request shape. Record any material integration change here before updating application code.
