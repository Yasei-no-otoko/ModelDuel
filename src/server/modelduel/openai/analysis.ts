import "server-only";

import { z } from "zod";

import {
  AnalysisResultSchema,
  SessionIdSchema,
} from "../../../lib/modelduel/schemas";
import type { AnalysisResult } from "../../../lib/modelduel/schemas";
import type { AnalyzeRequest } from "../../../lib/modelduel/input";
import {
  assertEvaluationReady,
  attachTransferEvaluationToken,
} from "../evaluation";
import { extractLearnerModel } from "./extraction";
import { createProductionModelDuelGateway } from "./gateway";
import type { ModelDuelGateway } from "./gateway";
import { validateSketchImage } from "./image";
import { runDeterministicOrchestration } from "./orchestration";
import { resolveRegistryPlan } from "./registry";
import { ModelDuelUpstreamError } from "./errors";

const LIVE_NOTICE = "Analyzed live with GPT-5.6." as const;

export const LiveAnalysisResponseSchema = z.strictObject({
  source: z.literal("live"),
  notice: z.literal(LIVE_NOTICE),
  requestId: SessionIdSchema,
  analysis: AnalysisResultSchema,
});

export type LiveAnalysisResponse = z.output<typeof LiveAnalysisResponseSchema>;

export async function analyzeSubmission(
  input: AnalyzeRequest,
  options: Readonly<{
    signal: AbortSignal;
    gateway?: ModelDuelGateway;
    now?: number;
    beforeModelCall?: () => void;
  }>,
): Promise<LiveAnalysisResponse> {
  const now = options.now ?? Date.now();
  if (!Number.isFinite(now) || now < 0) {
    throw new Error("Invalid server clock");
  }
  assertEvaluationReady();
  const image = input.sketch ? validateSketchImage(input.sketch) : undefined;
  const gateway = options.gateway ?? createProductionModelDuelGateway();
  options.beforeModelCall?.();
  const learnerModel = await extractLearnerModel(gateway, {
    scenarioId: input.scenarioId,
    explanation: input.explanation,
    imageDataUrl: image?.dataUrl,
    requestId: input.requestId,
    signal: options.signal,
  });
  const plan = resolveRegistryPlan({
    scenarioId: input.scenarioId,
    learnerModel,
  });
  const orchestration = await runDeterministicOrchestration(gateway, {
    requestId: input.requestId,
    learnerSummary: learnerModel.summary,
    misconceptionType: learnerModel.misconceptionType,
    plan,
    signal: options.signal,
  });

  const liveAnalysis = AnalysisResultSchema.safeParse({
    ...plan.analysisTemplate,
    learnerModel,
    metadata: {
      mode: "live",
      modelId: gateway.analysisModel,
      analyzedSubmission: true,
      orchestrationToolNames: orchestration.toolNames,
    },
  });
  if (!liveAnalysis.success) {
    throw new ModelDuelUpstreamError("MODEL_OUTPUT_INVALID");
  }
  const analysis: AnalysisResult = attachTransferEvaluationToken({
    sessionId: input.sessionId,
    analysis: liveAnalysis.data,
    issuedAt: now,
  });
  return LiveAnalysisResponseSchema.parse({
    source: "live",
    notice: LIVE_NOTICE,
    requestId: input.requestId,
    analysis,
  });
}
