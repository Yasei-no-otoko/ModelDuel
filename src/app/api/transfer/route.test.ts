import { Buffer } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import { issueEvaluationToken } from "../../../server/modelduel/evaluation-core";
import { POST } from "./route";

const SECRET = "modelduel-route-test-secret-that-is-long-enough";

function issue(now = Date.now()): string {
  return issueEvaluationToken(SECRET, {
    sessionId: "route-session-1",
    questionId: "moon-new-phase-transfer",
    questionVersion: "moon-transfer-v1",
    optionIds: ["toward-sun", "away-from-sun", "above-pole"],
    correctOptionId: "toward-sun",
    rationale: "The illuminated side faces away from Earth at new Moon.",
    source: "deterministic-question-bank",
    issuedAt: now,
    expiresAt: now + 20 * 60 * 1_000,
  });
}

function body(evaluationId: string): Record<string, unknown> {
  return {
    requestId: "route-request-1",
    idempotencyKey: "route-idempotency-1",
    requestedAt: Date.now(),
    evaluationId,
    sessionId: "route-session-1",
    questionId: "moon-new-phase-transfer",
    questionVersion: "moon-transfer-v1",
    selectedOptionId: "toward-sun",
  };
}

function request(payload: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/transfer", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(payload),
  });
}

function tamperCiphertext(token: string): string {
  const segments = token.split(".");
  const bytes = Buffer.from(segments[2]!, "base64url");
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  segments[2] = bytes.toString("base64url");
  return segments.join(".");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/transfer", () => {
  it.each([
    ["empty", () => ""],
    ["wrong version", () => "v2.YWFh.YmJi.Y2Nj"],
    ["bad alphabet", () => "v1.YWFh.bad+segment.Y2Nj"],
    ["oversize", () => "x".repeat(2_049)],
    ["bad segment count", () => "v1.YWFh.YmJi"],
    ["tampered", () => tamperCiphertext(issue())],
    [
      "expired",
      () => {
        const now = Date.now();
        return issueEvaluationToken(SECRET, {
          sessionId: "route-session-1",
          questionId: "moon-new-phase-transfer",
          questionVersion: "moon-transfer-v1",
          optionIds: ["toward-sun", "away-from-sun", "above-pole"],
          correctOptionId: "toward-sun",
          rationale: "The Moon is illuminated by the Sun.",
          source: "deterministic-question-bank",
          issuedAt: now - 40 * 60 * 1_000,
          expiresAt: now - 10 * 60 * 1_000,
        });
      },
    ],
  ])("returns one safe code for a %s evaluation", async (_label, createId) => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const response = await POST(request(body(createId())));
    const json = (await response.json()) as {
      error: { code: string; message: string; retryable: boolean };
    };

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error.code).toBe("INVALID_EVALUATION");
    expect(json.error.message).toBe("The evaluation could not be verified.");
  });

  it("keeps missing and non-string evaluation IDs as invalid requests", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const withoutId = body(issue());
    delete withoutId.evaluationId;
    const missingResponse = await POST(request(withoutId));
    const nonStringResponse = await POST(
      request({ ...body(issue()), evaluationId: 42 }),
    );

    expect(missingResponse.status).toBe(400);
    expect(((await missingResponse.json()) as { error: { code: string } }).error.code).toBe(
      "INVALID_REQUEST",
    );
    expect(
      ((await nonStringResponse.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
  });

  it("rejects unknown fields and non-JSON content safely", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const unknownResponse = await POST(
      request({ ...body(issue()), unexpected: true }),
    );
    const contentTypeResponse = await POST(
      request(body(issue()), "text/plain"),
    );

    expect(
      ((await unknownResponse.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
    expect(
      ((await contentTypeResponse.json()) as { error: { code: string } }).error.code,
    ).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});
