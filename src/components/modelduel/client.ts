import { z } from "zod";

import {
  AnalysisResultSchema,
  RevisionFeedbackSchema,
  RuntimeModelIdSchema,
  TransferResultSchema,
  type AnalysisResult,
  type RevisionFeedback,
  type TransferQuestion,
  type TransferResult,
} from "@/lib/modelduel";

import { validateSketchFile } from "./flow";

const DemoEnvelopeSchema = z.strictObject({
  source: z.literal("verified-sample"),
  notice: z.string().trim().min(1).max(500),
  analysis: AnalysisResultSchema,
});

const LiveAnalysisEnvelopeSchema = z.strictObject({
  source: z.literal("live"),
  notice: z.string().trim().min(1).max(500),
  requestId: z.string().trim().min(1).max(128),
  analysis: AnalysisResultSchema,
});

const REQUIRED_LIVE_ORCHESTRATION_TOOLS = [
  "validate_world_spec",
  "simulate_world",
  "compare_predictions",
  "select_discriminating_case",
] as const;

function hasExactLiveOrchestrationLedger(
  tools: AnalysisResult["metadata"]["orchestrationToolNames"],
) {
  return (
    tools.length === REQUIRED_LIVE_ORCHESTRATION_TOOLS.length &&
    REQUIRED_LIVE_ORCHESTRATION_TOOLS.every(
      (required) => tools.filter((tool) => tool === required).length === 1,
    )
  );
}

const ApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "INVALID_EVALUATION",
  "SERVER_CONFIGURATION",
  "INTERNAL_ERROR",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "MODEL_REFUSAL",
  "RATE_LIMITED",
  "MODEL_OUTPUT_INVALID",
  "UPSTREAM_INCOMPLETE",
  "ORCHESTRATION_INVALID",
  "UPSTREAM_UNAVAILABLE",
  "CONFIGURATION_REQUIRED",
  "UPSTREAM_AUTHENTICATION",
  "MODEL_ACCESS_REQUIRED",
  "REQUEST_TIMEOUT",
  "UPSTREAM_TIMEOUT",
]);

const ApiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  }),
});

const RevisionEnvelopeSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("deterministic-authored-rubric"),
    notice: z.string().trim().min(1).max(500),
    requestId: z.string().trim().min(1).max(128),
    evaluatedAt: z.number().finite().nonnegative(),
    feedback: RevisionFeedbackSchema,
  }),
  z.strictObject({
    source: z.literal("gpt-5.6"),
    notice: z.string().trim().min(1).max(500),
    requestId: z.string().trim().min(1).max(128),
    modelId: RuntimeModelIdSchema,
    evaluatedAt: z.number().finite().nonnegative(),
    feedback: RevisionFeedbackSchema,
  }),
]);

export type AnalysisLoad =
  | Readonly<{
      source: "live";
      notice: string;
      requestId: string;
      analysis: AnalysisResult;
    }>
  | Readonly<{
      source: "server-verified-sample";
      notice: string;
      analysis: AnalysisResult;
    }>;

export type AnalyzeSketch = Readonly<{
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
}>;

export type LiveAnalysisRequest = Readonly<{
  schemaVersion: "1.0";
  requestId: string;
  sessionId: string;
  requestedAt: number;
  scenarioId: "moon-phases";
  explanation: string;
  sketch: AnalyzeSketch | null;
}>;

export type TransferEvaluationInput = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
  sessionId: string;
  question: TransferQuestion;
  selectedOptionId: string;
}>;

export type RevisionSubmissionCommon = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
  sessionId: string;
  revisionText: string;
}>;

export type RevisionSubmissionRequest =
  | (RevisionSubmissionCommon &
      Readonly<{
        mode: "verified-sample";
        scenarioId: "moon-phases";
        caseFingerprint: string;
      }>)
  | (RevisionSubmissionCommon &
      Readonly<{
        mode: "live";
        evaluationId: string;
      }>);

export type RevisionSubmissionResult =
  | Readonly<{
      source: "deterministic-authored-rubric";
      notice: string;
      requestId: string;
      evaluatedAt: number;
      feedback: RevisionFeedback;
    }>
  | Readonly<{
      source: "gpt-5.6";
      notice: string;
      requestId: string;
      modelId: NonNullable<AnalysisResult["metadata"]["modelId"]>;
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

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export class ModelDuelApiError extends Error {
  readonly code: ApiErrorCode | "INVALID_RESPONSE";
  readonly retryable: boolean;

  constructor(
    message: string,
    code: ApiErrorCode | "INVALID_RESPONSE" = "INVALID_RESPONSE",
    retryable = true,
  ) {
    super(message);
    this.name = "ModelDuelApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

type BrowserFile = Readonly<{
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function fileToAnalyzeSketch(file: BrowserFile): Promise<AnalyzeSketch> {
  const validationError = validateSketchFile(file);
  if (validationError) {
    throw new ModelDuelApiError(validationError, "INVALID_REQUEST", false);
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength !== file.size) {
    throw new ModelDuelApiError(
      "The selected sketch could not be read safely.",
      "INVALID_REQUEST",
      false,
    );
  }
  const mimeType = file.type as AnalyzeSketch["mimeType"];
  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytesToBase64(new Uint8Array(buffer))}`,
  };
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
  if (!parsed.success || parsed.data.analysis.metadata.mode !== "verified-sample") {
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

export function parseLiveAnalysisEnvelope(
  payload: unknown,
  expectedRequestId: string,
): AnalysisLoad {
  const parsed = LiveAnalysisEnvelopeSchema.safeParse(payload);
  if (
    !parsed.success ||
    parsed.data.requestId !== expectedRequestId ||
    parsed.data.analysis.metadata.mode !== "live" ||
    !hasExactLiveOrchestrationLedger(
      parsed.data.analysis.metadata.orchestrationToolNames,
    )
  ) {
    throw new ModelDuelApiError(
      "The live analysis did not match the validated request and source contract.",
    );
  }
  return parsed.data;
}

export async function loadVerifiedDemo(
  sessionId: string,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AnalysisLoad> {
  const query = new URLSearchParams({
    sessionId,
    scenarioId: "moon-phases",
  });
  const response = await fetchImplementation(`/api/demo?${query.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The authored challenge is temporarily unavailable.");
  }
  return parseDemoEnvelope(payload);
}

export async function analyzeSubmission(
  request: LiveAnalysisRequest,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AnalysisLoad> {
  const response = await fetchImplementation("/api/analyze", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(request),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The GPT-5.6 analysis could not be completed.");
  }
  return parseLiveAnalysisEnvelope(payload, request.requestId);
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
  signal?: AbortSignal,
): Promise<RevisionSubmissionResult> {
  const response = await fetchImplementation("/api/revision", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(request),
    signal,
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throwApiError(payload, "The authored revision check could not be completed.");
  }
  const result = RevisionEnvelopeSchema.safeParse(payload);
  if (!result.success) {
    throw new ModelDuelApiError(
      "The revision response did not match the validated request.",
    );
  }
  const provenanceMatches =
    ((request.mode === "live" && result.data.source === "gpt-5.6") ||
      (request.mode === "verified-sample" &&
        result.data.source === "deterministic-authored-rubric"));
  if (
    result.data.requestId !== request.requestId ||
    !provenanceMatches
  ) {
    throw new ModelDuelApiError(
      "The revision response did not match the validated request.",
    );
  }
  return result.data;
}

export async function evaluateTransfer(
  request: TransferEvaluationRequest,
  fetchImplementation: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<TransferResult> {
  const response = await fetchImplementation("/api/transfer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(request),
    signal,
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
