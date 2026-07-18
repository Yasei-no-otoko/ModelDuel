import "server-only";

import { z } from "zod";

import {
  EvaluationIdSchema,
  RevisionFeedbackSchema,
  RevisionModelIdSchema,
  ScenarioIdSchema,
  SessionIdSchema,
} from "../../lib/modelduel/schemas";
import { createCaseFingerprint } from "../../lib/modelduel/simulation";
import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../lib/modelduel/samples";
import { evaluateRevisionRubric } from "./revision-core";
import { createProductionModelDuelGateway } from "./openai/gateway";
import type { ModelDuelGateway } from "./openai/gateway";
import { evaluateLiveRevision } from "./openai/revision";
import { verifyLiveRevisionToken } from "./evaluation";
import { isValidSafetyIdentifier } from "./safety-identifier";
import type { RevisionReplayCoordinator } from "./revision-replay-contract";
import { RevisionReplayResultSchema } from "./revision-replay-contract";
import {
  createRevisionRequestFingerprint,
  replayClaimError,
  RevisionReplayError,
} from "./revision-replay";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const REVISION_NOTICE =
  "This feedback uses an authored deterministic rubric, not AI grading." as const;

const RevisionCommonFields = {
  requestId: SessionIdSchema,
  idempotencyKey: SessionIdSchema,
  requestedAt: z.number().finite().nonnegative(),
  sessionId: SessionIdSchema,
  revisionText: z.string().trim().min(1).max(1_500),
};

export const VerifiedRevisionEvaluationRequestSchema = z.strictObject({
  ...RevisionCommonFields,
  mode: z.literal("verified-sample"),
  scenarioId: ScenarioIdSchema,
  caseFingerprint: z.string().trim().min(1).max(220),
});

export const LiveRevisionEvaluationRequestSchema = z.strictObject({
  ...RevisionCommonFields,
  mode: z.literal("live"),
  liveUseAttestation: z.literal(true),
  evaluationId: EvaluationIdSchema,
});

export const RevisionEvaluationRequestSchema = z.discriminatedUnion("mode", [
  VerifiedRevisionEvaluationRequestSchema,
  LiveRevisionEvaluationRequestSchema,
]);

export const VerifiedRevisionEvaluationResponseSchema = z
  .object({
    requestId: SessionIdSchema,
    evaluatedAt: z.number().finite().nonnegative(),
    source: z.literal("deterministic-authored-rubric"),
    notice: z.literal(REVISION_NOTICE),
    feedback: RevisionFeedbackSchema,
  })
  .strict();

export const LiveRevisionEvaluationResponseSchema = z.strictObject({
  requestId: SessionIdSchema,
  evaluatedAt: z.number().finite().nonnegative(),
  source: z.literal("gpt-5.6"),
  notice: z.literal("Revision feedback generated live with GPT-5.6."),
  modelId: RevisionModelIdSchema,
  feedback: RevisionFeedbackSchema,
});

export const RevisionEvaluationResponseSchema = z.union([
  VerifiedRevisionEvaluationResponseSchema,
  LiveRevisionEvaluationResponseSchema,
]);

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

function errorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "INTERNAL_ERROR";
}

