import { describe, expect, it, vi } from "vitest";

import { MOON_HERO_SAMPLE, SEASONS_SAMPLE } from "@/lib/modelduel";

import {
  ModelDuelApiError,
  analyzeSubmission,
  buildTransferRequest,
  evaluateTransfer,
  fileToAnalyzeSketch,
  loadVerifiedDemo,
  parseDemoEnvelope,
  parseLiveAnalysisEnvelope,
  submitRevision,
} from "./client";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const LIVE_MOON_ANALYSIS = {
  ...MOON_HERO_SAMPLE,
  metadata: {
    mode: "live" as const,
    modelId: "gpt-5.6-terra" as const,
    analyzedSubmission: true,
    orchestrationToolNames: [
      "validate_world_spec",
      "simulate_world",
      "compare_predictions",
      "select_discriminating_case",
    ] as const,
  },
};

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
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "verified-sample",
        notice: "Authored sample; not live AI analysis.",
        analysis: MOON_HERO_SAMPLE,
      }),
    );

    await loadVerifiedDemo(
      "session-abc",
      "moon-phases",
      fetchMock,
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/demo?sessionId=session-abc&scenarioId=moon-phases",
      expect.objectContaining({ cache: "no-store", signal: controller.signal }),
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

    await expect(
      loadVerifiedDemo("session-abc", "moon-phases", fetchMock),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      retryable: true,
    });
  });
});

describe("Seasons verified demo adapter", () => {
  it("requests and correlates the Seasons demo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "verified-sample",
        notice: "Authored sample.",
        analysis: SEASONS_SAMPLE,
      }),
    );

    await loadVerifiedDemo("session-seasons", "seasons", fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/demo?sessionId=session-seasons&scenarioId=seasons",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejects a verified response for another scenario", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "verified-sample",
        notice: "Authored sample.",
        analysis: MOON_HERO_SAMPLE,
      }),
    );

    await expect(
      loadVerifiedDemo("session-seasons", "seasons", fetchMock),
    ).rejects.toThrow("did not match");
  });
});

describe("live analysis adapter", () => {
  const request = {
    schemaVersion: "1.0" as const,
    requestId: "analysis-request",
    sessionId: "session-abc",
    requestedAt: 50,
    scenarioId: "moon-phases" as const,
    liveUseAttestation: true as const,
    explanation: "Earth's shadow moves across the Moon and causes each phase.",
    sketch: null,
  };

  it("posts the exact request with no-store and correlates the live response", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "live",
        notice: "Analyzed with GPT-5.6 using validated orchestration.",
        requestId: request.requestId,
        analysis: LIVE_MOON_ANALYSIS,
      }),
    );

    const result = await analyzeSubmission(request, fetchMock, controller.signal);

    expect(result.source).toBe("live");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(request),
        signal: controller.signal,
      }),
    );
  });

  it("rejects a live envelope correlated to another request", () => {
    expect(() =>
      parseLiveAnalysisEnvelope(
        {
          source: "live",
          notice: "Live analysis.",
          requestId: "other-request",
          analysis: LIVE_MOON_ANALYSIS,
        },
        request.requestId,
      ),
    ).toThrow("did not match");
  });

  it("does not accept a verified analysis mislabeled as live", () => {
    expect(() =>
      parseLiveAnalysisEnvelope(
        {
          source: "live",
          notice: "Incorrect source wrapper.",
          requestId: request.requestId,
          analysis: MOON_HERO_SAMPLE,
        },
        request.requestId,
      ),
    ).toThrow(ModelDuelApiError);
  });

  it.each([
    {
      label: "omitted",
      tools: [
        "validate_world_spec",
        "simulate_world",
        "compare_predictions",
      ],
    },
    {
      label: "duplicate",
      tools: [
        "validate_world_spec",
        "validate_world_spec",
        "simulate_world",
        "compare_predictions",
      ],
    },
    {
      label: "wrong",
      tools: [
        "validate_world_spec",
        "simulate_world",
        "compare_predictions",
        "generate_transfer_question",
      ],
    },
    {
      label: "extra",
      tools: [
        "validate_world_spec",
        "simulate_world",
        "compare_predictions",
        "select_discriminating_case",
        "generate_transfer_question",
      ],
    },
  ])("rejects a $label live orchestration ledger", ({ tools }) => {
    expect(() =>
      parseLiveAnalysisEnvelope(
        {
          source: "live",
          notice: "Live analysis.",
          requestId: request.requestId,
          analysis: {
            ...LIVE_MOON_ANALYSIS,
            metadata: {
              ...LIVE_MOON_ANALYSIS.metadata,
              orchestrationToolNames: tools,
            },
          },
        },
        request.requestId,
      ),
    ).toThrow("did not match");
  });

  it("preserves the expanded safe error taxonomy", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "CONFIGURATION_REQUIRED",
            message: "Live analysis is not configured.",
            retryable: false,
          },
        },
        503,
      ),
    );

    await expect(analyzeSubmission(request, fetchMock)).rejects.toMatchObject({
      code: "CONFIGURATION_REQUIRED",
      retryable: false,
    });
  });

  it("preserves a non-retryable unsupported misconception envelope", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "UNSUPPORTED_MISCONCEPTION",
            message:
              "This pilot could not map the explanation to the selected validated misconception contrast.",
            retryable: false,
          },
        },
        422,
      ),
    );

    await expect(analyzeSubmission(request, fetchMock)).rejects.toMatchObject({
      code: "UNSUPPORTED_MISCONCEPTION",
      retryable: false,
    });
  });

  it("propagates transport abort without synthesizing an analysis result", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    );

    const pending = analyzeSubmission(request, fetchMock, controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it.each([
    "PAYLOAD_TOO_LARGE",
    "UNSUPPORTED_MEDIA_TYPE",
    "MODEL_REFUSAL",
    "REVISION_IN_PROGRESS",
    "RATE_LIMITED",
    "UNSUPPORTED_MISCONCEPTION",
    "MODEL_OUTPUT_INVALID",
    "UPSTREAM_INCOMPLETE",
    "ORCHESTRATION_INVALID",
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_AUTHENTICATION",
    "MODEL_ACCESS_REQUIRED",
    "REQUEST_TIMEOUT",
    "UPSTREAM_TIMEOUT",
  ] as const)("preserves the %s safe error code", async (code) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code,
            message: "Safe upstream failure.",
            retryable: true,
          },
        },
        502,
      ),
    );

    await expect(analyzeSubmission(request, fetchMock)).rejects.toMatchObject({
      code,
    });
  });

  it("encodes a validated local image as a canonical base64 data URL", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    await expect(
      fileToAnalyzeSketch({
        type: "image/png",
        size: bytes.byteLength,
        arrayBuffer: async () => bytes.buffer,
      }),
    ).resolves.toEqual({
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,AQID",
    });
  });

  it("rejects invalid media and inconsistent reads before generating a data URL", async () => {
    await expect(
      fileToAnalyzeSketch({
        type: "image/gif",
        size: 3,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });

    await expect(
      fileToAnalyzeSketch({
        type: "image/webp",
        size: 4,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      }),
    ).rejects.toThrow("read safely");
  });
});

