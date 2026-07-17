"use client";

import { Component, type ReactNode } from "react";

import type {
  MoonCaseSpec,
  MoonSimulationObservation,
  SeasonsCaseSpec,
  SeasonsSimulationObservation,
} from "@/lib/modelduel";

export type WorldComparisonProps =
  | Readonly<{
      scenario: "moon-phases";
      caseSpec: MoonCaseSpec;
      learner: MoonSimulationObservation;
      scientific: MoonSimulationObservation;
    }>
  | Readonly<{
      scenario: "seasons";
      caseSpec: SeasonsCaseSpec;
      learner: SeasonsSimulationObservation;
      scientific: SeasonsSimulationObservation;
    }>;

export function MoonEvidenceDiagram({
  observation,
  kind,
}: Readonly<{
  observation: MoonSimulationObservation;
  kind: "learner" | "scientific";
}>) {
  return (
    <div className="world-html-fallback" role="img" aria-label={observation.accessibleText}>
      <span className="fallback-sun" aria-hidden="true" />
      <span className="fallback-ray" aria-hidden="true" />
      <span className="fallback-earth" aria-hidden="true" />
      <span className="fallback-orbit" aria-hidden="true" />
      <span className="fallback-moon" aria-hidden="true" />
      {kind === "learner" ? (
        <span className="fallback-shadow" aria-hidden="true" />
      ) : null}
      <p>2D evidence diagram. The text observation below contains the same evidence.</p>
    </div>
  );
}

export function SeasonsEvidenceDiagram({
  caseSpec,
  observation,
}: Readonly<{
  caseSpec: SeasonsCaseSpec;
  observation: SeasonsSimulationObservation;
}>) {
  const prediction = observation.modelPrediction;
  const visualTiltDeg =
    prediction.basis === "distance-only" ? 0 : caseSpec.observedAxialTiltDeg;

  return (
    <div
      className="world-html-fallback seasons-html-fallback"
      role="img"
      aria-label={observation.accessibleText}
    >
      <div className="seasons-fallback-orbit" aria-hidden="true">
        <span className="seasons-fallback-sun" />
        <span
          className="seasons-fallback-earth"
          style={{ transform: `translateY(-50%) rotate(${visualTiltDeg}deg)` }}
        >
          <span className="seasons-fallback-axis" />
        </span>
      </div>
      <p>
        June case · displayed model axis {visualTiltDeg.toFixed(2)}° · model basis:{" "}
        {prediction.basis}
      </p>
      <p>
        Predicted North: {prediction.predictedNorthernSeason}; South:{" "}
        {prediction.predictedSouthernSeason}.
      </p>
    </div>
  );
}

type EvidenceRecoveryBoundaryProps = Readonly<{
  children: ReactNode;
  recovery: ReactNode;
}>;

export class EvidenceRecoveryBoundary extends Component<
  EvidenceRecoveryBoundaryProps,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The recovery view contains the complete deterministic evidence.
  }

  render() {
    return this.state.failed ? this.props.recovery : this.props.children;
  }
}

function RecoveryNotice() {
  return (
    <div className="comparison-recovery-notice" role="status" data-testid="comparison-recovery">
      <strong>The interactive 3D view could not open.</strong>
      <p>
        The same verified evidence is shown in the diagrams and text below. You can continue
        the learning journey.
      </p>
    </div>
  );
}

function RecoveryWorldHeader({
  kind,
  title,
}: Readonly<{
  kind: "learner" | "scientific";
  title: string;
}>) {
  return (
    <header>
      <span className="world-letter" aria-hidden="true">
        {kind === "learner" ? "A" : "B"}
      </span>
      <div>
        <p>{kind === "learner" ? "Learner world" : "Scientific world"}</p>
        <h3>{title}</h3>
      </div>
    </header>
  );
}

