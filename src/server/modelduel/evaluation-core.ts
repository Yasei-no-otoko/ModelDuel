import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";

import {
  SessionIdSchema,
  TransferResultSchema,
} from "../../lib/modelduel/schemas";
import type { TransferResult } from "../../lib/modelduel/schemas";

const TOKEN_VERSION = "v1" as const;
const TOKEN_PURPOSE = "modelduel-transfer-evaluation" as const;
const TOKEN_AAD = Buffer.from("modelduel:evaluation:v1", "utf8");
const HKDF_SALT = Buffer.from("modelduel:evaluation:v1", "utf8");
const ENCRYPTION_INFO = Buffer.from(
  "modelduel/evaluation/encryption",
  "utf8",
);
const RECEIPT_INFO = Buffer.from("modelduel/evaluation/receipt", "utf8");
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DERIVED_KEY_BYTES = 32;
const MIN_SECRET_LENGTH = 32;
const MAX_TOKEN_LENGTH = 2_048;
const MAX_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_TTL_MS = 20 * 60 * 1_000;
const DEFAULT_CLOCK_SKEW_MS = 60 * 1_000;
const MAX_CLIENT_FUTURE_SKEW_MS = 5 * 60 * 1_000;

const StableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const EvaluationSourceSchema = z.enum([
  "deterministic-question-bank",
  "gpt-5.6",
]);

const TimestampSchema = z.number().finite().nonnegative();

const CanonicalOptionIdsSchema = z
  .array(StableIdSchema)
  .min(2)
  .max(6)
  .superRefine((optionIds, context) => {
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({ code: "custom", message: "duplicate option id" });
    }

    const sorted = [...optionIds].sort();
    if (sorted.some((optionId, index) => optionId !== optionIds[index])) {
      context.addIssue({ code: "custom", message: "non-canonical option ids" });
    }
  });

const EvaluationPayloadSchema = z
  .object({
    version: z.literal(TOKEN_VERSION),
    purpose: z.literal(TOKEN_PURPOSE),
    jti: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
    sessionId: SessionIdSchema,
    questionId: StableIdSchema,
    questionVersion: StableIdSchema,
    optionIds: CanonicalOptionIdsSchema,
    optionsFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    correctOptionId: StableIdSchema,
    rationale: z.string().trim().min(1).max(400),
    source: EvaluationSourceSchema,
    issuedAt: TimestampSchema,
    expiresAt: TimestampSchema,
    iat: TimestampSchema,
    exp: TimestampSchema,
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.issuedAt !== payload.iat || payload.expiresAt !== payload.exp) {
      context.addIssue({ code: "custom", message: "timestamp aliases differ" });
    }

    if (
      payload.expiresAt <= payload.issuedAt ||
      payload.expiresAt - payload.issuedAt > MAX_TTL_MS
    ) {
      context.addIssue({ code: "custom", message: "invalid token lifetime" });
    }

    if (!payload.optionIds.includes(payload.correctOptionId)) {
      context.addIssue({ code: "custom", message: "answer is not an option" });
    }

    const expectedFingerprint = fingerprintOptions(payload.optionIds);
    const actual = Buffer.from(payload.optionsFingerprint, "hex");
    const expected = Buffer.from(expectedFingerprint, "hex");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      context.addIssue({ code: "custom", message: "option fingerprint differs" });
    }
  });

const IssueEvaluationInputSchema = z
  .object({
    sessionId: SessionIdSchema,
    questionId: StableIdSchema,
    questionVersion: StableIdSchema,
    optionIds: z.array(StableIdSchema).min(2).max(6),
    correctOptionId: StableIdSchema,
    rationale: z.string().trim().min(1).max(400),
    source: EvaluationSourceSchema,
    issuedAt: TimestampSchema.optional(),
    expiresAt: TimestampSchema.optional(),
    ttlMs: z.number().finite().positive().max(MAX_TTL_MS).optional(),
  })
  .strict();

const EvaluateEvaluationInputSchema = z
  .object({
    evaluationId: z.string(),
    sessionId: SessionIdSchema,
    questionId: StableIdSchema,
    questionVersion: StableIdSchema,
    selectedOptionId: StableIdSchema,
    idempotencyKey: StableIdSchema,
    requestedAt: TimestampSchema,
    now: TimestampSchema.optional(),
  })
  .strict();

export type EvaluationCoreErrorCode =
  | "WEAK_SECRET"
  | "INVALID_REQUEST"
  | "INVALID_TOKEN";

export class EvaluationCoreError extends Error {
  readonly code: EvaluationCoreErrorCode;

  constructor(code: EvaluationCoreErrorCode) {
    super(code);
    this.name = "EvaluationCoreError";
    this.code = code;
  }
}

export type IssueEvaluationInput = z.input<typeof IssueEvaluationInputSchema>;
export type EvaluateEvaluationInput = z.input<
  typeof EvaluateEvaluationInputSchema
>;

function requireSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) {
    throw new EvaluationCoreError("WEAK_SECRET");
  }
  return trimmed;
}

function deriveKey(secret: string, info: Buffer): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(requireSecret(secret), "utf8"),
      HKDF_SALT,
      info,
      DERIVED_KEY_BYTES,
    ),
  );
}

function fingerprintOptions(optionIds: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...optionIds].sort()), "utf8")
    .digest("hex");
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url");
    return encodeBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

