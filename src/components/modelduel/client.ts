import { z } from "zod";

import {
  AnalysisResultSchema,
  RevisionFeedbackSchema,
  TransferResultSchema,
  type AnalysisResult,
  type RevisionFeedback,
  type TransferQuestion,
  type TransferResult,
} from "@/lib/modelduel";

const DemoEnvelopeSchema = z.strictObject({
  source: z.literal("verified-sample"),
  notice: z.string().trim().min(1).max(500),
  analysis: AnalysisResultSchema,
});

const ApiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum([
      "INVALID_REQUEST",
      "INVALID_EVALUATION",
      "SERVER_CONFIGURATION",
      "INTERNAL_ERROR",
    ]),
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  }),
});

const RevisionEnvelopeSchema = z.strictObject({
  source: z.literal("deterministic-authored-rubric"),
  notice: z.string().trim().min(1).max(500),
  requestId: z.string().trim().min(1).max(128),
  evaluatedAt: z.number().finite().nonnegative(),
  feedback: RevisionFeedbackSchema,
});

export type AnalysisLoad = Readonly<{
  source: "server-verified-sample";
  notice: string;
  analysis: AnalysisResult;
}>;

export type TransferEvaluationInput = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
  sessionId: string;
  question: TransferQuestion;
  selectedOptionId: string;
}>;

export type RevisionSubmissionRequest = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
  sessionId: string;
  scenarioId: "moon-phases";
  caseFingerprint: string;
  revisionText: string;
}>;

export type RevisionSubmissionResult = Readonly<{
  source: "deterministic-authored-rubric";
  notice: string;
  requestId: string;
  evaluatedAt: number;
  feedback: RevisionFeedback;
}>;

export type TransferEvaluationRequest = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
  evaluationId: string;
  sessionId: string;
  questionId: string;
  questionVersion: string;
  selectedOptionId: string;
}>;

export class ModelDuelApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code = "INVALID_RESPONSE", retryable = true) {
    super(message);
    this.name = "ModelDuelApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ModelDuelApiError(
      "The server returned a response ModelDuel could not read.",
    );
  }
}

function throwApiError(payload: unknown, fallback: string): never {
  const parsed = ApiErrorEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    throw new ModelDuelApiError(
      parsed.data.error.message,
      parsed.data.error.code,
      parsed.data.error.retryable,
    );
  }
  throw new ModelDuelApiError(fallback);
}

export function parseDemoEnvelope(payload: unknown): AnalysisLoad {
  const parsed = DemoEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ModelDuelApiError(
      "The authored challenge did not match the validated learning contract.",
    );
  }
  return {
    source: "server-verified-sample",
    notice: parsed.data.notice,
    analysis: parsed.data.analysis,
  };
}

export async function loadVerifiedDemo(
  sessionId: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<AnalysisLoad> {
  const query = new URLSearchParams({
    sessionId,
    scenarioId: "moon-phases",
  });
  const response = await fetchImplementation(`/api/demo?${query.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The authored challenge is temporarily unavailable.");
  }
  return parseDemoEnvelope(payload);
}

export function buildTransferRequest(
  input: TransferEvaluationInput,
): TransferEvaluationRequest {
  return {
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    requestedAt: input.requestedAt,
    evaluationId: input.question.evaluationId,
    sessionId: input.sessionId,
    questionId: input.question.questionId,
    questionVersion: input.question.version,
    selectedOptionId: input.selectedOptionId,
  };
}

export async function submitRevision(
  request: RevisionSubmissionRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<RevisionSubmissionResult> {
  const response = await fetchImplementation("/api/revision", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(request),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The authored revision check could not be completed.");
  }
  const result = RevisionEnvelopeSchema.safeParse(payload);
  if (!result.success || result.data.requestId !== request.requestId) {
    throw new ModelDuelApiError(
      "The revision response did not match the validated request.",
    );
  }
  return result.data;
}

export async function evaluateTransfer(
  request: TransferEvaluationRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<TransferResult> {
  const response = await fetchImplementation("/api/transfer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(request),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The transfer check could not be completed.");
  }
  const result = TransferResultSchema.safeParse(payload);
  if (!result.success) {
    throw new ModelDuelApiError(
      "The server result did not match the validated transfer contract.",
    );
  }
  if (
    result.data.evaluationId !== request.evaluationId ||
    result.data.questionId !== request.questionId ||
    result.data.questionVersion !== request.questionVersion ||
    result.data.selectedOptionId !== request.selectedOptionId
  ) {
    throw new ModelDuelApiError(
      "The transfer response did not match the locked question and choice.",
    );
  }
  return result.data;
}
