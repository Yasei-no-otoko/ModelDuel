import { z } from "zod";

import {
  RevisionFeedbackSchema,
  RevisionModelIdSchema,
} from "../../lib/modelduel/schemas";

const ReplayFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const ReplayKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
const ReplayClaimIdSchema = z.string().uuid();
const ReplayTimestampSchema = z.number().finite().nonnegative();
const ReplayErrorCodeSchema = z.string().trim().min(1).max(80);

export const RevisionReplayResultSchema = z.strictObject({
  modelId: RevisionModelIdSchema,
  feedback: RevisionFeedbackSchema,
});

export type RevisionReplayResult = z.output<
  typeof RevisionReplayResultSchema
>;

export const RevisionReplayClaimInputSchema = z.strictObject({
  replayKey: ReplayKeySchema,
  fingerprint: ReplayFingerprintSchema,
  now: ReplayTimestampSchema,
  expiresAt: ReplayTimestampSchema,
});

export type RevisionReplayClaimInput = z.output<
  typeof RevisionReplayClaimInputSchema
>;

export const RevisionReplayClaimResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("claimed"), claimId: ReplayClaimIdSchema }),
  z.strictObject({
    status: z.literal("cached"),
    result: RevisionReplayResultSchema,
  }),
  z.strictObject({ status: z.literal("in-progress") }),
  z.strictObject({ status: z.literal("conflict") }),
  z.strictObject({ status: z.literal("failed"), errorCode: ReplayErrorCodeSchema }),
  z.strictObject({ status: z.literal("expired") }),
]);

export type RevisionReplayClaimResult = z.output<
  typeof RevisionReplayClaimResultSchema
>;

export const RevisionReplayCompleteInputSchema = z.strictObject({
  replayKey: ReplayKeySchema,
  fingerprint: ReplayFingerprintSchema,
  claimId: ReplayClaimIdSchema,
  result: RevisionReplayResultSchema,
});

export type RevisionReplayCompleteInput = z.output<
  typeof RevisionReplayCompleteInputSchema
>;

export const RevisionReplayTransitionInputSchema = z.strictObject({
  replayKey: ReplayKeySchema,
  fingerprint: ReplayFingerprintSchema,
  claimId: ReplayClaimIdSchema,
});

export type RevisionReplayTransitionInput = z.output<
  typeof RevisionReplayTransitionInputSchema
>;

export const RevisionReplayFailInputSchema = z.strictObject({
  replayKey: ReplayKeySchema,
  fingerprint: ReplayFingerprintSchema,
  claimId: ReplayClaimIdSchema,
  errorCode: ReplayErrorCodeSchema,
});

export type RevisionReplayFailInput = z.output<
  typeof RevisionReplayFailInputSchema
>;

export interface RevisionReplayCoordinator {
  claim(input: RevisionReplayClaimInput): Promise<RevisionReplayClaimResult>;
  commit(input: RevisionReplayTransitionInput): Promise<void>;
  release(input: RevisionReplayTransitionInput): Promise<void>;
  complete(input: RevisionReplayCompleteInput): Promise<void>;
  fail(input: RevisionReplayFailInput): Promise<void>;
}
