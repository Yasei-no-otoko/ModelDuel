import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  AnalysisResultSchema,
  EvaluationIdSchema,
} from "../../lib/modelduel/schemas";
import { MOON_HERO_SAMPLE } from "../../lib/modelduel/samples";
import {
  EvaluationCoreError,
  evaluateEvaluationToken,
  issueEvaluationToken,
} from "./evaluation-core";

const SECRET = "modelduel-test-secret-that-is-long-enough";
const OTHER_SECRET = "different-test-secret-that-is-long-enough";
const NOW = 1_800_000_000_000;
const SESSION_ID = "session-test-1";

const ISSUE_INPUT = {
  sessionId: SESSION_ID,
  questionId: "moon-new-phase-transfer",
  questionVersion: "moon-transfer-v1",
  optionIds: ["toward-sun", "away-from-sun", "above-pole"],
  correctOptionId: "toward-sun",
  rationale:
    "At new Moon, the illuminated half faces mostly away from an observer on Earth.",
  source: "deterministic-question-bank" as const,
  issuedAt: NOW,
  expiresAt: NOW + 20 * 60 * 1_000,
};

function issue(
  overrides: Partial<typeof ISSUE_INPUT> = {},
  secret = SECRET,
): string {
  return issueEvaluationToken(secret, { ...ISSUE_INPUT, ...overrides });
}

