import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  buildLearnerResponseInput,
  classifySdkFailureCode,
  createProductionModelDuelGateway,
  isLocalStructuredParseFailure,
  LEARNER_REQUEST_POLICY,
  openAIClientOptions,
  OPENAI_API_BASE_URL,
  promptCacheKey,
  REVISION_REQUEST_POLICY,
  tolerantStructuredParse,
} from "./gateway";

class APIConnectionTimeoutError extends Error {}
class APIUserAbortError extends Error {}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenAI gateway safe failure classification", () => {
  it("defaults to Terra analysis and Luna revision and rejects a Sol override", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("MODELDUEL_ANALYSIS_MODEL", "");
    vi.stubEnv("OPENAI_HERO_MODEL", "");
    vi.stubEnv("MODELDUEL_REVISION_MODEL", "");
    vi.stubEnv("OPENAI_MODEL", "");
    const gateway = createProductionModelDuelGateway();
    expect(gateway.analysisModel).toBe("gpt-5.6-terra");
    expect(gateway.revisionModel).toBe("gpt-5.6-luna");

    vi.stubEnv("MODELDUEL_ANALYSIS_MODEL", "gpt-5.6-sol");
    expect(() => createProductionModelDuelGateway()).toThrowError(
      expect.objectContaining({ code: "CONFIGURATION_REQUIRED" }),
    );
  });
  it("pins low-cost structured request bodies with implicit cache reuse", () => {
    expect(LEARNER_REQUEST_POLICY).toEqual({
      reasoning: { effort: "none" },
      service_tier: "default",
      prompt_cache_options: { mode: "implicit", ttl: "30m" },
      text: { verbosity: "low" },
      max_output_tokens: 650,
    });
    expect(REVISION_REQUEST_POLICY).toEqual({
      reasoning: { effort: "none" },
      service_tier: "default",
      prompt_cache_options: { mode: "implicit", ttl: "30m" },
      text: { verbosity: "low" },
      max_output_tokens: 450,
    });
    expect(promptCacheKey("extract", "moon-phases")).toBe(
      "modelduel:extract:v1:moon-phases",
    );
    expect(promptCacheKey("revision", "seasons")).toBe(
      "modelduel:revision:v1:seasons",
    );
    expect(JSON.stringify(REVISION_REQUEST_POLICY)).not.toContain(
      "prompt_cache_breakpoint",
    );
  });

  it("pins paid SDK traffic to the official OpenAI API origin", () => {
    vi.stubEnv("OPENAI_BASE_URL", "https://attacker.invalid/v1");
    expect(OPENAI_API_BASE_URL).toBe("https://api.openai.com/v1");
    expect(openAIClientOptions("test-only-key")).toEqual({
      apiKey: "test-only-key",
      baseURL: "https://api.openai.com/v1",
    });
  });

  it("uses low-detail image input for the coarse learner sketch", () => {
    const input = buildLearnerResponseInput({
      scenarioId: "moon-phases",
      explanation: "Earth's shadow causes phases.",
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      safetyIdentifier: `mds1_${"A".repeat(43)}`,
      repair: false,
      idempotencyKey: "gateway-image-policy-test",
      signal: AbortSignal.timeout(10_000),
    });
    expect(JSON.stringify(input)).toContain('"detail":"low"');
    expect(JSON.stringify(input)).not.toContain('"detail":"high"');
  });
  it("omits an image from every repair request", () => {
    const input = buildLearnerResponseInput({
      scenarioId: "moon-phases",
      explanation: "",
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      previousOutputText: "invalid",
      safetyIdentifier: `mds1_${"A".repeat(43)}`,
      repair: true,
      idempotencyKey: "gateway-repair-test",
      signal: AbortSignal.timeout(10_000),
    });
    expect(JSON.stringify(input)).not.toContain("input_image");
    expect(JSON.stringify(input)).not.toContain("data:image");
  });

  it("classifies SDK timeout and user-abort constructors without relying on name", () => {
    expect(
      classifySdkFailureCode(
        new APIConnectionTimeoutError(),
        new AbortController().signal,
      ),
    ).toBe("UPSTREAM_TIMEOUT");
    expect(
      classifySdkFailureCode(
        new APIUserAbortError(),
        new AbortController().signal,
      ),
    ).toBe("UPSTREAM_TIMEOUT");
  });

  it("recognizes only local schema/JSON parse failures as repairable", () => {
    const schema = z.strictObject({ value: z.string() });
    const parsed = schema.safeParse({ value: 42 });
    if (parsed.success) {
      throw new Error("Expected schema failure");
    }
    expect(isLocalStructuredParseFailure(parsed.error)).toBe(true);
    expect(isLocalStructuredParseFailure(new SyntaxError("invalid JSON"))).toBe(
      true,
    );
    expect(isLocalStructuredParseFailure(new Error("network"))).toBe(false);
  });

  it("preserves invalid structured text for one text-only repair", () => {
    const result = tolerantStructuredParse(
      '{"schemaVersion":"1.0","learnerModel":',
      (raw) => JSON.parse(raw),
    );
    expect(result).toEqual({
      success: false,
      data: null,
      raw: '{"schemaVersion":"1.0","learnerModel":',
    });
  });

  it("rethrows unexpected parser defects instead of treating them as repairable", () => {
    expect(() =>
      tolerantStructuredParse("valid-looking", () => {
        throw new TypeError("SDK parser defect");
      }),
    ).toThrow(TypeError);
  });

  it("classifies safe HTTP status families without exposing messages", () => {
    expect(
      classifySdkFailureCode({ status: 401 }, new AbortController().signal),
    ).toBe("UPSTREAM_AUTHENTICATION");
    expect(
      classifySdkFailureCode({ status: 403 }, new AbortController().signal),
    ).toBe("MODEL_ACCESS_REQUIRED");
    expect(
      classifySdkFailureCode({ status: 429 }, new AbortController().signal),
    ).toBe("RATE_LIMITED");
  });
});
