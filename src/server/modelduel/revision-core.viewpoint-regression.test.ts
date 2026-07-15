import { describe, expect, it } from "vitest";

import { evaluateRevisionRubric } from "./revision-core";

const ORBIT_VIEWPOINT_EXPLANATION =
  "The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions of the sunlit half.";

describe("Moon orbit-to-viewpoint rubric regression", () => {
  it("recognizes the causal viewpoint chain while still requiring a shadow distinction", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText: ORBIT_VIEWPOINT_EXPLANATION,
    });

    expect(feedback).toMatchObject({
      conceptualChange: "partial",
      score: 0.5,
    });
    expect(feedback.nextStep).toMatch(/shadow.*eclipse|eclipse.*shadow/i);
  });

  it("keeps an explicit illumination, viewpoint, and eclipse distinction fully revised", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        `${ORBIT_VIEWPOINT_EXPLANATION} Earth's shadow does not cause the regular phases; it causes a lunar eclipse.`,
    });

    expect(feedback).toMatchObject({
      conceptualChange: "revised",
      score: 1,
    });
  });

  it("does not treat a negated visible-fraction observation as a valid viewpoint link", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we do not see different fractions of the sunlit half. Earth's shadow does not cause the regular phases; it causes a lunar eclipse.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).not.toBe(1);
  });

  it("never marks a retained Earth-shadow-causes-phases claim as revised", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "Earth's shadow causes the Moon's phases because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).not.toBe(1);
  });
});
