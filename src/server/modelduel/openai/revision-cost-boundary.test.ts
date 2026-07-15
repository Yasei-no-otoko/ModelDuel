import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { evaluateRevisionRequest } from "../revision";
import { issueEvaluationToken } from "../evaluation-core";
import { ModelDuelUpstreamError } from "./errors";
import type { ModelDuelGateway } from "./gateway";

const NOW = 1_800_000_000_000;
const SECRET = "live-revision-token-test-secret-long-enough";

function liveRequest(
  input: {
    sessionId?: string;
    issuedAt?: number;
    expiresAt?: number;
    includeRevisionContext?: boolean;
  } = {},
) {
  const sessionId = input.sessionId ?? "live-revision-session";
  const evaluationId = issueEvaluationToken(SECRET, {
    sessionId,
    questionId: MOON_HERO_SAMPLE.transferQuestion.questionId,
    questionVersion: MOON_HERO_SAMPLE.transferQuestion.version,
    optionIds: MOON_HERO_SAMPLE.transferQuestion.options.map(
      (option) => option.id,
    ),
    correctOptionId: "toward-sun",
    rationale: "Private test rationale.",
    source: "deterministic-question-bank",
    issuedAt: input.issuedAt ?? NOW,
    expiresAt: input.expiresAt ?? NOW + 20 * 60 * 1_000,
    revisionContext:
      input.includeRevisionContext === false
        ? undefined
        : {
            scenarioId: "moon-phases",
            caseId: MOON_HERO_SAMPLE.caseSpec.id,
            caseFingerprint: createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
            learnerWorldId: MOON_HERO_SAMPLE.learnerWorld.worldId,
            scientificWorldId: MOON_HERO_SAMPLE.scientificWorld.worldId,
            misconceptionType: "earth-shadow-phases",
          },
  });
  return {
    mode: "live" as const,
    requestId: "live-revision-request",
    idempotencyKey: "live-revision-idempotency",
    requestedAt: NOW,
    sessionId,
    revisionText:
      "Sunlight lights half the Moon, and our viewing angle reveals the visible part.",
    evaluationId,
  };
}

function countingGateway(counter: { calls: number }): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-sol",
    revisionModel: "gpt-5.6-terra",
    async parseLearnerModel() {
      throw new Error("Unexpected learner extraction");
    },
    async runProgramTurn() {
      throw new Error("Unexpected orchestration");
    },
    async parseRevisionFeedback() {
      counter.calls += 1;
      throw new Error("Model boundary reached");
    },
  };
}

beforeEach(() => {
  vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("live revision cost boundary", () => {
  it("invokes the limiter exactly once after a valid signed context", async () => {
    const counter = { calls: 0 };
    const beforeLiveGateway = vi.fn();

    await expect(
      evaluateRevisionRequest(liveRequest(), NOW, {
        gateway: countingGateway(counter),
        signal: AbortSignal.timeout(10_000),
        beforeLiveGateway,
      }),
    ).rejects.toThrow("Model boundary reached");
    expect(beforeLiveGateway).toHaveBeenCalledTimes(1);
    expect(counter.calls).toBe(1);
  });

  it("does not charge a second time when live grading enters repair", async () => {
    const counter = { calls: 0 };
    const beforeLiveGateway = vi.fn();
    const gateway: ModelDuelGateway = {
      ...countingGateway(counter),
      async parseRevisionFeedback() {
        counter.calls += 1;
        if (counter.calls === 1) {
          return {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: null,
            outputText: "schema-invalid first output",
          };
        }
        throw new Error("Repair boundary reached");
      },
    };

    await expect(
      evaluateRevisionRequest(liveRequest(), NOW, {
        gateway,
        signal: AbortSignal.timeout(10_000),
        beforeLiveGateway,
      }),
    ).rejects.toThrow("Repair boundary reached");
    expect(beforeLiveGateway).toHaveBeenCalledTimes(1);
    expect(counter.calls).toBe(2);
  });

  it("does not invoke the limiter for invalid or unusable live tokens", async () => {
    const valid = liveRequest();
    const tamperIndex = valid.evaluationId.indexOf(".") + 1;
    const replacement =
      valid.evaluationId[tamperIndex] === "A" ? "B" : "A";
    const cases = [
      { ...valid, evaluationId: "v1.invalid" },
      {
        ...valid,
        evaluationId: `${valid.evaluationId.slice(
          0,
          tamperIndex,
        )}${replacement}${valid.evaluationId.slice(tamperIndex + 1)}`,
      },
      { ...valid, sessionId: "different-session" },
      liveRequest({
        issuedAt: NOW - 20 * 60 * 1_000,
        expiresAt: NOW - 60_001,
      }),
      liveRequest({ includeRevisionContext: false }),
    ];

    for (const request of cases) {
      const counter = { calls: 0 };
      const beforeLiveGateway = vi.fn();
      await expect(
        evaluateRevisionRequest(request, NOW, {
          gateway: countingGateway(counter),
          signal: AbortSignal.timeout(10_000),
          beforeLiveGateway,
        }),
      ).rejects.toBeTruthy();
      expect(beforeLiveGateway).not.toHaveBeenCalled();
      expect(counter.calls).toBe(0);
    }
  });

  it("stops before the model when the limiter denies a valid token", async () => {
    const counter = { calls: 0 };
    const beforeLiveGateway = vi.fn(() => {
      throw new ModelDuelUpstreamError("RATE_LIMITED");
    });

    await expect(
      evaluateRevisionRequest(liveRequest(), NOW, {
        gateway: countingGateway(counter),
        signal: AbortSignal.timeout(10_000),
        beforeLiveGateway,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(beforeLiveGateway).toHaveBeenCalledTimes(1);
    expect(counter.calls).toBe(0);
  });
});
