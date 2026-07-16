import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../../lib/modelduel/samples";
import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { evaluateRevisionRequest } from "../revision";
import { issueEvaluationToken } from "../evaluation-core";
import type {
  ModelDuelGateway,
  RevisionParseRequest,
} from "./gateway";
import type { RevisionFeedbackExtraction } from "./contracts";

const NOW = 1_800_000_000_000;
const SECRET = "live-revision-token-test-secret-long-enough";
const FEEDBACK: RevisionFeedbackExtraction = {
  schemaVersion: "1.0",
  feedback: {
    conceptualChange: "revised",
    score: 1,
    summary: "The explanation now uses illumination and viewing geometry.",
    strengths: ["Connects the evidence to a causal model."],
    nextStep: "Apply the model to first quarter.",
  },
};
function liveRequest(input: {
  sessionId?: string;
  issuedAt?: number;
  expiresAt?: number;
  includeRevisionContext?: boolean;
} = {}) {
  const sessionId = input.sessionId ?? "live-revision-session";
  const evaluationId = issueEvaluationToken(SECRET, {
    sessionId,
    questionId: MOON_HERO_SAMPLE.transferQuestion.questionId,
    questionVersion: MOON_HERO_SAMPLE.transferQuestion.version,
    optionIds: MOON_HERO_SAMPLE.transferQuestion.options.map((option) => option.id),
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

function seasonsLiveRequest() {
  const sessionId = "seasons-live-revision-session";
  const evaluationId = issueEvaluationToken(SECRET, {
    sessionId,
    questionId: SEASONS_SAMPLE.transferQuestion.questionId,
    questionVersion: SEASONS_SAMPLE.transferQuestion.version,
    optionIds: SEASONS_SAMPLE.transferQuestion.options.map(
      (option) => option.id,
    ),
    correctOptionId: "reverse",
    rationale: "Private Seasons test rationale.",
    source: "deterministic-question-bank",
    issuedAt: NOW,
    expiresAt: NOW + 20 * 60 * 1_000,
    revisionContext: {
      scenarioId: "seasons",
      caseId: SEASONS_SAMPLE.caseSpec.id,
      caseFingerprint: createCaseFingerprint(SEASONS_SAMPLE.caseSpec),
      learnerWorldId: SEASONS_SAMPLE.learnerWorld.worldId,
      scientificWorldId: SEASONS_SAMPLE.scientificWorld.worldId,
      misconceptionType: "distance-causes-seasons",
    },
  });
  return {
    mode: "live" as const,
    requestId: "seasons-live-revision-request",
    idempotencyKey: "seasons-live-revision-idempotency",
    requestedAt: NOW,
    sessionId,
    revisionText:
      "Earth's axial tilt changes the sunlight angle, so the Northern and Southern Hemispheres have opposite seasons rather than distance causing them.",
    evaluationId,
  };
}

function gatewayWithRevisionAttempts(
  attempts: Array<{
    status: string;
    hasError: boolean;
    hasRefusal: boolean;
    parsed: RevisionFeedbackExtraction | null;
    outputText: string;
  }>,
  requests: RevisionParseRequest[],
): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-terra",
    revisionModel: "gpt-5.6-luna",
    async parseLearnerModel() {
      throw new Error("Unexpected learner extraction");
    },
    async runProgramTurn() {
      throw new Error("Unexpected orchestration");
    },
    async parseRevisionFeedback(request) {
      requests.push(request);
      const attempt = attempts.shift();
      if (!attempt) {
        throw new Error("Unexpected revision attempt");
      }
      return attempt;
    },
  };
}

describe("live revision service", () => {
  beforeEach(() => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("authenticates the signed Seasons revision context before the live call", async () => {
    const requests: RevisionParseRequest[] = [];
    const request = seasonsLiveRequest();
    const response = await evaluateRevisionRequest(request, NOW, {
      gateway: gatewayWithRevisionAttempts(
        [
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: FEEDBACK,
            outputText: "",
          },
        ],
        requests,
      ),
      signal: AbortSignal.timeout(10_000),
    });

    expect(response).toMatchObject({
      source: "gpt-5.6",
      requestId: request.requestId,
      modelId: "gpt-5.6-luna",
      evaluatedAt: NOW,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      scenarioId: "seasons",
      misconceptionType: "distance-causes-seasons",
    });
    expect(requests[0]?.rubric.toLowerCase()).toContain("axial tilt");
    expect(requests[0]?.observations).toContain(
      createCaseFingerprint(SEASONS_SAMPLE.caseSpec),
    );
  });

  it("returns strict correlated live feedback", async () => {
    const requests: RevisionParseRequest[] = [];
    const request = liveRequest();
    const response = await evaluateRevisionRequest(request, NOW, {
      gateway: gatewayWithRevisionAttempts(
        [
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: FEEDBACK,
            outputText: "",
          },
        ],
        requests,
      ),
      signal: AbortSignal.timeout(10_000),
    });

    expect(response).toMatchObject({
      source: "gpt-5.6",
      notice: "Revision feedback generated live with GPT-5.6.",
      requestId: request.requestId,
      modelId: "gpt-5.6-luna",
      evaluatedAt: NOW,
      feedback: FEEDBACK.feedback,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.idempotencyKey).toBe(
      `${request.idempotencyKey}-revision-1`,
    );
    expect(requests[0]?.observations).toContain(
      createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
    );
  });

  it("repairs schema-invalid feedback once", async () => {
    const requests: RevisionParseRequest[] = [];
    const response = await evaluateRevisionRequest(liveRequest(), NOW, {
      gateway: gatewayWithRevisionAttempts(
        [
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: null,
            outputText: "invalid feedback",
          },
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: FEEDBACK,
            outputText: "",
          },
        ],
        requests,
      ),
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.feedback).toEqual(FEEDBACK.feedback);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.repair).toBe(true);
  });

  it("does not downgrade refusal to deterministic feedback", async () => {
    await expect(
      evaluateRevisionRequest(liveRequest(), NOW, {
        gateway: gatewayWithRevisionAttempts(
          [
            {
              status: "completed",
              hasError: false,
              hasRefusal: true,
              parsed: null,
              outputText: "",
            },
          ],
          [],
        ),
        signal: AbortSignal.timeout(10_000),
      }),
    ).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
  });

  it("rejects a tampered signed context before grading", async () => {
    const request = liveRequest();
    const segments = request.evaluationId.split(".");
    const ciphertext = segments[2] ?? "";
    segments[2] = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    await expect(
      evaluateRevisionRequest(
        { ...request, evaluationId: segments.join(".") },
        NOW,
        {
          gateway: gatewayWithRevisionAttempts([], []),
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects session mismatch, expiry, and verified-only tokens", async () => {
    const gateway = gatewayWithRevisionAttempts([], []);
    await expect(
      evaluateRevisionRequest(
        { ...liveRequest(), sessionId: "different-session" },
        NOW,
        { gateway, signal: AbortSignal.timeout(10_000) },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await expect(
      evaluateRevisionRequest(
        liveRequest({
          issuedAt: NOW - 40 * 60 * 1_000,
          expiresAt: NOW - 10 * 60 * 1_000,
        }),
        NOW,
        { gateway, signal: AbortSignal.timeout(10_000) },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await expect(
      evaluateRevisionRequest(
        liveRequest({ includeRevisionContext: false }),
        NOW,
        { gateway, signal: AbortSignal.timeout(10_000) },
      ),
    ).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});
