# OpenAI SDK implementation reference

Last verified against first-party documentation and the installed SDK: **2026-07-15**

This file is the implementation contract for ModelDuel's OpenAI integration. Keep API calls on the server, pin the SDK version, and prefer the Responses API examples below over older Chat Completions snippets.

The repository currently pins `openai@6.47.0`; the installed package and its exported Responses types were inspected alongside the first-party references listed at the end of this document. The application itself requires Node.js `>=22.13.0` and pins Node.js `24.18.0` in `.nvmrc`.

## Runtime and model policy

- Pin `openai@6.47.0`.
- Use `gpt-5.6-sol` for the hero analysis flow, including text and sketch interpretation.
- Use `gpt-5.6-terra` for live revision feedback.
- Resolve model IDs at request time so imports and production builds do not instantiate an OpenAI client.
- Validate configured model IDs before sending a request.

These choices differ from the original concept note, which treated GPT-5.6 Sol as a general-purpose default. ModelDuel now reserves Sol for the judged analysis path and uses Terra for revision feedback. The exact routing order is:

- Analysis: `MODELDUEL_ANALYSIS_MODEL`, then `OPENAI_HERO_MODEL`, then `gpt-5.6-sol`.
- Revision: `MODELDUEL_REVISION_MODEL`, then `OPENAI_MODEL`, then `gpt-5.6-terra`.

Missing or invalid live configuration produces a safe error. It never silently switches a live request to the verified sample.

## Server-only client

```ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

`OPENAI_API_KEY` must exist only in the server environment. Never expose it in browser JavaScript, a `VITE_*` or `NEXT_PUBLIC_*` variable, client-side storage, logs, screenshots, or source control. The browser calls a validated ModelDuel server endpoint; that endpoint calls OpenAI.

Every ModelDuel OpenAI request sets `store: false`, because learner explanations and sketches may contain personal or classroom data. `store: false` disables application-level response storage for these requests; it is not, by itself, a Zero Data Retention guarantee. Deployment retention requirements must also be handled through the applicable OpenAI organization, project, and contractual controls.

## Responses API, including image input

Use `client.responses.create` or `client.responses.parse`, not Chat Completions. A sketch is supplied as an `input_image` content item alongside text:

```ts
const response = await openai.responses.create({
  model: "gpt-5.6-sol",
  store: false,
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: "Infer the learner's moon-phase model." },
      { type: "input_image", image_url: sketchDataUrl, detail: "high" },
    ],
  }],
});
```

Production accepts only canonical local PNG, JPEG, or WebP data URLs. It validates the declared MIME type, base64 spelling, decoded magic bytes, and a 3 MiB decoded-size limit. Learner-supplied remote URLs and unsupported media types are rejected before an OpenAI call.

## Structured output in TypeScript

For Zod-backed structured output, use `responses.parse` with `zodTextFormat`. The format belongs under `text.format`; do not copy the older `response_format` placement.

```ts
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const LearnerModel = z.object({
  misconceptionType: z.string(),
  confidence: z.number().min(0).max(1),
  predictedObservations: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-5.6-sol",
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

Responses function tools put `name`, `description`, `parameters`, and `strict` directly on the tool object. Do **not** use the Chat Completions `{ type: "function", function: { ... } }` wrapper.

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
  model: "gpt-5.6-sol",
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

When appending a function-call output, preserve the exact `caller` value from its corresponding model-emitted function call. The caller distinguishes a direct model call from a call made inside the PTC program; dropping, normalizing, or rewriting it breaks the call chain.

```ts
const first = await openai.responses.create({
  model: "gpt-5.6-sol",
  store: false,
  include: ["reasoning.encrypted_content"],
  input: initialInput,
  tools,
});

// Each validated output keeps the emitted call_id and caller unchanged.
const continued = await openai.responses.create({
  model: "gpt-5.6-sol",
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
- Orchestration: at most five rounds, twelve calls, and 32 response output items per turn.
- Function arguments: 4 KiB; deterministic tool output: 8 KiB.
- Raw SDK response serialization: 128 KiB; accumulated transcript: 512 KiB.
- Sketch: canonical PNG, JPEG, or WebP data URL, maximum decoded size 3 MiB.
- Analyze JSON request body: 4,300,000 bytes, enforced while streaming even without `Content-Length`.
- Live analysis and live revision have bounded per-client and global in-memory rate limits. These are per-instance defense in depth, not distributed production enforcement.
- Vercel mode is inferred only from its platform-provided `VERCEL=1` environment variable and trusts only `x-vercel-forwarded-for`.
- Cloudflare mode requires `MODELDUEL_TRUSTED_PROXY=cloudflare`, trusts only `CF-Connecting-IP`, and requires an origin restricted to Cloudflare proxy traffic.
- Without a trusted proxy mode, forwarded address headers are ignored and requests share the conservative unknown-client bucket.

Rate-limit accounting happens immediately before the first model call. Invalid configuration, invalid images, invalid signed revision context, and verified-sample revision requests do not consume the live-model request budget. Production must add distributed platform or WAF rate limiting.

The public transfer token is an AES-256-GCM encrypted, server-authenticated envelope. It binds the session, question identity, option set, answer, rationale, expiry, and—for live analysis only—the private revision context. Browser revision requests return that opaque token rather than resubmitting trusted world, case, or misconception fields. Transfer grading remains deterministic on the server.

No raw SDK response, reasoning item, sketch data URL, evaluation token, exception body, or upstream error message is serialized into a client error or written to an application log.

## Decisions for ModelDuel

| Concern | Adopted decision |
| --- | --- |
| API surface | Responses API only |
| Analysis model | `gpt-5.6-sol` by default |
| Revision model | `gpt-5.6-terra` by default |
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
- [Your data and API retention controls](https://developers.openai.com/api/docs/guides/your-data)
- [API key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare origin IP restoration and origin restriction guidance](https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/)

If a future SDK type definition disagrees with this document, stop and check the current first-party documentation before changing the request shape. Record any material integration change here before updating application code.
