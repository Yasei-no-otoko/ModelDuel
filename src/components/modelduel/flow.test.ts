import { describe, expect, it } from "vitest";

import { MAX_SKETCH_BYTES } from "@/lib/modelduel/input";

import {
  createStableId,
  experienceStageForSession,
  stageIndex,
  validateCaptureInput,
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
  it("requires meaningful text or a sketch for live analysis", () => {
    expect(validateCaptureInput("", false, "live")).toContain(
      "explanation or a valid sketch",
    );
    expect(validateCaptureInput("too short", false, "live")).toContain(
      "at least 20",
    );
    expect(
      validateCaptureInput("12345678901234567890", false, "live"),
    ).toBeNull();
    expect(validateCaptureInput("", true, "live")).toBeNull();
    expect(validateCaptureInput("short note", true, "live")).toBeNull();
  });

  it("allows an empty verified-sample input while enforcing the shared maximum", () => {
    expect(validateCaptureInput("", false, "verified-sample")).toBeNull();
    expect(validateCaptureInput("short", false, "verified-sample")).toBeNull();
    expect(validateCaptureInput("x".repeat(1_500), true, "live")).toBeNull();
    expect(validateCaptureInput("x".repeat(1_501), true, "live")).toContain(
      "1,500",
    );
    expect(
      validateCaptureInput("x".repeat(1_501), false, "verified-sample"),
    ).toContain("1,500");
  });

  it("accepts a word-bounded bare so connector without matching unrelated substrings", () => {
    expect(
      validateRevision(
        "Earth's axial tilt changes the sunlight angle, so the Northern and Southern Hemispheres receive different energy and experience opposite seasons.",
      ),
    ).toBeNull();
    expect(
      validateRevision(
        "Some observations compare the sunlight angle across opposite hemispheres without explaining the connection.",
      ),
    ).toMatch(/causal language/i);
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
    expect(
      validateSketchFile({ type: "image/webp", size: MAX_SKETCH_BYTES }),
    ).toBeNull();
    expect(validateSketchFile({ type: "image/gif", size: 2_048 })).toContain("PNG");
    expect(
      validateSketchFile({ type: "image/webp", size: MAX_SKETCH_BYTES + 1 }),
    ).toContain(
      "3 MB",
    );
  });

  it("creates stable request identifiers without UUID punctuation", () => {
    expect(createStableId("revision-key")).toMatch(/^revision-key-[a-f0-9]{32}$/);
  });
});
