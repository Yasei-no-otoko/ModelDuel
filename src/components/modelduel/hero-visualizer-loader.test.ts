import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  HERO_COMPLETE_SUMMARY,
  HeroVisualizerFallback,
} from "./hero-visualizer-fallback";

const loaderSource = readFileSync(
  fileURLToPath(new URL("./hero-visualizer-loader.tsx", import.meta.url)),
  "utf8",
);
const visualizerSource = readFileSync(
  fileURLToPath(new URL("./HeroVisualizer.tsx", import.meta.url)),
  "utf8",
);
const experienceSource = readFileSync(
  fileURLToPath(new URL("./ModelDuelExperience.tsx", import.meta.url)),
  "utf8",
);

describe("hero visualizer boundary", () => {
  it("keeps the Three.js scene behind a client-only dynamic loader", () => {
    expect(loaderSource).toContain('import("./HeroVisualizer")');
    expect(loaderSource).toContain("module.HeroVisualizer");
    expect(loaderSource).toContain("ssr: false");
    expect(loaderSource).not.toContain('from "./HeroVisualizer"');
    expect(experienceSource).toContain("<DynamicHeroVisualizer");
  });

  it("animates only when motion is allowed and keeps bounded DPR and native controls", () => {
    expect(visualizerSource).toContain(
      'frameloop={reducedMotion ? "demand" : "always"}',
    );
    expect(visualizerSource).toContain("dpr={reducedMotion ? 1 : [1, 1.5]}");
    expect(visualizerSource).toContain("useFrame((_state, delta)");
    expect(visualizerSource).toContain('data-motion={reducedMotion ? "paused" : "running"}');
    expect(visualizerSource).toContain('role="group"');
    expect(visualizerSource).toContain('aria-pressed={focus === value}');
  });

  it("renders the full model-versus-evidence meaning without WebGL", () => {
    const markup = renderToStaticMarkup(
      createElement(HeroVisualizerFallback, { focus: "evidence" }),
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain(HERO_COMPLETE_SUMMARY);
    expect(markup).toContain("hero-fallback-learner");
    expect(markup).toContain("hero-fallback-science");
    expect(markup).toContain("hero-fallback-evidence");
  });
});
