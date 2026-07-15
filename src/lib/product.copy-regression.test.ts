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
        content.interpretSummary,
        content.scientificTitle,
        ...content.scientificBullets,
        content.hiddenEvidenceCopy,
        content.sealedCaseCopy,
        content.revisionPlaceholder,
        content.transferEyebrow,
        content.traceObservationLabel,
      ].join(" ");

      expect(learnerCopy).not.toMatch(/CaseSpec/i);
    }
  });
});
