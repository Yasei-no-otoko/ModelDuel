import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import {
  AnalysisResultSchema,
  ScenarioIdSchema,
  SessionIdSchema,
} from "../../lib/modelduel/schemas";
import type {
  AnalysisResult,
  TransferResult,
} from "../../lib/modelduel/schemas";
import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../lib/modelduel/samples";
import { createCaseFingerprint } from "../../lib/modelduel/simulation";
import {
  EvaluationCoreError,
  evaluateEvaluationToken,
  issueEvaluationToken,
  verifyRevisionContextToken,
} from "./evaluation-core";

const StableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const TransferEvaluationRequestSchema = z
  .object({
    requestId: StableIdSchema,
    idempotencyKey: StableIdSchema,
    requestedAt: z.number().finite().nonnegative(),
    evaluationId: z.string(),
    sessionId: SessionIdSchema,
    questionId: StableIdSchema,
    questionVersion: StableIdSchema,
    selectedOptionId: StableIdSchema,
  })
  .strict();

export type TransferEvaluationInput = z.input<
  typeof TransferEvaluationRequestSchema
>;

export type EvaluationServiceErrorCode =
  | "SERVER_CONFIGURATION"
  | "INVALID_REQUEST"
  | "INVALID_TOKEN";

export class EvaluationServiceError extends Error {
  readonly code: EvaluationServiceErrorCode;

  constructor(code: EvaluationServiceErrorCode) {
    super(code);
    this.name = "EvaluationServiceError";
    this.code = code;
  }
}

let developmentSecret: string | undefined;

function getEvaluationSecret(): string {
  const configured = process.env.MODELDUEL_EVALUATION_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) {
      throw new EvaluationServiceError("SERVER_CONFIGURATION");
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new EvaluationServiceError("SERVER_CONFIGURATION");
  }

  developmentSecret ??= randomBytes(32).toString("hex");
  return developmentSecret;
}

export function assertEvaluationReady(): void {
  getEvaluationSecret();
}

type VerifiedAnswer = Readonly<{
  correctOptionId: string;
  rationale: string;
}>;

const VERIFIED_ANSWERS = new Map<string, VerifiedAnswer>([
  [
    MOON_HERO_SAMPLE.scenarioId,
    {
      correctOptionId: "toward-sun",
      rationale:
        "At new Moon, the Moon is in the Sun's direction from Earth, so its illuminated half faces mostly away from an observer on Earth.",
    },
  ],
  [
    SEASONS_SAMPLE.scenarioId,
    {
      correctOptionId: "reverse",
      rationale:
        "Earth's axial tilt gives the hemispheres opposite seasons, so moving the observer to the other hemisphere reverses the seasonal prediction.",
    },
  ],
]);

function getVerifiedSample(scenarioId: string): AnalysisResult {
  if (scenarioId === MOON_HERO_SAMPLE.scenarioId) {
    return MOON_HERO_SAMPLE;
  }
  if (scenarioId === SEASONS_SAMPLE.scenarioId) {
    return SEASONS_SAMPLE;
  }
  throw new EvaluationServiceError("INVALID_REQUEST");
}

function translateCoreError(error: unknown): never {
  if (error instanceof EvaluationCoreError) {
    if (error.code === "INVALID_TOKEN") {
      throw new EvaluationServiceError("INVALID_TOKEN");
    }
    if (error.code === "INVALID_REQUEST") {
      throw new EvaluationServiceError("INVALID_REQUEST");
    }
  }
  throw new EvaluationServiceError("SERVER_CONFIGURATION");
}

