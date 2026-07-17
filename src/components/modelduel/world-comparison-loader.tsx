"use client";

import dynamic from "next/dynamic";

import {
  EvidenceRecoveryBoundary,
  SemanticWorldComparison,
  type WorldComparisonProps,
} from "./semantic-evidence";

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
      <p>The verified observation and 2D evidence views are being prepared.</p>
    </section>
  );
}

export const DynamicWorldComparison = dynamic(loadWorldComparison, {
  ssr: false,
  loading: WorldComparisonLoading,
});

export function ResilientWorldComparison(props: WorldComparisonProps) {
  const recovery = <SemanticWorldComparison {...props} />;

  return props.scenario === "moon-phases" ? (
    <EvidenceRecoveryBoundary recovery={recovery}>
      <DynamicWorldComparison
        scenario="moon-phases"
        caseSpec={props.caseSpec}
        learner={props.learner}
        scientific={props.scientific}
      />
    </EvidenceRecoveryBoundary>
  ) : (
    <EvidenceRecoveryBoundary recovery={recovery}>
      <DynamicWorldComparison
        scenario="seasons"
        caseSpec={props.caseSpec}
        learner={props.learner}
        scientific={props.scientific}
      />
    </EvidenceRecoveryBoundary>
  );
}
