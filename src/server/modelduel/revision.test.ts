import { describe, expect, it } from "vitest";

import { createCaseFingerprint } from "../../lib/modelduel/simulation";
import { MOON_HERO_SAMPLE } from "../../lib/modelduel/samples";
import {
  evaluateRevisionRequest,
  RevisionEvaluationRequestSchema,
  RevisionEvaluationResponseSchema,
  RevisionServiceError,
} from "./revision";

const NOW = 1_800_000_000_000;
const VALID_REQUEST = {
  mode: "verified-sample" as const,
  requestId: "revision-request-1",
  idempotencyKey: "revision-idempotency-1",
  requestedAt: NOW,
  sessionId: "revision-session-1",
  scenarioId: "moon-phases" as const,
  caseFingerprint: createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
  revisionText:
    "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.",
};

async function expectInvalid(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(RevisionServiceError);
    expect((error as RevisionServiceError).code).toBe("INVALID_REQUEST");
    return;
  }
  throw new Error("Expected INVALID_REQUEST");
}

describe("verified revision service", () => {
  it("returns a strict, truthfully labeled deterministic response", async () => {
    const response = await evaluateRevisionRequest(VALID_REQUEST, NOW);

    expect(RevisionEvaluationResponseSchema.parse(response)).toEqual(response);
    expect(response).toMatchObject({
      requestId: VALID_REQUEST.requestId,
      evaluatedAt: NOW,
      source: "deterministic-authored-rubric",
      notice:
        "This feedback uses an authored deterministic rubric, not AI grading.",
    });
    expect(response.feedback.conceptualChange).toBe("revised");
  });

  it("rejects a case fingerprint that does not match the sample", async () => {
    await expectInvalid(() =>
      evaluateRevisionRequest(
        { ...VALID_REQUEST, caseFingerprint: "case-wrong" },
        NOW,
      ),
    );
  });

  it("rejects unknown request fields", () => {
    expect(
      RevisionEvaluationRequestSchema.safeParse({
        ...VALID_REQUEST,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("rejects request timestamps more than five minutes in the future", async () => {
    await expectInvalid(() =>
      evaluateRevisionRequest(
        { ...VALID_REQUEST, requestedAt: NOW + 5 * 60 * 1_000 + 1 },
        NOW,
      ),
    );
  });

  it("accepts a client clock two minutes ahead with a monotonic timestamp", async () => {
    const requestedAt = NOW + 2 * 60 * 1_000;
    const response = await evaluateRevisionRequest(
      { ...VALID_REQUEST, requestedAt },
      NOW,
    );

    expect(response.evaluatedAt).toBe(requestedAt);
  });

  it("produces deterministic feedback for an idempotent replay", async () => {
    const first = await evaluateRevisionRequest(VALID_REQUEST, NOW);
    const second = await evaluateRevisionRequest(VALID_REQUEST, NOW + 1_000);
    expect(second.feedback).toEqual(first.feedback);
  });
});
