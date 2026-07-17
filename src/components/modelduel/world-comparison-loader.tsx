"use client";

import dynamic from "next/dynamic";

export function loadWorldComparison() {
  return import("./WorldComparison").then((module) => module.WorldComparison);
}

export function WorldComparisonLoading() {
  return (
    <section
      className="world-comparison-loading"
      role="status"
      aria-live="polite"
      aria-label="Loading interactive evidence comparison"
    >
      <div className="comparison-loading-worlds" aria-hidden="true">
        <span />
        <span />
      </div>
      <strong>Loading the two evidence worlds…</strong>
      <p>The verified observation and 2D fallback are being prepared.</p>
    </section>
  );
}

export const DynamicWorldComparison = dynamic(loadWorldComparison, {
  ssr: false,
  loading: WorldComparisonLoading,
});