function evaluate(
  evaluationId: string,
  overrides: Partial<Parameters<typeof evaluateEvaluationToken>[1]> = {},
  secret = SECRET,
) {
  return evaluateEvaluationToken(secret, {
    evaluationId,
    sessionId: SESSION_ID,
    questionId: ISSUE_INPUT.questionId,
    questionVersion: ISSUE_INPUT.questionVersion,
    selectedOptionId: ISSUE_INPUT.correctOptionId,
    idempotencyKey: "request-test-1",
    requestedAt: NOW + 1_000,
    now: NOW + 1_000,
    ...overrides,
  });
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(EvaluationCoreError);
    expect((error as EvaluationCoreError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

function mutateSegment(token: string, segmentIndex: 1 | 2 | 3): string {
  const segments = token.split(".");
  const bytes = Buffer.from(segments[segmentIndex]!, "base64url");
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  segments[segmentIndex] = bytes.toString("base64url");
  return segments.join(".");
}

describe("evaluation token cryptography", () => {
  it("round-trips a verified answer into a strict transfer result", () => {
    const token = issue();
    const result = evaluate(token);

    expect(result).toMatchObject({
      evaluationId: token,
      questionId: ISSUE_INPUT.questionId,
      questionVersion: ISSUE_INPUT.questionVersion,
      selectedOptionId: ISSUE_INPUT.correctOptionId,
      isCorrect: true,
      score: 1,
      rationale: ISSUE_INPUT.rationale,
      evaluatedAt: NOW + 1_000,
      source: ISSUE_INPUT.source,
    });
    expect(result.receiptId).toMatch(/^receipt-[a-f0-9]{64}$/);
  });

  it("keeps the answer and rationale opaque", () => {
    const token = issue();
    expect(token).not.toContain(ISSUE_INPUT.correctOptionId);
    expect(token).not.toContain(ISSUE_INPUT.rationale);
    expect(token).not.toContain("correctOptionId");
    expect(token).not.toContain("rationale");
  });

  it("uses a fresh nonce for each issuance", () => {
    expect(issue()).not.toBe(issue());
  });

  it.each([
    ["nonce", 1],
    ["ciphertext", 2],
    ["authentication tag", 3],
  ] as const)("rejects a modified %s", (_label, segmentIndex) => {
    const token = mutateSegment(issue(), segmentIndex);
    expectCode(() => evaluate(token), "INVALID_TOKEN");
  });

  it.each([
    "",
    "v1.only-two-segments",
    "v2.a.b.c",
    "v1.YWFh.bad+alphabet.YWFh",
    "v1.YQ==.Yg.Yw",
    "v1..Yg.Yw",
    "v1.YQ.Yg.Yw.extra",
    "x".repeat(2_049),
  ])("rejects a non-canonical envelope: %s", (token) => {
    expectCode(() => evaluate(token), "INVALID_TOKEN");
  });

  it("rejects a token encrypted under another secret", () => {
    expectCode(() => evaluate(issue(), {}, OTHER_SECRET), "INVALID_TOKEN");
  });
});

describe("evaluation identity and time validation", () => {
  it.each([
    ["session", { sessionId: "session-other" }],
    ["question", { questionId: "another-question" }],
    ["version", { questionVersion: "another-version" }],
    ["selection", { selectedOptionId: "unknown-option" }],
  ] as const)("rejects a mismatched %s", (_label, overrides) => {
    expectCode(() => evaluate(issue(), overrides), "INVALID_TOKEN");
  });

  it("rejects an expired token", () => {
    const token = issue({
      issuedAt: NOW - 40 * 60 * 1_000,
      expiresAt: NOW - 10 * 60 * 1_000,
    });
    expectCode(() => evaluate(token), "INVALID_TOKEN");
  });

  it("rejects a token that is not yet valid beyond clock skew", () => {
    const token = issue({
      issuedAt: NOW + 10 * 60 * 1_000,
      expiresAt: NOW + 20 * 60 * 1_000,
    });
    expectCode(() => evaluate(token), "INVALID_TOKEN");
  });

  it("accepts an old client clock while the token is current by server time", () => {
    const result = evaluate(issue(), {
      requestedAt: NOW - 10 * 60 * 1_000,
      now: NOW + 1_000,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.evaluatedAt).toBe(NOW + 1_000);
  });

  it("accepts a client clock two minutes ahead and preserves monotonic time", () => {
    const requestedAt = NOW + 2 * 60 * 1_000;
    const result = evaluate(issue(), {
      requestedAt,
      now: NOW + 1_000,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.evaluatedAt).toBe(requestedAt);
  });

  it("rejects a client clock more than five minutes ahead", () => {
    expectCode(
      () =>
        evaluate(issue(), {
          requestedAt: NOW + 1_000 + 5 * 60 * 1_000 + 1,
          now: NOW + 1_000,
        }),
      "INVALID_TOKEN",
    );
  });

  it("rejects a configured secret shorter than 32 characters", () => {
    expectCode(() => issueEvaluationToken("too-short", ISSUE_INPUT), "WEAK_SECRET");
  });

  it("rejects lifetimes longer than thirty minutes", () => {
    expectCode(
      () => issue({ expiresAt: NOW + 30 * 60 * 1_000 + 1 }),
      "INVALID_REQUEST",
    );
  });
});

describe("transfer grading and replay determinism", () => {
  it("returns an incorrect binary score without exposing a different answer", () => {
    const result = evaluate(issue(), { selectedOptionId: "away-from-sun" });
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0);
  });

  it("returns the same receipt for an exact idempotent replay", () => {
    const token = issue();
    expect(evaluate(token).receiptId).toBe(evaluate(token).receiptId);
  });

  it("binds a receipt to the idempotency key", () => {
    const token = issue();
    const first = evaluate(token);
    const second = evaluate(token, { idempotencyKey: "request-test-2" });
    expect(second.receiptId).not.toBe(first.receiptId);
    expect(second.isCorrect).toBe(first.isCorrect);
    expect(second.score).toBe(first.score);
  });
});

describe("public demo transport", () => {
  it("accepts a long opaque token without publishing an answer key", () => {
    const evaluationId = issue();
    const analysis = AnalysisResultSchema.parse({
      ...MOON_HERO_SAMPLE,
      transferQuestion: {
        ...MOON_HERO_SAMPLE.transferQuestion,
        evaluationId,
      },
    });
    const serialized = JSON.stringify(analysis);

    expect(EvaluationIdSchema.parse(evaluationId)).toBe(evaluationId);
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain(ISSUE_INPUT.rationale);
    expect(analysis.transferQuestion).not.toHaveProperty("correctOptionId");
  });

  it("rejects malformed evaluation identifiers at the public schema boundary", () => {
    expect(() => EvaluationIdSchema.parse("v1.bad+segment.token.tag")).toThrow();
    expect(() => EvaluationIdSchema.parse("a".repeat(2_049))).toThrow();
  });
});