describe("revision adapter", () => {
  it("accepts only correlated, explicitly authored rubric feedback", async () => {
    const controller = new AbortController();
    const request = {
      mode: "verified-sample" as const,
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

    const result = await submitRevision(request, fetchMock, controller.signal);

    expect(result.feedback.conceptualChange).toBe("revised");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/revision",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
      }),
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
          mode: "verified-sample",
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

  it("sends live revision context and accepts only GPT-5.6 source metadata", async () => {
    const request = {
      mode: "live" as const,
      requestId: "revision-live-request",
      idempotencyKey: "revision-live-key",
      requestedAt: 110,
      sessionId: "session-live",
      liveUseAttestation: true as const,
      revisionText:
        "The Moon appears half lit because sunlight and our viewing angle determine the phase.",
      evaluationId: LIVE_MOON_ANALYSIS.transferQuestion.evaluationId,
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "gpt-5.6",
        notice: "Structured live revision feedback.",
        requestId: request.requestId,
        modelId: "gpt-5.6-luna",
        evaluatedAt: 111,
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "The revision uses the observed evidence causally.",
          strengths: ["Connects illumination and viewpoint"],
          nextStep: "Apply the model to the transfer case.",
        },
      }),
    );

    const result = await submitRevision(request, fetchMock);

    expect(result).toMatchObject({ source: "gpt-5.6", modelId: "gpt-5.6-luna" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/revision",
      expect.objectContaining({ body: JSON.stringify(request), cache: "no-store" }),
    );
  });

  it("rejects GPT-5.6 feedback for a verified-sample revision request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "gpt-5.6",
        notice: "Mismatched live feedback.",
        requestId: "revision-verified-request",
        modelId: "gpt-5.6-luna",
        evaluatedAt: 121,
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "This response has the wrong provenance.",
          strengths: [],
          nextStep: "Do not accept this response.",
        },
      }),
    );

    await expect(
      submitRevision(
        {
          mode: "verified-sample",
          requestId: "revision-verified-request",
          idempotencyKey: "revision-verified-key",
          requestedAt: 120,
          sessionId: "session-verified",
          scenarioId: "moon-phases",
          caseFingerprint: "case-fingerprint",
          revisionText:
            "The Moon appears half lit because sunlight and viewpoint determine the phase.",
        },
        fetchMock,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects deterministic feedback for a live revision request", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        source: "deterministic-authored-rubric",
        notice: "Mismatched authored feedback.",
        requestId: "revision-live-request",
        evaluatedAt: 131,
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "This response has the wrong provenance.",
          strengths: [],
          nextStep: "Do not accept this response.",
        },
      }),
    );

    await expect(
      submitRevision(
        {
          mode: "live",
          requestId: "revision-live-request",
          idempotencyKey: "revision-live-key",
          requestedAt: 130,
          sessionId: "session-live",
          liveUseAttestation: true,
          revisionText:
            "The Moon appears half lit because sunlight and viewpoint determine the phase.",
          evaluationId: LIVE_MOON_ANALYSIS.transferQuestion.evaluationId,
        },
        fetchMock,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("does not synthesize authored feedback when live revision fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "MODEL_OUTPUT_INVALID",
            message: "The model response could not be validated.",
            retryable: true,
          },
        },
        502,
      ),
    );

    await expect(
      submitRevision(
        {
          mode: "live",
          requestId: "revision-live-request",
          idempotencyKey: "revision-live-key",
          requestedAt: 110,
          sessionId: "session-live",
          liveUseAttestation: true,
          revisionText:
            "The Moon appears half lit because sunlight and viewpoint determine the phase.",
          evaluationId: LIVE_MOON_ANALYSIS.transferQuestion.evaluationId,
        },
        fetchMock,
      ),
    ).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
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
    const controller = new AbortController();
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

    await expect(
      evaluateTransfer(transferRequest, fetchMock, controller.signal),
    ).resolves.toMatchObject({
      isCorrect: true,
      receiptId: "receipt-valid",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transfer",
      expect.objectContaining({ signal: controller.signal }),
    );
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
