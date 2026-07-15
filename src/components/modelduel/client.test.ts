import { describe, expect, it, vi } from "vitest";

import { MOON_HERO_SAMPLE } from "@/lib/modelduel";

import {
  ModelDuelApiError,
  buildTransferRequest,
  evaluateTransfer,
  loadVerifiedDemo,
  parseDemoEnvelope,
  submitRevision,
} from "./client";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("verified demo adapter", () => {
  it("strictly parses the server-authored analysis envelope", () => {
    const parsed = parseDemoEnvelope({
      source: "verified-sample",
      notice: "Authored sample; not live AI analysis.",
      analysis: MOON_HERO_SAMPLE,
    });

    expect(parsed.source).toBe("server-verified-sample");
    expect(parsed.analysis.metadata.analyzedSubmission).toBe(false);
  });

  it("rejects malformed or over-posted envelopes", () => {
    expect(() =>
      parseDemoEnvelope({
        source: "verified-sample",
        notice: "Authored sample.",
        analysis: MOON_HERO_SAMPLE,
        answerKey: "toward-sun",
      }),
    ).toThrow(ModelDuelApiError);
  });

  it("requests the Moon demo with a no-store query contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "verified-sample",
        notice: "Authored sample; not live AI analysis.",
        analysis: MOON_HERO_SAMPLE,
      }),
    );

    await loadVerifiedDemo("session-abc", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/demo?sessionId=session-abc&scenarioId=moon-phases",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("surfaces demo failure instead of synthesizing a client-side analysis", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "The authored challenge is temporarily unavailable.",
            retryable: true,
          },
        },
        503,
      ),
    );

    await expect(loadVerifiedDemo("session-abc", fetchMock)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: true,
    });
  });
});

describe("revision adapter", () => {
  it("accepts only correlated, explicitly authored rubric feedback", async () => {
    const request = {
      requestId: "revision-request",
      idempotencyKey: "revision-key",
      requestedAt: 100,
      sessionId: "session-abc",
      scenarioId: "moon-phases" as const,
      caseFingerprint: "case-v1|moon-phases|id=moon-first-quarter-at-sunset",
      revisionText:
        "The phase appears because sunlight illuminates half and our viewing angle changes.",
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        requestId: request.requestId,
        evaluatedAt: 101,
        source: "deterministic-authored-rubric",
        notice: "Authored deterministic rubric; not AI grading.",
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "The revision connects the observed geometry to illumination.",
          strengths: ["Uses causal language"],
          nextStep: "Test the model on a new Moon case.",
        },
      }),
    );

    const result = await submitRevision(request, fetchMock);

    expect(result.feedback.conceptualChange).toBe("revised");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/revision",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
  });

  it("rejects feedback correlated to a different request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        requestId: "different-request",
        evaluatedAt: 101,
        source: "deterministic-authored-rubric",
        notice: "Not AI grading.",
        feedback: {
          conceptualChange: "partial",
          score: 0.5,
          summary: "Partial revision.",
          strengths: [],
          nextStep: "Connect the observation to a cause.",
        },
      }),
    );

    await expect(
      submitRevision(
        {
          requestId: "revision-request",
          idempotencyKey: "revision-key",
          requestedAt: 100,
          sessionId: "session-abc",
          scenarioId: "moon-phases",
          caseFingerprint: "case-fingerprint",
          revisionText: "A long revision because the observation changed the causal explanation.",
        },
        fetchMock,
      ),
    ).rejects.toThrow("did not match");
  });
});

describe("transfer adapter", () => {
  const transferRequest = buildTransferRequest({
    requestId: "transfer-request",
    idempotencyKey: "transfer-key",
    requestedAt: 200,
    sessionId: "session-abc",
    question: MOON_HERO_SAMPLE.transferQuestion,
    selectedOptionId: "toward-sun",
  });

  it("builds a request with the opaque evaluation identity intact", () => {
    expect(transferRequest).toEqual({
      requestId: "transfer-request",
      idempotencyKey: "transfer-key",
      requestedAt: 200,
      evaluationId: MOON_HERO_SAMPLE.transferQuestion.evaluationId,
      sessionId: "session-abc",
      questionId: "moon-new-phase-transfer",
      questionVersion: "moon-transfer-v1",
      selectedOptionId: "toward-sun",
    });
  });

  it("accepts only a result matching the locked question and selection", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        receiptId: "receipt-valid",
        evaluationId: transferRequest.evaluationId,
        questionId: transferRequest.questionId,
        questionVersion: transferRequest.questionVersion,
        selectedOptionId: transferRequest.selectedOptionId,
        isCorrect: true,
        score: 1,
        rationale: "The lit half faces away from Earth when the Moon is toward the Sun.",
        evaluatedAt: 201,
        source: "deterministic-question-bank",
      }),
    );

    await expect(evaluateTransfer(transferRequest, fetchMock)).resolves.toMatchObject({
      isCorrect: true,
      receiptId: "receipt-valid",
    });
  });

  it("surfaces structured server failure without inferring a result", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "INVALID_EVALUATION",
            message: "The evaluation token could not be verified.",
            retryable: false,
          },
        },
        400,
      ),
    );

    await expect(evaluateTransfer(transferRequest, fetchMock)).rejects.toMatchObject({
      code: "INVALID_EVALUATION",
      retryable: false,
    });
  });
});
