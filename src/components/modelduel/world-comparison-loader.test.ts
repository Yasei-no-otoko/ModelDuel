import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { MOON_HERO_SAMPLE, simulateWorld } from "@/lib/modelduel";

import {
  EvidenceRecoveryBoundary,
  SemanticWorldComparison,
} from "./semantic-evidence";

const loaderSource = readFileSync(
  fileURLToPath(new URL("./world-comparison-loader.tsx", import.meta.url)),
  "utf8",
);
const experienceSource = readFileSync(
  fileURLToPath(new URL("./ModelDuelExperience.tsx", import.meta.url)),
  "utf8",
);
const semanticSource = readFileSync(
  fileURLToPath(new URL("./semantic-evidence.tsx", import.meta.url)),
  "utf8",
);

describe("WorldComparison split boundary", () => {
  it("keeps the named comparison export behind a client-only dynamic loader", () => {
    expect(loaderSource).toContain('import("./WorldComparison")');
    expect(loaderSource).toContain("module.WorldComparison");
    expect(loaderSource).toContain("ssr: false");
    expect(loaderSource).toContain("<EvidenceRecoveryBoundary");
    expect(experienceSource).not.toContain(
      'import { WorldComparison } from "./WorldComparison"',
    );
    expect(experienceSource).toContain("<ResilientWorldComparison");
    expect(experienceSource).toContain(
      "void loadWorldComparison().catch(() => undefined)",
    );
    expect(semanticSource).not.toContain("@react-three/fiber");
    expect(semanticSource).not.toContain('from "three"');
  });

  it("provides an accessible, layout-stable loading contract", () => {
    expect(loaderSource).toContain('className="world-comparison-loading"');
    expect(loaderSource).toContain('role="status"');
    expect(loaderSource).toContain('aria-live="polite"');
    expect(loaderSource).toContain(
      'aria-label="Loading interactive evidence comparison"',
    );
    expect(loaderSource).not.toContain("2D fallback");
  });

  it("renders complete semantic evidence after a forced outer-boundary error", () => {
    const caseSpec = MOON_HERO_SAMPLE.caseSpec;
    if (caseSpec.scenario !== "moon-phases") {
      throw new Error("Moon recovery fixture did not provide a Moon case.");
    }
    const learner = simulateWorld(
      MOON_HERO_SAMPLE.learnerWorld,
      caseSpec,
    );
    const scientific = simulateWorld(
      MOON_HERO_SAMPLE.scientificWorld,
      caseSpec,
    );
    if (learner.scenario !== "moon-phases" || scientific.scenario !== "moon-phases") {
      throw new Error("Moon recovery fixture did not produce Moon observations.");
    }
    const recovery = createElement(SemanticWorldComparison, {
      scenario: "moon-phases",
      caseSpec,
      learner,
      scientific,
    });
    const boundary = new EvidenceRecoveryBoundary({
      recovery,
      children: createElement("div", null, "Interactive comparison"),
    });
    boundary.state = EvidenceRecoveryBoundary.getDerivedStateFromError();

    const markup = renderToStaticMarkup(boundary.render());
    expect(markup).toContain('data-testid="comparison-recovery"');
    expect(markup).toContain("The interactive 3D view could not open.");
    expect(markup).toContain('data-testid="verified-observation"');
    expect(markup.match(/role="img"/g)).toHaveLength(2);
    expect(markup).toContain("You can continue the learning journey.");
  });
});