function invalidToken(): never {
  throw new EvaluationCoreError("INVALID_TOKEN");
}

function parseTokenEnvelope(token: string): {
  nonce: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
} {
  if (token.length > MAX_TOKEN_LENGTH) {
    invalidToken();
  }

  const segments = token.split(".");
  if (segments.length !== 4 || segments[0] !== TOKEN_VERSION) {
    invalidToken();
  }

  const nonce = decodeCanonicalBase64Url(segments[1]);
  const ciphertext = decodeCanonicalBase64Url(segments[2]);
  const authTag = decodeCanonicalBase64Url(segments[3]);
  if (
    !nonce ||
    nonce.length !== NONCE_BYTES ||
    !ciphertext ||
    ciphertext.length === 0 ||
    !authTag ||
    authTag.length !== AUTH_TAG_BYTES
  ) {
    invalidToken();
  }

  return { nonce, ciphertext, authTag };
}

function decryptPayload(secret: string, token: string): z.output<
  typeof EvaluationPayloadSchema
> {
  const { nonce, ciphertext, authTag } = parseTokenEnvelope(token);
  let plaintext: Buffer;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret, ENCRYPTION_INFO),
      nonce,
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    invalidToken();
  }

  try {
    const parsedJson: unknown = JSON.parse(plaintext.toString("utf8"));
    const parsedPayload = EvaluationPayloadSchema.safeParse(parsedJson);
    return parsedPayload.success ? parsedPayload.data : invalidToken();
  } catch {
    invalidToken();
  }
}

export function issueEvaluationToken(
  secret: string,
  input: IssueEvaluationInput,
): string {
  const parsed = IssueEvaluationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }

  requireSecret(secret);
  const optionIds = [...parsed.data.optionIds].sort();
  if (
    new Set(optionIds).size !== optionIds.length ||
    !optionIds.includes(parsed.data.correctOptionId)
  ) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }

  const issuedAt = parsed.data.issuedAt ?? Date.now();
  const expiresAt =
    parsed.data.expiresAt ?? issuedAt + (parsed.data.ttlMs ?? DEFAULT_TTL_MS);
  if (
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_TTL_MS ||
    (parsed.data.expiresAt !== undefined && parsed.data.ttlMs !== undefined)
  ) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }

  const payload = EvaluationPayloadSchema.safeParse({
    version: TOKEN_VERSION,
    purpose: TOKEN_PURPOSE,
    jti: encodeBase64Url(randomBytes(16)),
    sessionId: parsed.data.sessionId,
    questionId: parsed.data.questionId,
    questionVersion: parsed.data.questionVersion,
    optionIds,
    optionsFingerprint: fingerprintOptions(optionIds),
    correctOptionId: parsed.data.correctOptionId,
    rationale: parsed.data.rationale,
    source: parsed.data.source,
    issuedAt,
    expiresAt,
    iat: issuedAt,
    exp: expiresAt,
  });
  if (!payload.success) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveKey(secret, ENCRYPTION_INFO),
    nonce,
    { authTagLength: AUTH_TAG_BYTES },
  );
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload.data), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const token = [
    TOKEN_VERSION,
    encodeBase64Url(nonce),
    encodeBase64Url(ciphertext),
    encodeBase64Url(authTag),
  ].join(".");

  if (token.length > MAX_TOKEN_LENGTH) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }
  return token;
}

export function evaluateEvaluationToken(
  secret: string,
  input: EvaluateEvaluationInput,
): TransferResult {
  const parsed = EvaluateEvaluationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new EvaluationCoreError("INVALID_REQUEST");
  }

  const payload = decryptPayload(secret, parsed.data.evaluationId);
  const now = parsed.data.now ?? Date.now();
  const requestMatchesToken =
    payload.sessionId === parsed.data.sessionId &&
    payload.questionId === parsed.data.questionId &&
    payload.questionVersion === parsed.data.questionVersion &&
    payload.optionIds.includes(parsed.data.selectedOptionId);
  const tokenIsCurrent =
    now + DEFAULT_CLOCK_SKEW_MS >= payload.issuedAt &&
    now <= payload.expiresAt + DEFAULT_CLOCK_SKEW_MS;
  const requestTimeIsPlausible =
    parsed.data.requestedAt <= now + MAX_CLIENT_FUTURE_SKEW_MS;

  if (!requestMatchesToken || !tokenIsCurrent || !requestTimeIsPlausible) {
    invalidToken();
  }

  const receiptMaterial = [
    parsed.data.evaluationId,
    parsed.data.selectedOptionId,
    parsed.data.idempotencyKey,
    String(parsed.data.requestedAt),
  ].join("\u0000");
  const receiptDigest = createHmac(
    "sha256",
    deriveKey(secret, RECEIPT_INFO),
  )
    .update(receiptMaterial, "utf8")
    .digest("hex");

  return TransferResultSchema.parse({
    receiptId: `receipt-${receiptDigest}`,
    evaluationId: parsed.data.evaluationId,
    questionId: payload.questionId,
    questionVersion: payload.questionVersion,
    selectedOptionId: parsed.data.selectedOptionId,
    isCorrect: parsed.data.selectedOptionId === payload.correctOptionId,
    score: parsed.data.selectedOptionId === payload.correctOptionId ? 1 : 0,
    rationale: payload.rationale,
    evaluatedAt: Math.max(now, parsed.data.requestedAt),
    source: payload.source,
  });
}
