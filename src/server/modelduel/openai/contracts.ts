import { z } from "zod";

import {
  LearnerModelSchema,
  RevisionFeedbackSchema,
} from "../../../lib/modelduel/schemas";

export const LearnerModelExtractionSchema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  learnerModel: LearnerModelSchema,
});

export const RevisionFeedbackExtractionSchema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  feedback: RevisionFeedbackSchema,
});

export type LearnerModelExtraction = z.output<
  typeof LearnerModelExtractionSchema
>;
export type RevisionFeedbackExtraction = z.output<
  typeof RevisionFeedbackExtractionSchema
>;

export type StructuredAttempt<T> = Readonly<{
  status: string;
  hasError: boolean;
  hasRefusal: boolean;
  parsed: T | null;
  outputText: string;
}>;
