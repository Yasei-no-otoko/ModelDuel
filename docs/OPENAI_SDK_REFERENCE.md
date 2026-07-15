# OpenAI SDK implementation reference

Last verified against first-party documentation: **2026-07-15**

This file is the implementation contract for ModelDuel's OpenAI integration. Keep API calls on the server, pin the SDK version, and prefer the Responses API examples below over older Chat Completions snippets.

## Runtime and model policy

- Pin `openai@6.47.0`.
- Use a supported, non-EOL Node.js release, with **Node.js 20 or newer** as the minimum.
- Use `gpt-5.6-terra` for routine parsing, grading, and transfer-question generation.
- Override with `gpt-5.6-sol` for the hero flow where the strongest image and reasoning quality matters.
- The `gpt-5.6` alias currently resolves to **GPT-5.6 Sol**. Pin the explicit tier/model ID in application defaults so an alias change cannot silently alter cost or behavior.

These choices differ from the original concept note, which treated `gpt-5.6`/Sol as the general-purpose default. ModelDuel instead reserves Sol for the judged hero path and uses Terra for the normal path.

## Server-only client

```ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

`OPENAI_API_KEY` must exist only in the server environment. Never expose it in browser JavaScript, a `VITE_*`/`NEXT_PUBLIC_*` variable, client-side storage, logs, screenshots, or source control. The browser calls a ModelDuel server endpoint; that endpoint calls OpenAI.

Every ModelDuel request must set `store: false`, because learner explanations and sketches may contain personal or classroom data.

## Responses API, including image input

Use `client.responses.create`, not Chat Completions. A sketch is supplied as an `input_image` content item alongside text:

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

Only accept validated image MIME types and bounded file sizes before producing `sketchDataUrl`. Do not pass arbitrary remote URLs supplied by a learner without server-side controls.

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
  model: "gpt-5.6-terra",
  store: false,
  input: "The Moon changes shape because Earth's shadow covers it.",
  text: {
    format: zodTextFormat(LearnerModel, "learner_model"),
  },
});

const learnerModel = response.output_parsed;
```

Treat `output_parsed === null`, refusals, incomplete responses, and schema failures as explicit application states. Do not silently manufacture a valid `WorldSpec` after parsing fails.

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
  model: "gpt-5.6-terra",
  store: false,
  input: "Validate this constrained learner world.",
  tools,
});
```

Validate tool arguments again in application code. A schema-valid request is not automatically physically meaningful or authorized.

## Programmatic Tool Calling (PTC)

Enable PTC with a marker tool whose only field is `type: "programmatic_tool_calling"`. Put `allowed_callers` and `output_schema` on each **function tool that PTC may call**, not on the marker.

```ts
const ptcMarker = {
  type: "programmatic_tool_calling" as const,
};

const simulateWorldTool = {
  type: "function" as const,
  name: "simulate_world",
  description: "Run one validated astronomy WorldSpec.",
  allowed_callers: [
    "programmatic",
  ],
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

With `store: false`, request encrypted reasoning by adding `include: ["reasoning.encrypted_content"]` to the initial request and every continuation. A continuation must resend **all** response items in their original order. This includes program items, reasoning items (with their encrypted content), function calls, function-call outputs, and `program_output` items. Do not extract only the apparent function call or rebuild the sequence from scratch.

When appending a function-call output, preserve the exact `caller` value from its corresponding model-emitted function call. The caller distinguishes a direct model call from a call made inside the PTC program; dropping, normalizing, or rewriting it breaks the call chain.

```ts
const first = await openai.responses.create({
  model: "gpt-5.6-terra",
  store: false,
  include: ["reasoning.encrypted_content"],
  input: initialInput,
  tools,
});

// `toolOutputsInCallOrder` contains the validated function-call outputs and
// retains each emitted call's call_id and caller without modification.
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

The example intentionally forwards `first.output` as an ordered sequence. Production orchestration must likewise retain the complete ordered program/reasoning/function-call/function-call-output/`program_output` transcript across every subsequent turn.

PTC does not make arbitrary generated code safe for the browser. ModelDuel's simulation remains a deterministic, allow-listed `WorldSpec` engine. The PTC program may orchestrate only the named tools, and each tool must enforce its own validation, limits, and authorization.

## Decisions for ModelDuel

| Concern | Adopted decision |
| --- | --- |
| API surface | Responses API only |
| Default model | `gpt-5.6-terra` |
| Hero image/reasoning flow | Explicit `gpt-5.6-sol` override |
| Structured data | `responses.parse` + `zodTextFormat` in `text.format` |
| Simulation | Validated DSL interpreted by deterministic application code |
| Tool orchestration | Flat Responses function tools; PTC only where multi-tool comparison adds value |
| Retention | `store: false` on every request |
| Secret handling | Server-only API key; no direct browser-to-OpenAI requests |

## First-party references

- [OpenAI JavaScript/TypeScript SDK](https://github.com/openai/openai-node)
- [OpenAI Node SDK v6.47.0 release](https://github.com/openai/openai-node/releases/tag/v6.47.0)
- [OpenAI API libraries](https://developers.openai.com/api/docs/libraries)
- [Responses API migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Images and vision guide](https://developers.openai.com/api/docs/guides/images-vision)
- [Function calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- [Programmatic Tool Calling guide](https://developers.openai.com/api/docs/guides/tools-programmatic-tool-calling)
- [Model catalog](https://developers.openai.com/api/docs/models)
- [API key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)

If a future SDK type definition disagrees with this document, stop and check the current first-party documentation before changing the request shape. Record any material integration change here before updating application code.
