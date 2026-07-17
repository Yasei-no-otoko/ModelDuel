import "server-only";

import { RevisionFeedbackExtractionSchema } from "./contracts";
import { ModelDuelUpstreamError } from "./errors";
import type { ModelDuelGateway } from "./gateway";
import { resolveRegistryIdentity } from "./registry";
import { executeRegistryTool } from "./tools";

const RUBRICS = {
  "moon-phases":
    "Require a causal account of sunlight illuminating one half of the Moon, Earth viewing geometry changing the visible fraction, and ordinary phases not being caused by Earth's shadow. Distinguish eclipses explicitly. Score retained, partial, or revised with 0, 0.5, or 1.",
  seasons:
    "Require a causal account of Earth's axial tilt, opposite hemispheric seasons, and changing sunlight angle or energy. Reject distance-from-Sun explanations. Score retained, partial, or revised with 0, 0.5, or 1.",
} as const;

export type LiveRevisionServiceInput = Readonly<{
  requestId: string;
  idempotencyKey: string;
  sessionId: string;
  scenarioId: "moon-phases" | "seasons";
  caseId: string;
  caseFingerprint: string;
  learnerWorldId: string;
  scientificWorldId: string;
  revisionText: string;
  safetyIdentifier: string;
  misconceptionType: "earth-shadow-phases" | "distance-causes-seasons";
}>;

function assertStructuredAttempt(attempt: {
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

export async function evaluateLiveRevision(
  gateway: ModelDuelGateway,
  input: LiveRevisionServiceInput,
  signal: AbortSignal,
) {
  const plan = resolveRegistryIdentity({
    scenarioId: input.scenarioId,
    misconceptionType: input.misconceptionType,
    caseId: input.caseId,
    caseFingerprint: input.caseFingerprint,
    learnerWorldId: input.learnerWorldId,
    scientificWorldId: input.scientificWorldId,
  });
  const simulation = executeRegistryTool(
    plan,
    "simulate_world",
    JSON.stringify({
      caseId: plan.caseId,
      learnerWorldId: plan.learnerWorldId,
      scientificWorldId: plan.scientificWorldId,
    }),
  );
  const first = await gateway.parseRevisionFeedback({
    scenarioId: input.scenarioId,
    initialSummary: `Server-classified misconception: ${input.misconceptionType}`,
    misconceptionType: input.misconceptionType,
    observations: simulation.output,
    rubric: RUBRICS[input.scenarioId],
    revisionText: input.revisionText,
    safetyIdentifier: input.safetyIdentifier,
    repair: false,
    idempotencyKey: `${input.idempotencyKey}-revision-1`,
    signal,
  });
  assertStructuredAttempt(first);
  const parsed = RevisionFeedbackExtractionSchema.safeParse(first.parsed);
  if (parsed.success) {
    return parsed.data.feedback;
  }

  const repair = await gateway.parseRevisionFeedback({
    scenarioId: input.scenarioId,
    initialSummary: `Server-classified misconception: ${input.misconceptionType}`,
    misconceptionType: input.misconceptionType,
    observations: simulation.output,
    rubric: RUBRICS[input.scenarioId],
    revisionText: input.revisionText,
    previousOutputText: first.outputText.slice(0, 4_096),
    safetyIdentifier: input.safetyIdentifier,
    repair: true,
    idempotencyKey: `${input.idempotencyKey}-revision-2`,
    signal,
  });
  assertStructuredAttempt(repair);
  const repaired = RevisionFeedbackExtractionSchema.safeParse(repair.parsed);
  if (!repaired.success) {
    throw new ModelDuelUpstreamError("MODEL_OUTPUT_INVALID");
  }
  return repaired.data.feedback;
}
