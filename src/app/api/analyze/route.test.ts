import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_ANALYZE_JSON_BYTES } from "../../../lib/modelduel/input";
import { createRateLimitStore } from "@/server/modelduel/rate-limit";
import { handleAnalyzeRequest } from "./route";

const BODY = {
  schemaVersion: "1.0",
  requestId: "analyze-route-request",
  sessionId: "analyze-route-session",
  requestedAt: 1_800_000_000_000,
  scenarioId: "moon-phases",
  liveUseAttestation: true,
  explanation: "Earth's shadow causes phases.",
  sketch: null,
};

function request(
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" },
) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const BODY_WITHOUT_LIVE_ATTESTATION: Record<string, unknown> = { ...BODY };
delete BODY_WITHOUT_LIVE_ATTESTATION.liveUseAttestation;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/analyze safe boundary", () => {
  it("returns configuration required without a live API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await handleAnalyzeRequest(request(BODY));
    const json = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error.code).toBe("CONFIGURATION_REQUIRED");
  });

  it("returns 415 for a non-JSON request", async () => {
    const response = await handleAnalyzeRequest(
      request(BODY, { "Content-Type": "text/plain" }),
    );
    expect(response.status).toBe(415);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
  });

  it("returns 413 before parsing an oversized body", async () => {
    const response = await handleAnalyzeRequest(
      request(BODY, {
        "Content-Type": "application/json",
        "Content-Length": String(MAX_ANALYZE_JSON_BYTES + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "PAYLOAD_TOO_LARGE",
    );
  });

  it("rejects unknown fields without contacting the model", async () => {
    const rateLimitStore = createRateLimitStore();
    const response = await handleAnalyzeRequest(
      request({ ...BODY, unexpected: true }),
      { now: 1_000, rateLimitStore },
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      "INVALID_REQUEST",
    );
    expect(rateLimitStore.globals.size).toBe(0);
  });

  it.each([
    ["missing", BODY_WITHOUT_LIVE_ATTESTATION],
    ["false", { ...BODY, liveUseAttestation: false }],
  ])(
    "rejects a %s live-use attestation before rate limiting or model calls",
    async (_label, body) => {
      const rateLimitStore = createRateLimitStore();
      const gateway = {
        analysisModel: "gpt-5.6-terra" as const,
        revisionModel: "gpt-5.6-luna" as const,
        parseLearnerModel: vi.fn(),
        runProgramTurn: vi.fn(),
        parseRevisionFeedback: vi.fn(),
      };

      const response = await handleAnalyzeRequest(request(body), {
        gateway,
        now: 1_000,
        rateLimitStore,
      });

      expect(response.status).toBe(400);
      expect(
        ((await response.json()) as { error: { code: string } }).error.code,
      ).toBe("INVALID_REQUEST");
      expect(rateLimitStore.globals.size).toBe(0);
      expect(gateway.parseLearnerModel).not.toHaveBeenCalled();
      expect(gateway.runProgramTurn).not.toHaveBeenCalled();
      expect(gateway.parseRevisionFeedback).not.toHaveBeenCalled();
    },
  );

  it("does not charge requests that fail model configuration preflight", async () => {
    process.env.MODELDUEL_EVALUATION_SECRET = "a".repeat(32);
    process.env.OPENAI_API_KEY = "";
    const rateLimitStore = createRateLimitStore();

    const response = await handleAnalyzeRequest(request(BODY), {
      now: 1_000,
      rateLimitStore,
    });
    expect(response.status).toBe(503);
    expect(rateLimitStore.globals.size).toBe(0);
  });
});
