import { describe, expect, it } from "vitest";

import { RevisionFeedbackSchema } from "../../lib/modelduel/schemas";
import { evaluateRevisionRubric } from "./revision-core";

describe("authored deterministic revision rubric", () => {
  it("marks a causal Moon model revision as revised", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.",
    });

    expect(feedback.conceptualChange).toBe("revised");
    expect(feedback.score).toBe(1);
    expect(feedback.strengths).toHaveLength(3);
    expect(RevisionFeedbackSchema.parse(feedback)).toEqual(feedback);
  });

  it("marks a two-concept Moon explanation as partial", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "Sunlight illuminates half the Moon, and the visible part changes because our viewing angle from Earth changes.",
    });

    expect(feedback.conceptualChange).toBe("partial");
    expect(feedback.score).toBe(0.5);
    expect(feedback.nextStep).toContain("shadow");
  });

  it("retains the misconception when no causal scientific model is supplied", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText: "The Earth's shadow moves across the Moon.",
    });

    expect(feedback.conceptualChange).toBe("retained");
    expect(feedback.score).toBe(0);
  });

  it("does not award full credit to an adversarial keyword list", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "sun light illuminate view angle perspective shadow eclipse not because so therefore",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).toBeLessThan(1);
  });

  it("rejects a keyword-complete but causally inverted Moon explanation", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "Sunlight is not involved because the viewing angle from Earth causes Earth's shadow, not an eclipse, to make every phase.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).toBeLessThan(1);
  });

  it("blocks a mixed Moon explanation that still asserts the shadow misconception", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "Sunlight illuminates half of the Moon because the viewing angle changes the visible portion; Earth's shadow causes phases but does not cause eclipses.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).toBeLessThan(1);
  });

  it("accepts an explicit shadow-versus-eclipse correction", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "moon-phases",
      revisionText:
        "Sunlight lights one half of the Moon, and our viewing angle changes the visible portion because Earth's shadow does not cause phases; it causes eclipses.",
    });

    expect(feedback.conceptualChange).toBe("revised");
    expect(feedback.score).toBe(1);
  });

  it("marks a causal seasons explanation as revised", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "seasons",
      revisionText:
        "The Earth's axis is tilted, so each hemisphere receives sunlight at a different angle and the Northern and Southern Hemispheres have opposite seasons.",
    });

    expect(feedback.conceptualChange).toBe("revised");
    expect(feedback.score).toBe(1);
    expect(feedback.summary).toContain("axial tilt");
  });

  it("rejects a causally inverted seasons explanation", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "seasons",
      revisionText:
        "Earth's tilt is not involved because both hemispheres have the same season and the sunlight angle does not matter.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).toBeLessThan(1);
  });

  it("blocks a mixed seasons explanation that retains the distance misconception", () => {
    const feedback = evaluateRevisionRubric({
      scenarioId: "seasons",
      revisionText:
        "Earth's axial tilt causes opposite seasons because the sunlight angle changes, but Earth's distance from the Sun causes summer and winter.",
    });

    expect(feedback.conceptualChange).not.toBe("revised");
    expect(feedback.score).toBeLessThan(1);
  });

  it("returns exactly the same feedback for the same revision", () => {
    const input = {
      scenarioId: "seasons",
      revisionText:
        "Earth's tilt changes the sunlight angle, so the opposite hemisphere has the opposite season.",
    };
    expect(evaluateRevisionRubric(input)).toEqual(evaluateRevisionRubric(input));
  });
});
