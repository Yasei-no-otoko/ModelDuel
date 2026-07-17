import { describe, expect, it } from "vitest";

import {
  TRACE_HANDOFF_FILENAME,
  buildTraceHandoffText,
  type TraceHandoffContent,
} from "./trace-handoff";

const CONTENT: TraceHandoffContent = {
  scenario: "Moon phases",
  evidenceSource: "Verified authored sample",
  initialBeliefLabel: "Initial belief",
  initialBelief: "Earth's shadow causes phases.",
  lockedPrediction: "Earth's shadow masks half of the Moon.",
  observationLabel: "Verified observation",
  observation: "50% illuminated; Earth-shadow intersection: none",
  revisedExplanation: "Sunlight illuminates half while our viewing angle changes.",
  revisionFeedback: "Authored deterministic rubric · revised",
  transferResult: "Correct · 1/1 · server-verified",
  transferRationale: "The viewing geometry predicts a new Moon in the Sun's direction.",
};

describe("trace handoff", () => {
  it("uses a fixed filename that cannot contain learner input", () => {
    expect(TRACE_HANDOFF_FILENAME).toBe("modelduel-revision-trace.txt");
  });

  it("exports only the reviewable learning trail and explicit sharing boundary", () => {
    const text = buildTraceHandoffText(CONTENT);

    expect(text).toContain("ModelDuel — Learner-controlled Revision Trace");
    expect(text).toContain("1. Initial belief\n  Earth's shadow causes phases.");
    expect(text).toContain("5. Transfer result\n  Correct · 1/1 · server-verified");
    expect(text).toContain("ModelDuel did not send it or create a server-side record.");
    expect(text).toContain("until reset, reload, or page close");
    expect(text).toContain("Review it before sharing with a teacher or anyone else.");
    expect(text).toContain("system clipboard");
    expect(text).toContain("may retain or sync");
    expect(text).toContain("browser or device may retain the file");
    expect(text).toContain("not signed, tamper-proof, or teacher-authenticated");
    expect(text).toContain("not a grade or proof of durable learning");
    expect(text).not.toMatch(/session id|receipt|cookie|request id/i);
  });

  it("normalizes multiline learner text and neutralizes unsafe paste content", () => {
    const text = buildTraceHandoffText({
      ...CONTENT,
      initialBelief:
        "First line\r\nSecond\u0000 line\twith detail\n=HYPERLINK(\"https://example.test\")\n  @SUM(A1)\n\u202Ehidden",
    });

    expect(text).toContain("  First line\n  Second line with detail");
    expect(text).toContain("  '=HYPERLINK");
    expect(text).toContain("  '  @SUM(A1)");
    expect(text).not.toContain("\u0000");
    expect(text).not.toContain("\u202E");
    expect(text).not.toContain("\t");
    expect(text).not.toContain("\r");
  });
});
