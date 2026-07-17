import type { RevisionFeedback } from "@/lib/modelduel";

type ConceptualChange = RevisionFeedback["conceptualChange"];

const CORRECT_TRANSFER_COPY = {
  revised: "Your revised model transferred.",
  partial: "Your model transferred, with one revision still to make.",
  retained:
    "Your answer transferred, but the original model is still retained.",
} as const satisfies Record<ConceptualChange, string>;

const INCORRECT_TRANSFER_COPY = {
  revised: "Your model changed, but it did not transfer to this new case.",
  partial: "The transfer answer was incorrect, and the revision is still partial.",
  retained:
    "The transfer answer was incorrect, and the original model is still retained.",
} as const satisfies Record<ConceptualChange, string>;

export function getTraceHeroCopy(
  conceptualChange: ConceptualChange,
  isCorrect: boolean,
): string {
  const copy = isCorrect ? CORRECT_TRANSFER_COPY : INCORRECT_TRANSFER_COPY;
  return copy[conceptualChange];
}