export function attachTransferEvaluationToken(input: {
  sessionId: string;
  analysis: AnalysisResult;
  issuedAt?: number;
}): AnalysisResult {
  const sessionId = SessionIdSchema.safeParse(input.sessionId);
  const analysis = AnalysisResultSchema.safeParse(input.analysis);
  const issuedAt = z.number().finite().nonnegative().optional().safeParse(input.issuedAt);
  if (!sessionId.success || !analysis.success || !issuedAt.success) {
    throw new EvaluationServiceError("INVALID_REQUEST");
  }

  const answer = VERIFIED_ANSWERS.get(analysis.data.scenarioId);
  const optionIds = analysis.data.transferQuestion.options.map(
    (option) => option.id,
  );
  if (!answer || !optionIds.includes(answer.correctOptionId)) {
    throw new EvaluationServiceError("SERVER_CONFIGURATION");
  }
  const misconceptionType = analysis.data.learnerModel.misconceptionType;
  if (analysis.data.metadata.mode === "live" && misconceptionType === "other") {
    throw new EvaluationServiceError("INVALID_REQUEST");
  }
  const revisionContext =
    analysis.data.metadata.mode === "live" && misconceptionType !== "other"
      ? {
          scenarioId: analysis.data.scenarioId,
          caseId: analysis.data.caseSpec.id,
          caseFingerprint: createCaseFingerprint(analysis.data.caseSpec),
          learnerWorldId: analysis.data.learnerWorld.worldId,
          scientificWorldId: analysis.data.scientificWorld.worldId,
          misconceptionType,
        }
      : undefined;

  let evaluationId: string;
  try {
    evaluationId = issueEvaluationToken(getEvaluationSecret(), {
      sessionId: sessionId.data,
      questionId: analysis.data.transferQuestion.questionId,
      questionVersion: analysis.data.transferQuestion.version,
      optionIds,
      correctOptionId: answer.correctOptionId,
      rationale: answer.rationale,
      source: "deterministic-question-bank",
      issuedAt: issuedAt.data,
      revisionContext,
    });
  } catch (error) {
    translateCoreError(error);
  }

  const attached = AnalysisResultSchema.safeParse({
    ...analysis.data,
    transferQuestion: {
      ...analysis.data.transferQuestion,
      evaluationId,
    },
  });
  if (!attached.success) {
    throw new EvaluationServiceError("SERVER_CONFIGURATION");
  }
  return attached.data;
}

export function verifyLiveRevisionToken(input: {
  evaluationId: string;
  sessionId: string;
  requestedAt: number;
  now?: number;
}) {
  try {
    return verifyRevisionContextToken(getEvaluationSecret(), input);
  } catch (error) {
    translateCoreError(error);
  }
}

export function issueVerifiedDemo(input: {
  sessionId: string;
  scenarioId: string;
  now?: number;
}): {
  source: "verified-sample";
  notice: string;
  analysis: AnalysisResult;
} {
  const parsedInput = z
    .object({
      sessionId: SessionIdSchema,
      scenarioId: ScenarioIdSchema,
      now: z.number().finite().nonnegative().optional(),
    })
    .strict()
    .safeParse(input);
  if (!parsedInput.success) {
    throw new EvaluationServiceError("INVALID_REQUEST");
  }

  const sample = getVerifiedSample(parsedInput.data.scenarioId);
  const analysis = attachTransferEvaluationToken({
    sessionId: parsedInput.data.sessionId,
    analysis: sample,
    issuedAt: parsedInput.data.now,
  });

  return {
    source: "verified-sample",
    notice:
      "This is a deterministic verified sample, not a live GPT response.",
    analysis,
  };
}

export function evaluateTransferRequest(
  input: TransferEvaluationInput,
  now = Date.now(),
): TransferResult {
  const parsed = TransferEvaluationRequestSchema.safeParse(input);
  if (!parsed.success || !Number.isFinite(now) || now < 0) {
    throw new EvaluationServiceError("INVALID_REQUEST");
  }

  try {
    return evaluateEvaluationToken(getEvaluationSecret(), {
      evaluationId: parsed.data.evaluationId,
      sessionId: parsed.data.sessionId,
      questionId: parsed.data.questionId,
      questionVersion: parsed.data.questionVersion,
      selectedOptionId: parsed.data.selectedOptionId,
      idempotencyKey: parsed.data.idempotencyKey,
      requestedAt: parsed.data.requestedAt,
      now,
    });
  } catch (error) {
    translateCoreError(error);
  }
}
