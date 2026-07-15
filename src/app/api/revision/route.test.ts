import { describe, expect, it } from "vitest";

import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import { POST } from "./route";

function validBody(now = Date.now()): Record<string, unknown> {
  return {
    mode: "verified-sample",
    requestId: "revision-route-request-1",
    idempotencyKey: "revision-route-idempotency-1",
    requestedAt: now,
    sessionId: "revision-route-session-1",
    scenarioId: "moon-phases",
    caseFingerprint: createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
    revisionText:
      "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.",
  };
}

function request(payload: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/revision", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/revision", () => {
  it("returns strict authored feedback with no-store", async () => {
    const response = await POST(request(validBody()));
    const json = (await response.json()) as {
      source: string;
      notice: string;
      feedback: { conceptualChange: string; score: number };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.source).toBe("deterministic-authored-rubric");
    expect(json.notice).toBe(
      "This feedback uses an authored deterministic rubric, not AI grading.",
    );
    expect(json.feedback).toMatchObject({ conceptualChange: "revised", score: 1 });
  });

  it("rejects fingerprint mismatch with a safe invalid-request response", async () => {
    const response = await POST(
      request({ ...validBody(), caseFingerprint: "case-wrong" }),
    );
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error.code).toBe("INVALID_REQUEST");
  });

  it("rejects unknown fields", async () => {
    const response = await POST(
      request({ ...validBody(), unexpected: "not-allowed" }),
    );
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
  });

  it("rejects timestamps more than five minutes in the future", async () => {
    const response = await POST(
      request(validBody(Date.now() + 5 * 60 * 1_000 + 2_000)),
    );
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
  });

  it("requires application/json", async () => {
    const response = await POST(request(validBody(), "text/plain"));
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});