function liveResponse(input: Readonly<{
  requestId: string;
  requestedAt: number;
  now: number;
  modelId: string;
  feedback: unknown;
}>): RevisionEvaluationResponse {
  return LiveRevisionEvaluationResponseSchema.parse({
    requestId: input.requestId,
    evaluatedAt: Math.max(input.now, input.requestedAt),
    source: "gpt-5.6",
    notice: "Revision feedback generated live with GPT-5.6.",
    modelId: input.modelId,
    feedback: input.feedback,
  });
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

export async function evaluateRevisionRequest(
  input: RevisionEvaluationRequest,
  now = Date.now(),
  options: Readonly<{
    signal?: AbortSignal;
    resolveSafetyIdentifier?: () => string;
    resolveReplayCoordinator?: () => Promise<RevisionReplayCoordinator>;
    gateway?: ModelDuelGateway;
    beforeLiveGateway?: () => void | Promise<void>;
  }> = {},
): Promise<RevisionEvaluationResponse> {
  const parsed = RevisionEvaluationRequestSchema.safeParse(input);
  if (
    !parsed.success ||
    !Number.isFinite(now) ||
    now < 0 ||
    parsed.data.requestedAt > now + MAX_FUTURE_SKEW_MS
  ) {
    throw new RevisionServiceError();
  }

  if (parsed.data.mode === "verified-sample") {
    if (
      parsed.data.caseFingerprint !==
      expectedFingerprint(parsed.data.scenarioId)
    ) {
      throw new RevisionServiceError();
    }
    return VerifiedRevisionEvaluationResponseSchema.parse({
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

  const authorization = verifyLiveRevisionToken({
    evaluationId: parsed.data.evaluationId,
    sessionId: parsed.data.sessionId,
    requestedAt: parsed.data.requestedAt,
    now,
  });
  const safetyIdentifier = options.resolveSafetyIdentifier?.();
  if (!isValidSafetyIdentifier(safetyIdentifier)) {
    throw new RevisionServiceError();
  }
  const gateway = options.gateway ?? createProductionModelDuelGateway();
  const replayCoordinator = await options.resolveReplayCoordinator?.();
  if (replayCoordinator === undefined) {
    throw new RevisionReplayError("SERVER_CONFIGURATION");
  }
  const fingerprint = createRevisionRequestFingerprint({
    replayKey: authorization.replayKey,
    sessionId: parsed.data.sessionId,
    revisionText: parsed.data.revisionText,
  });
  const claim = await replayCoordinator.claim({
    replayKey: authorization.replayKey,
    fingerprint,
    now,
    expiresAt: authorization.replayExpiresAt,
  });
  if (claim.status === "cached") {
    return liveResponse({
      requestId: parsed.data.requestId,
      requestedAt: parsed.data.requestedAt,
      now,
      ...claim.result,
    });
  }
  if (claim.status !== "claimed") {
    throw replayClaimError(claim);
  }

  const transition = {
    replayKey: authorization.replayKey,
    fingerprint,
    claimId: claim.claimId,
  };
  const revisionContext = {
    scenarioId: authorization.scenarioId,
    caseId: authorization.caseId,
    caseFingerprint: authorization.caseFingerprint,
    learnerWorldId: authorization.learnerWorldId,
    scientificWorldId: authorization.scientificWorldId,
    misconceptionType: authorization.misconceptionType,
  };
  let commitAttempted = false;
  let committed = false;
  try {
    await options.beforeLiveGateway?.();
    const feedback = await evaluateLiveRevision(
      gateway,
      {
        requestId: parsed.data.requestId,
        idempotencyKey: parsed.data.idempotencyKey,
        sessionId: parsed.data.sessionId,
        revisionText: parsed.data.revisionText,
        safetyIdentifier,
        ...revisionContext,
      },
      options.signal ?? AbortSignal.timeout(50_000),
      {
        beforeFirstModelCall: async () => {
          commitAttempted = true;
          await replayCoordinator.commit(transition);
          committed = true;
        },
      },
    );
    const result = RevisionReplayResultSchema.parse({
      modelId: gateway.revisionModel,
      feedback,
    });
    await replayCoordinator.complete({
      ...transition,
      result,
    });
    return liveResponse({
      requestId: parsed.data.requestId,
      requestedAt: parsed.data.requestedAt,
      now,
      ...result,
    });
  } catch (error) {
    if (committed) {
      try {
        await replayCoordinator.fail({
          ...transition,
          errorCode: errorCode(error),
        });
      } catch {
        // A lost completion acknowledgement must remain committed or completed.
      }
    } else if (!commitAttempted) {
      try {
        await replayCoordinator.release(transition);
      } catch {
        // A failed release remains fail-closed and cannot cross the paid boundary.
      }
    }
    throw error;
  }
}
