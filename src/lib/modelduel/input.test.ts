import { describe, expect, it } from "vitest";

import { AnalyzeRequestSchema } from "./input";

const BASE = {
  schemaVersion: "1.0" as const,
  requestId: "analyze-request-1",
  sessionId: "analyze-session-1",
  requestedAt: 1_800_000_000_000,
  scenarioId: "moon-phases" as const,
  explanation: "Earth's shadow causes the phases.",
  sketch: null,
};

describe("AnalyzeRequestSchema", () => {
  it("accepts text-only and sketch-only boundaries", () => {
    expect(AnalyzeRequestSchema.parse(BASE).explanation).toBe(BASE.explanation);
    expect(
      AnalyzeRequestSchema.parse({
        ...BASE,
        explanation: "",
        sketch: {
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      }).sketch,
    ).not.toBeNull();
  });

  it("rejects empty input and unknown fields", () => {
    expect(
      AnalyzeRequestSchema.safeParse({ ...BASE, explanation: "" }).success,
    ).toBe(false);
    expect(
      AnalyzeRequestSchema.safeParse({ ...BASE, unexpected: true }).success,
    ).toBe(false);
  });

  it("enforces the explanation boundary", () => {
    expect(
      AnalyzeRequestSchema.safeParse({
        ...BASE,
        explanation: "a".repeat(1_500),
      }).success,
    ).toBe(true);
    expect(
      AnalyzeRequestSchema.safeParse({
        ...BASE,
        explanation: "a".repeat(1_501),
      }).success,
    ).toBe(false);
  });

  it("rejects non-image and remote sketch references", () => {
    expect(
      AnalyzeRequestSchema.safeParse({
        ...BASE,
        explanation: "",
        sketch: {
          mimeType: "image/svg+xml",
          dataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      }).success,
    ).toBe(false);
  });
});
