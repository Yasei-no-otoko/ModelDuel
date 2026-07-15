import { describe, expect, it } from "vitest";

import {
  createStableId,
  experienceStageForSession,
  stageIndex,
  validateExplanation,
  validateRevision,
  validateSketchFile,
} from "./flow";

describe("ModelDuel experience mapping", () => {
  it("maps the protected domain stages to the seven learner-facing steps", () => {
    expect(experienceStageForSession("HOME", false)).toBe("capture");
    expect(experienceStageForSession("ANALYZING", false)).toBe("interpret");
    expect(experienceStageForSession("MODEL_REVIEW", false)).toBe("interpret");
    expect(experienceStageForSession("PREDICTION_OPEN", false)).toBe("predict");
    expect(experienceStageForSession("PREDICTION_LOCKED", false)).toBe("observe");
    expect(experienceStageForSession("REVISION", false)).toBe("observe");
    expect(experienceStageForSession("REVISION", true)).toBe("revise");
    expect(experienceStageForSession("TRANSFER_LOCKED", true)).toBe("transfer");
    expect(experienceStageForSession("REVISION_TRACE", true)).toBe("trace");
    expect(stageIndex("trace")).toBe(6);
  });
});

describe("learner input validation", () => {
  it("requires a useful starting explanation and enforces the domain limit", () => {
    expect(validateExplanation("too short")).toContain("at least 20");
    expect(validateExplanation("A clear initial explanation about Moon phases.")).toBeNull();
    expect(validateExplanation("x".repeat(1_501))).toContain("1,500");
  });

  it("requires a causal, substantial revision without prescribing the answer", () => {
    expect(validateRevision("The angle changed.")).toContain("40");
    expect(
      validateRevision("The observation changed my explanation and the earlier model no longer fits."),
    ).toContain("causal language");
    expect(
      validateRevision(
        "I revised the model because the observation conflicts with the causal claim I began with.",
      ),
    ).toBeNull();
  });

  it("accepts only bounded browser-preview image formats", () => {
    expect(validateSketchFile({ type: "image/png", size: 2_048 })).toBeNull();
    expect(validateSketchFile({ type: "image/gif", size: 2_048 })).toContain("PNG");
    expect(validateSketchFile({ type: "image/webp", size: 11 * 1024 * 1024 })).toContain(
      "10 MB",
    );
  });

  it("creates stable request identifiers without UUID punctuation", () => {
    expect(createStableId("revision-key")).toMatch(/^revision-key-[a-f0-9]{32}$/);
  });
});
