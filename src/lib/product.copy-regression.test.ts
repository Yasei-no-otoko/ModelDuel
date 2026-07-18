import { describe, expect, it } from "vitest";

import { SCENARIO_CONTENT } from "./product";

describe("learner-facing scenario catalog copy", () => {
  it("describes hidden evidence with scenario-specific scientific language", () => {
    expect(SCENARIO_CONTENT["moon-phases"].hiddenEvidenceCopy).toBe(
      "Moon–Sun–Earth geometry, illuminated fraction, Earth-shadow intersection, and the observed phase.",
    );
    expect(SCENARIO_CONTENT.seasons.hiddenEvidenceCopy).toBe(
      "June geometry, sunlight angles, relative energy, and each hemisphere's seasonal result.",
    );
  });

  it("keeps internal CaseSpec terminology out of learner-facing catalog copy", () => {
    for (const content of Object.values(SCENARIO_CONTENT)) {
      const learnerCopy = [
        content.label,
        content.topic,
        content.progressLabel,
        content.sampleMisconception,
        content.heroSummary,
        content.capturePrompt,
        content.livePilotScope,
        content.interpretSummary,
        content.scientificTitle,
        ...content.scientificBullets,
        content.hiddenEvidenceCopy,
        content.sealedCaseCopy,
        content.revisionPlaceholder,
        content.transferEyebrow,
        content.traceObservationLabel,
        content.teacherNextQuestion,
        content.teacherListenForCorrect,
        content.teacherListenForNeedsSupport,
      ].join(" ");

      expect(learnerCopy).not.toMatch(/CaseSpec/i);
      expect(learnerCopy).not.toMatch(/GPT-5\.6-(?:Terra|Luna)|grade|mastery/i);
    }
  });

  it("keeps the validated pilot scope and teacher debrief deterministic", () => {
    expect(SCENARIO_CONTENT["moon-phases"]).toMatchObject({
      livePilotScope:
        "This pilot compares the Earth-shadow claim with the sunlight-and-viewing-angle model. GPT maps your explanation to that validated contrast; it does not generate a new physics world.",
      teacherNextQuestion:
        "What would you expect to observe if Earth's shadow caused every phase, and how does that differ from the sunlight-and-viewing-angle model?",
      teacherListenForCorrect:
        "Listen for the learner to distinguish regular phases from eclipses and connect the illuminated fraction to Moon–Sun–Earth geometry.",
      teacherListenForNeedsSupport:
        "Listen for the learner to identify which half of the Moon sunlight illuminates and which half faces Earth at new moon before selecting an arrangement.",
    });
    expect(SCENARIO_CONTENT.seasons).toMatchObject({
      livePilotScope:
        "This pilot compares the distance-only claim with the axial-tilt model. GPT maps your explanation to that validated contrast; it does not generate a new physics world.",
      teacherNextQuestion:
        "If Earth–Sun distance caused seasons, how could the two hemispheres have opposite seasons at the same time?",
      teacherListenForCorrect:
        "Listen for axial tilt changing sunlight angle and relative incoming energy in opposite ways while both hemispheres share one Earth–Sun distance.",
      teacherListenForNeedsSupport:
        "Listen for the learner to compare the June sunlight angle in both hemispheres before deciding whether one shared Earth–Sun distance can explain opposite seasons.",
    });
  });
});
