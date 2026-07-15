import type { SessionStage } from "@/lib/modelduel";
import { MAX_SKETCH_BYTES } from "@/lib/modelduel/input";

export const EXPERIENCE_STEPS = [
  { id: "capture", label: "Capture" },
  { id: "interpret", label: "Interpret" },
  { id: "predict", label: "Predict" },
  { id: "observe", label: "Observe" },
  { id: "revise", label: "Revise" },
  { id: "transfer", label: "Transfer" },
  { id: "trace", label: "Trace" },
] as const;

export type ExperienceStage = (typeof EXPERIENCE_STEPS)[number]["id"];

export function stageIndex(stage: ExperienceStage): number {
  return EXPERIENCE_STEPS.findIndex((step) => step.id === stage);
}

export function experienceStageForSession(
  stage: SessionStage,
  observationReviewed: boolean,
): ExperienceStage {
  switch (stage) {
    case "HOME":
    case "INPUT":
      return "capture";
    case "ANALYZING":
    case "MODEL_REVIEW":
      return "interpret";
    case "PREDICTION_OPEN":
      return "predict";
    case "PREDICTION_LOCKED":
    case "OBSERVING":
      return "observe";
    case "REVISION":
      return observationReviewed ? "revise" : "observe";
    case "TRANSFER_OPEN":
    case "TRANSFER_LOCKED":
      return "transfer";
    case "REVISION_TRACE":
      return "trace";
  }
}

export function validateCaptureInput(
  explanation: string,
  hasValidSketch: boolean,
  mode: "live" | "verified-sample",
): string | null {
  const length = explanation.trim().length;
  if (length > 1_500) {
    return "Keep the explanation to 1,500 characters or fewer.";
  }
  if (mode === "verified-sample" || hasValidSketch) {
    return null;
  }
  if (length === 0) {
    return "Add an explanation or a valid sketch for live GPT-5.6 analysis.";
  }
  if (length < 20) {
    return "Write at least 20 characters so your starting idea is testable.";
  }
  return null;
}

const CAUSAL_LANGUAGE =
  /\b(because|cause(?:s|d)?|therefore|so that|which means|due to|result(?:s|ed)? in|leads? to)\b/i;

export function validateRevision(revision: string): string | null {
  const value = revision.trim();
  if (value.length < 40) {
    return "Use at least 40 characters to connect the observation to a revised cause.";
  }
  if (value.length > 1_500) {
    return "Keep the revision to 1,500 characters or fewer.";
  }
  if (!CAUSAL_LANGUAGE.test(value)) {
    return "Include causal language such as “because,” “therefore,” or “leads to.”";
  }
  return null;
}

const ALLOWED_SKETCH_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validateSketchFile(
  file: Readonly<{ type: string; size: number }>,
): string | null {
  if (!ALLOWED_SKETCH_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size <= 0 || file.size > MAX_SKETCH_BYTES) {
    return "Choose an image no larger than 3 MB.";
  }
  return null;
}

export function createStableId(prefix: string): string {
  const randomPart = globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${prefix}-${randomPart}`;
}
