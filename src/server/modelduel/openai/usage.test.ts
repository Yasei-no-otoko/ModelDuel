import { describe, expect, it } from "vitest";

import {
  createOpenAIUsageRecord,
  logOpenAIUsage,
  OPENAI_PRICING_VERSION,
} from "./usage";

const RESPONSE = {
  service_tier: "default",
  status: "completed",
  usage: {
    input_tokens: 1_000,
    input_tokens_details: {
      cached_tokens: 200,
      cache_write_tokens: 100,
    },
    output_tokens: 100,
    output_tokens_details: { reasoning_tokens: 20 },
    total_tokens: 1_100,
  },
};

describe("OpenAI usage-only telemetry", () => {
  it("prices Terra standard usage in integer micro-USD", () => {
    expect(
      createOpenAIUsageRecord(
        "programmatic_orchestration",
        "gpt-5.6-terra",
        RESPONSE,
      ),
    ).toEqual({
      operation: "programmatic_orchestration",
      model: "gpt-5.6-terra",
      serviceTier: "default",
      status: "completed",
      input: 1_000,
      cached: 200,
      cacheWrite: 100,
      output: 100,
      reasoning: 20,
      total: 1_100,
      estimatedMicroUsd: 3_613,
      pricingVersion: OPENAI_PRICING_VERSION,
    });
  });

  it("uses Luna revision pricing and records no learner or response content", () => {
    const responseWithPrivateFields = {
      ...RESPONSE,
      learnerText: "private learner text",
      evaluationId: "private-evaluation-id",
      rawResponse: "private response",
    };
    const record = createOpenAIUsageRecord(
      "revision_feedback",
      "gpt-5.6-luna",
      responseWithPrivateFields,
    );
    expect(record.estimatedMicroUsd).toBe(1_445);
    expect(Object.keys(record)).toEqual([
      "operation",
      "model",
      "serviceTier",
      "status",
      "input",
      "cached",
      "cacheWrite",
      "output",
      "reasoning",
      "total",
      "estimatedMicroUsd",
      "pricingVersion",
    ]);
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("evaluationId");
    expect(serialized).not.toContain("rawResponse");
  });

  it("never lets telemetry failure alter the model-call outcome", () => {
    expect(() =>
      logOpenAIUsage(
        "learner_extraction",
        "gpt-5.6-terra",
        RESPONSE,
        () => {
          throw new Error("sink unavailable");
        },
      ),
    ).not.toThrow();
  });
});
