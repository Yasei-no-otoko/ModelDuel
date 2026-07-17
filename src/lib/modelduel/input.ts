import { z } from "zod";

import { ScenarioIdSchema, SessionIdSchema } from "./schemas";
import {
  MAX_ANALYZE_JSON_BYTES,
} from "./limits";

export { MAX_ANALYZE_JSON_BYTES, MAX_SKETCH_BYTES } from "./limits";

export const AnalyzeSketchSchema = z.strictObject({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataUrl: z.string().min(1).max(MAX_ANALYZE_JSON_BYTES),
});

export const AnalyzeRequestSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    requestId: SessionIdSchema,
    sessionId: SessionIdSchema,
    requestedAt: z.number().finite().nonnegative(),
    scenarioId: ScenarioIdSchema,
    liveUseAttestation: z.literal(true),
    explanation: z.string().trim().max(1_500),
    sketch: AnalyzeSketchSchema.nullable(),
  })
  .superRefine((request, context) => {
    if (!request.explanation && request.sketch === null) {
      context.addIssue({
        code: "custom",
        path: ["explanation"],
        message: "An explanation or sketch is required.",
      });
    }
  });

export type AnalyzeRequest = z.output<typeof AnalyzeRequestSchema>;
export type AnalyzeSketch = z.output<typeof AnalyzeSketchSchema>;
