import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildLearnerResponseInput,
  classifySdkFailureCode,
  isLocalStructuredParseFailure,
  tolerantStructuredParse,
} from "./gateway";

class APIConnectionTimeoutError extends Error {}
class APIUserAbortError extends Error {}

describe("OpenAI gateway safe failure classification", () => {
  it("omits an image from every repair request", () => {
    const input = buildLearnerResponseInput({
      scenarioId: "moon-phases",
      explanation: "",
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      previousOutputText: "invalid",
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
