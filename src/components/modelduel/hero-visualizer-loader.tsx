"use client";

import dynamic from "next/dynamic";

import {
  HERO_COMPLETE_SUMMARY,
  HeroVisualizerFallback,
} from "./hero-visualizer-fallback";

export function loadHeroVisualizer() {
  return import("./HeroVisualizer").then((module) => module.HeroVisualizer);
}

export function HeroVisualizerLoading() {
  const summaryId = "hero-visualizer-loading-summary";
  return (
    <figure className="hero-visualizer hero-visualizer-loading" aria-label="Loading the model comparison">
      <p className="sr-only" id={summaryId}>
        {HERO_COMPLETE_SUMMARY}
      </p>
      <div className="hero-visualizer-heading">
        <span>Model comparison</span>
        <span>Preparing 3D view</span>
      </div>
      <div className="hero-visualizer-viewport">
        <HeroVisualizerFallback descriptionId={summaryId} focus="evidence" />
      </div>
      <figcaption>
        <strong>Two proposed models will meet one shared observation.</strong>
        <span>The complete comparison remains available without WebGL.</span>
      </figcaption>
    </figure>
  );
}

export const DynamicHeroVisualizer = dynamic(loadHeroVisualizer, {
  ssr: false,
  loading: HeroVisualizerLoading,
});
