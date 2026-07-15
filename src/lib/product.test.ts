import { describe, expect, it } from "vitest";

import { LEARNING_STEPS, PRODUCT } from "./product";

describe("ModelDuel product contract", () => {
  it("keeps the evidence-led learning sequence in pedagogical order", () => {
    expect(LEARNING_STEPS.map((step) => step.label)).toEqual([
      "Explain",
      "Predict",
      "Observe",
      "Revise",
    ]);
  });

  it("uses unique stable step identifiers", () => {
    const ids = LEARNING_STEPS.map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(PRODUCT.tagline).toBe("Two models predict. Evidence decides.");
  });
});
