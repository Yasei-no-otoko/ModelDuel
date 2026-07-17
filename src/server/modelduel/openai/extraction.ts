import type { LearnerModel } from "../../../lib/modelduel/schemas";
import { LearnerModelExtractionSchema } from "./contracts";
import { ModelDuelUpstreamError } from "./errors";
import type { ModelDuelGateway } from "./gateway";

export type ExtractLearnerModelInput = Readonly<{
  scenarioId: string;
  explanation: string;
  imageDataUrl?: string;
  requestId: string;
  safetyIdentifier: string;
  signal: AbortSignal;
}>;

function validateAttemptStatus(attempt: {
  status: string;
  hasError: boolean;
  hasRefusal: boolean;
}): void {
  if (attempt.hasRefusal) {
    throw new ModelDuelUpstreamError("MODEL_REFUSAL");
  }
  if (attempt.hasError) {
    throw new ModelDuelUpstreamError("UPSTREAM_UNAVAILABLE");
  }
  if (attempt.status !== "completed") {
    throw new ModelDuelUpstreamError("UPSTREAM_INCOMPLETE");
  }
}

export async function extractLearnerModel(
  gateway: ModelDuelGateway,
  input: ExtractLearnerModelInput,
): Promise<LearnerModel> {
  const first = await gateway.parseLearnerModel({
    scenarioId: input.scenarioId,
    explanation: input.explanation,
    imageDataUrl: input.imageDataUrl,
    safetyIdentifier: input.safetyIdentifier,
    repair: false,
    idempotencyKey: `${input.requestId}-extract-1`,
    signal: input.signal,
  });
  validateAttemptStatus(first);
  const firstParsed = LearnerModelExtractionSchema.safeParse(first.parsed);
  if (firstParsed.success) {
    return firstParsed.data.learnerModel;
  }

  if (!input.explanation && !first.outputText) {
    throw new ModelDuelUpstreamError("MODEL_OUTPUT_INVALID");
  }

  const repair = await gateway.parseLearnerModel({
    scenarioId: input.scenarioId,
    explanation: input.explanation,
    previousOutputText: first.outputText.slice(0, 4_096),
    safetyIdentifier: input.safetyIdentifier,
    repair: true,
    idempotencyKey: `${input.requestId}-extract-2`,
    signal: input.signal,
  });
  validateAttemptStatus(repair);
  const repaired = LearnerModelExtractionSchema.safeParse(repair.parsed);
  if (!repaired.success) {
    throw new ModelDuelUpstreamError("MODEL_OUTPUT_INVALID");
  }
  return repaired.data.learnerModel;
}
