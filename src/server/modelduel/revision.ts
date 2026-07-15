import "server-only";

import { z } from "zod";

import {
  RevisionFeedbackSchema,
  ScenarioIdSchema,
  SessionIdSchema,
} from "../../lib/modelduel/schemas";
import { createCaseFingerprint } from "../../lib/modelduel/simulation";
import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../lib/modelduel/samples";
import { evaluateRevisionRubric } from "./revision-core";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const REVISION_NOTICE =
  "This feedback uses an authored deterministic rubric, not AI grading." as const;

export const RevisionEvaluationRequestSchema = z
  .object({
    requestId: SessionIdSchema,
    idempotencyKey: SessionIdSchema,
    requestedAt: z.number().finite().nonnegative(),
    sessionId: SessionIdSchema,
    scenarioId: ScenarioIdSchema,
    caseFingerprint: z.string().trim().min(1).max(220),
    revisionText: z.string().trim().min(1).max(1_500),
  })
  .strict();

export const RevisionEvaluationResponseSchema = z
  .object({
    requestId: SessionIdSchema,
    evaluatedAt: z.number().finite().nonnegative(),
    source: z.literal("deterministic-authored-rubric"),
    notice: z.literal(REVISION_NOTICE),
    feedback: RevisionFeedbackSchema,
  })
  .strict();

export type RevisionEvaluationRequest = z.input<
  typeof RevisionEvaluationRequestSchema
>;
export type RevisionEvaluationResponse = z.output<
  typeof RevisionEvaluationResponseSchema
>;

export class RevisionServiceError extends Error {
  readonly code = "INVALID_REQUEST" as const;

  constructor() {
    super("INVALID_REQUEST");
    this.name = "RevisionServiceError";
  }
}

function expectedFingerprint(scenarioId: string): string {
  if (scenarioId === MOON_HERO_SAMPLE.scenarioId) {
    return createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec);
  }
  if (scenarioId === SEASONS_SAMPLE.scenarioId) {
    return createCaseFingerprint(SEASONS_SAMPLE.caseSpec);
  }
  throw new RevisionServiceError();
}

export function evaluateRevisionRequest(
  input: RevisionEvaluationRequest,
  now = Date.now(),
): RevisionEvaluationResponse {
  const parsed = RevisionEvaluationRequestSchema.safeParse(input);
  if (
    !parsed.success ||
    !Number.isFinite(now) ||
    now < 0 ||
    parsed.data.requestedAt > now + MAX_FUTURE_SKEW_MS
  ) {
    throw new RevisionServiceError();
  }

  if (
    parsed.data.caseFingerprint !==
    expectedFingerprint(parsed.data.scenarioId)
  ) {
    throw new RevisionServiceError();
  }

  return RevisionEvaluationResponseSchema.parse({
    requestId: parsed.data.requestId,
    evaluatedAt: Math.max(now, parsed.data.requestedAt),
    source: "deterministic-authored-rubric",
    notice: REVISION_NOTICE,
    feedback: evaluateRevisionRubric({
      scenarioId: parsed.data.scenarioId,
      revisionText: parsed.data.revisionText,
    }),
  });
}