function SemanticMoonComparison(
  props: Extract<WorldComparisonProps, { scenario: "moon-phases" }>,
) {
  const physical = props.scientific.physicalObservation;
  return (
    <section className="world-comparison" aria-labelledby="world-comparison-title">
      <RecoveryNotice />
      <div className="case-toolbar">
        <div>
          <p className="micro-label">Same deterministic test case</p>
          <h2 id="world-comparison-title">Compare both worlds through verified evidence.</h2>
        </div>
      </div>
      <div className="evidence-worlds">
        {(["learner", "scientific"] as const).map((kind) => {
          const observation = props[kind];
          return (
            <article className={`evidence-world ${kind}`} key={kind}>
              <RecoveryWorldHeader
                kind={kind}
                title={kind === "learner" ? "Earth-shadow claim" : "Illumination + viewing angle"}
              />
              <div className="world-viewport-shell semantic-evidence-viewport">
                <MoonEvidenceDiagram observation={observation} kind={kind} />
              </div>
              <div className="prediction-block">
                <span>Model prediction</span>
                <strong>
                  {kind === "learner"
                    ? "An Earth-shadow mask causes the visible half."
                    : "The Sun lights one half; Earth sees it from the side."}
                </strong>
                <p>
                  Predicted visible illumination:{" "}
                  {Math.round(observation.modelPrediction.predictedIlluminationFraction * 100)}%
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <article className="verified-observation" data-testid="verified-observation">
        <div className="verified-icon" aria-hidden="true">✓</div>
        <div>
          <p>Verified physical observation · shared by both worlds</p>
          <h3>
            {Math.round(physical.illuminationFraction * 100)}% illuminated; Earth-shadow
            intersection: {physical.earthShadowIntersection}.
          </h3>
          <p>
            This is simulation evidence calculated from the validated test case. Model claims
            remain separate from physical evidence.
          </p>
        </div>
      </article>
    </section>
  );
}

function SemanticSeasonsComparison(
  props: Extract<WorldComparisonProps, { scenario: "seasons" }>,
) {
  const physical = props.scientific.physicalObservation;
  return (
    <section
      className="world-comparison seasons-comparison"
      aria-labelledby="world-comparison-title"
    >
      <RecoveryNotice />
      <div className="case-toolbar">
        <div>
          <p className="micro-label">Same deterministic test case</p>
          <h2 id="world-comparison-title">Compare both worlds through verified evidence.</h2>
        </div>
      </div>
      <div className="evidence-worlds">
        {(["learner", "scientific"] as const).map((kind) => {
          const observation = props[kind];
          const prediction = observation.modelPrediction;
          return (
            <article className={`evidence-world ${kind}`} key={kind}>
              <RecoveryWorldHeader
                kind={kind}
                title={kind === "learner" ? "Distance-only seasonal prediction" : "Axial-tilt seasonal prediction"}
              />
              <div className="world-viewport-shell semantic-evidence-viewport">
                <SeasonsEvidenceDiagram
                  caseSpec={props.caseSpec}
                  observation={observation}
                />
              </div>
              <div className="prediction-block">
                <span>Model prediction</span>
                <strong>
                  North: {prediction.predictedNorthernSeason}; South:{" "}
                  {prediction.predictedSouthernSeason}
                </strong>
                <p>
                  {prediction.predictsSameSeasonBothHemispheres
                    ? "This model predicts the same season in both hemispheres."
                    : "This model predicts opposite seasons in the two hemispheres."}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <article className="verified-observation" data-testid="verified-observation">
        <div className="verified-icon" aria-hidden="true">✓</div>
        <div>
          <p>Verified physical observation · shared by both worlds</p>
          <h3>
            Northern Hemisphere: {physical.northernSeason}; Southern Hemisphere:{" "}
            {physical.southernSeason}.
          </h3>
          <p>
            Solar declination {physical.solarDeclinationDeg.toFixed(2)}°. Relative incident
            energy index: north {physical.northernEnergy.toFixed(2)}, south{" "}
            {physical.southernEnergy.toFixed(2)}. The shared distance cannot explain the
            opposite hemispheres.
          </p>
        </div>
      </article>
    </section>
  );
}

export function SemanticWorldComparison(props: WorldComparisonProps) {
  return props.scenario === "moon-phases" ? (
    <SemanticMoonComparison {...props} />
  ) : (
    <SemanticSeasonsComparison {...props} />
  );
}
