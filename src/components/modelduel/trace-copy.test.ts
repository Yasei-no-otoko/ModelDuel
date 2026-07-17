import { describe, expect, it } from "vitest";

import { getTraceHeroCopy } from "./trace-copy";

describe("trace hero copy", () => {
  it.each([
    ["revised", true, "Your revised model transferred."],
    [
      "partial",
      true,
      "Your model transferred, with one revision still to make.",
    ],
    [
      "retained",
      true,
      "Your answer transferred, but the original model is still retained.",
    ],
    [
      "revised",
      false,
      "Your model changed, but it did not transfer to this new case.",
    ],
    [
      "partial",
      false,
      "The transfer answer was incorrect, and the revision is still partial.",
    ],
    [
      "retained",
      false,
      "The transfer answer was incorrect, and the original model is still retained.",
    ],
  ] as const)(
    "maps %s with transfer correctness %s",
    (conceptualChange, isCorrect, expected) => {
      expect(getTraceHeroCopy(conceptualChange, isCorrect)).toBe(expected);
    },
  );
});
