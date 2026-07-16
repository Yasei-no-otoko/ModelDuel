import type * as Responses from "openai/resources/responses/responses";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../../lib/modelduel/samples";
import { verifyLiveRevisionToken } from "../evaluation";
import { analyzeSubmission } from "./analysis";
import { ModelDuelUpstreamError } from "./errors";
import type { ModelDuelGateway } from "./gateway";
import { SketchImageError } from "./image";
import { resolveRegistryPlan } from "./registry";

const CALLER = { caller_id: "analysis-program-call", type: "program" } as const;

function call(callId: string, name: string, args: object) {
  return {
    type: "function_call",
    id: `fc-${callId}`,
    call_id: callId,
    name,
    arguments: JSON.stringify(args),
    status: "completed",
    caller: CALLER,
  } satisfies Responses.ResponseOutputItem;
}

function finalAssistantMessage() {
  return {
    id: "analysis-final-message",
    type: "message",
    role: "assistant",
    status: "completed",
    phase: "final_answer",
    content: [
      {
        type: "output_text",
        text: "The deterministic plan is verified.",
        annotations: [],
      },
    ],
  } satisfies Responses.ResponseOutputItem;
}

function successfulGateway(
  sample: typeof MOON_HERO_SAMPLE | typeof SEASONS_SAMPLE = MOON_HERO_SAMPLE,
): ModelDuelGateway {
  let turn = 0;
  const plan = resolveRegistryPlan({
    scenarioId: sample.scenarioId,
    learnerModel: sample.learnerModel,
  });
  const worldArgs = {
    learnerWorldId: plan.learnerWorldId,
    scientificWorldId: plan.scientificWorldId,
  };
  const simulationArgs = { ...worldArgs, caseId: plan.caseId };
  return {
    analysisModel: "gpt-5.6-terra",
    revisionModel: "gpt-5.6-luna",
    async parseLearnerModel() {
      return {
        status: "completed",
        hasError: false,
        hasRefusal: false,
        parsed: {
          schemaVersion: "1.0",
          learnerModel: sample.learnerModel,
        },
        outputText: "",
      };
    },
    async runProgramTurn() {
      turn += 1;
      return {
        status: "completed",
        hasError: false,
        hasRefusal: false,
        output:
          turn === 1
            ? [
                {
                  id: "analysis-program",
                  call_id: "analysis-program-call",
                  code: "verify_registry_plan()",
                  fingerprint: "analysis-program-fingerprint",
                  type: "program",
                } satisfies Responses.ResponseOutputItem,
                call("validate", "validate_world_spec", worldArgs),
                call("simulate", "simulate_world", simulationArgs),
                call("compare", "compare_predictions", simulationArgs),
                call("select", "select_discriminating_case", {
                  ...simulationArgs,
                  comparisonId: `comparison-${plan.caseId}`,
                }),
              ]
            : [finalAssistantMessage()],
        responseBytes: 2_048,
      };
    },
    async parseRevisionFeedback() {
      throw new Error("Unexpected revision call");
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("live analysis service", () => {
  it("fails before any model call when the evaluation secret is invalid", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", "weak");
    let modelCalls = 0;
    const beforeModelCall = vi.fn();
    const gateway: ModelDuelGateway = {
      analysisModel: "gpt-5.6-terra",
      revisionModel: "gpt-5.6-luna",
      async parseLearnerModel() {
        modelCalls += 1;
        throw new Error("Must not be called");
      },
      async runProgramTurn() {
        modelCalls += 1;
        throw new Error("Must not be called");
      },
      async parseRevisionFeedback() {
        modelCalls += 1;
        throw new Error("Must not be called");
      },
    };
    await expect(
      analyzeSubmission(
        {
          schemaVersion: "1.0",
          requestId: "analysis-preflight-request",
          sessionId: "analysis-preflight-session",
          requestedAt: 1_800_000_000_000,
          scenarioId: "moon-phases",
          explanation: "Earth's shadow causes phases.",
          sketch: null,
        },
        {
          gateway,
          signal: AbortSignal.timeout(10_000),
          now: 1_800_000_000_000,
          beforeModelCall,
        },
      ),
    ).rejects.toMatchObject({ code: "SERVER_CONFIGURATION" });
    expect(modelCalls).toBe(0);
    expect(beforeModelCall).not.toHaveBeenCalled();
  });

  it("does not charge a schema-valid sketch with mismatched magic bytes", async () => {
    vi.stubEnv(
      "MODELDUEL_EVALUATION_SECRET",
      "analysis-test-evaluation-secret-long-enough",
    );
    const beforeModelCall = vi.fn();

    await expect(
      analyzeSubmission(
        {
          schemaVersion: "1.0",
          requestId: "analysis-invalid-image-request",
          sessionId: "analysis-invalid-image-session",
          requestedAt: 1_800_000_000_000,
          scenarioId: "moon-phases",
          explanation: "Earth's shadow causes phases.",
          sketch: {
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,/9j/4A==",
          },
        },
        {
          gateway: successfulGateway(),
          signal: AbortSignal.timeout(10_000),
          now: 1_800_000_000_000,
          beforeModelCall,
        },
      ),
    ).rejects.toBeInstanceOf(SketchImageError);
    expect(beforeModelCall).not.toHaveBeenCalled();
  });

  it("does not charge missing production model configuration", async () => {
    vi.stubEnv(
      "MODELDUEL_EVALUATION_SECRET",
      "analysis-test-evaluation-secret-long-enough",
    );
    vi.stubEnv("OPENAI_API_KEY", "");
    const beforeModelCall = vi.fn();

    await expect(
      analyzeSubmission(
        {
          schemaVersion: "1.0",
          requestId: "analysis-missing-config-request",
          sessionId: "analysis-missing-config-session",
          requestedAt: 1_800_000_000_000,
          scenarioId: "moon-phases",
          explanation: "Earth's shadow causes phases.",
          sketch: null,
        },
        {
          signal: AbortSignal.timeout(10_000),
          now: 1_800_000_000_000,
          beforeModelCall,
        },
      ),
    ).rejects.toMatchObject({ code: "CONFIGURATION_REQUIRED" });
    expect(beforeModelCall).not.toHaveBeenCalled();
  });

  it("denies at the cost boundary before the first model call", async () => {
    vi.stubEnv(
      "MODELDUEL_EVALUATION_SECRET",
      "analysis-test-evaluation-secret-long-enough",
    );
    let modelCalls = 0;
    const gateway: ModelDuelGateway = {
      ...successfulGateway(),
      async parseLearnerModel() {
        modelCalls += 1;
        throw new Error("Must not be called");
      },
    };
    const beforeModelCall = vi.fn(async () => {
      await Promise.resolve();
      throw new ModelDuelUpstreamError("RATE_LIMITED");
    });

    await expect(
      analyzeSubmission(
        {
          schemaVersion: "1.0",
          requestId: "analysis-rate-denied-request",
          sessionId: "analysis-rate-denied-session",
          requestedAt: 1_800_000_000_000,
          scenarioId: "moon-phases",
          explanation: "Earth's shadow causes phases.",
          sketch: null,
        },
        {
          gateway,
          signal: AbortSignal.timeout(10_000),
          now: 1_800_000_000_000,
          beforeModelCall,
        },
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(beforeModelCall).toHaveBeenCalledTimes(1);
    expect(modelCalls).toBe(0);
  });

  it("returns the exact Seasons registry plan and four-tool live ledger", async () => {
    vi.stubEnv(
      "MODELDUEL_EVALUATION_SECRET",
      "analysis-test-evaluation-secret-long-enough",
    );
    const beforeModelCall = vi.fn();
    const response = await analyzeSubmission(
      {
        schemaVersion: "1.0",
        requestId: "analysis-seasons-live-request",
        sessionId: "analysis-seasons-live-session",
        requestedAt: 1_800_000_000_000,
        scenarioId: "seasons",
        explanation:
          "Summer happens because Earth moves closer to the Sun, so both hemispheres should warm together.",
        sketch: null,
      },
      {
        gateway: successfulGateway(SEASONS_SAMPLE),
        signal: AbortSignal.timeout(10_000),
        now: 1_800_000_000_000,
        beforeModelCall,
      },
    );
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      source: "live",
      requestId: "analysis-seasons-live-request",
      analysis: {
        scenarioId: "seasons",
        learnerModel: {
          misconceptionType: "distance-causes-seasons",
        },
        learnerWorld: {
          worldId: "seasons-learner-distance-v1",
        },
        scientificWorld: {
          worldId: "seasons-scientific-tilt-v1",
        },
        caseSpec: {
          id: "seasons-june-solstice",
        },
        metadata: {
          mode: "live",
          modelId: "gpt-5.6-terra",
          analyzedSubmission: true,
          orchestrationToolNames: [
            "validate_world_spec",
            "simulate_world",
            "compare_predictions",
            "select_discriminating_case",
          ],
        },
      },
    });
    expect(response.analysis.transferQuestion.evaluationId).toMatch(/^v1\./);
    expect(response.analysis.transferQuestion.evaluationId).not.toBe(
      "seasons-transfer-evaluation-v1",
    );
    expect(
      verifyLiveRevisionToken({
        evaluationId: response.analysis.transferQuestion.evaluationId,
        sessionId: "analysis-seasons-live-session",
        requestedAt: 1_800_000_000_000,
        now: 1_800_000_000_000,
      }),
    ).toMatchObject({
      scenarioId: "seasons",
      caseId: "seasons-june-solstice",
      caseFingerprint:
        "case-v1|seasons|id=seasons-june-solstice|longitude=90.000000|distance=1.017000|latitude=45.000000|observed-tilt=23.440000",
      learnerWorldId: "seasons-learner-distance-v1",
      scientificWorldId: "seasons-scientific-tilt-v1",
      misconceptionType: "distance-causes-seasons",
    });
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain("revisionContext");
    expect(beforeModelCall).toHaveBeenCalledTimes(1);
  });

  it("returns strict live metadata and an opaque deterministic grading token", async () => {
    vi.stubEnv(
      "MODELDUEL_EVALUATION_SECRET",
      "analysis-test-evaluation-secret-long-enough",
    );
    const beforeModelCall = vi.fn();
    const response = await analyzeSubmission(
      {
        schemaVersion: "1.0",
        requestId: "analysis-live-request",
        sessionId: "analysis-live-session",
        requestedAt: 1_800_000_000_000,
        scenarioId: "moon-phases",
        explanation: "Earth's shadow causes the phases.",
        sketch: null,
      },
      {
        gateway: successfulGateway(),
        signal: AbortSignal.timeout(10_000),
        now: 1_800_000_000_000,
        beforeModelCall,
      },
    );
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      source: "live",
      notice: "Analyzed live with GPT-5.6.",
      requestId: "analysis-live-request",
      analysis: {
        metadata: {
          mode: "live",
          modelId: "gpt-5.6-terra",
          analyzedSubmission: true,
          orchestrationToolNames: [
            "validate_world_spec",
            "simulate_world",
            "compare_predictions",
            "select_discriminating_case",
          ],
        },
      },
    });
    expect(response.analysis.transferQuestion.evaluationId).toMatch(/^v1\./);
    expect(serialized).not.toContain("correctOptionId");
    expect(serialized).not.toContain(
      "At new Moon, the Moon is in the Sun's direction from Earth",
    );
    expect(beforeModelCall).toHaveBeenCalledTimes(1);
  });
});
