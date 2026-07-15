"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type {
  MoonCaseSpec,
  MoonSimulationObservation,
  SeasonsCaseSpec,
  SeasonsSimulationObservation,
} from "@/lib/modelduel";

import {
  usePrefersReducedMotion,
  useWebGlAvailability,
} from "./browser";

type WorldKind = "learner" | "scientific";

type CanvasBoundaryProps = Readonly<{
  children: ReactNode;
  fallback: ReactNode;
}>;

class CanvasBoundary extends Component<
  CanvasBoundaryProps,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The surrounding semantic fallback carries the same observation.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function CameraRig({ angle }: Readonly<{ angle: number }>) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const radius = 8.8;
    camera.position.set(
      Math.sin(angle) * radius,
      4.8,
      Math.cos(angle) * radius,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [angle, camera, invalidate]);

  return null;
}

function LightRay({ y }: Readonly<{ y: number }>) {
  return (
    <mesh position={[2.35, y, -0.35]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.012, 0.012, 4.5, 8]} />
      <meshBasicMaterial color="#ffd76a" transparent opacity={0.42} />
    </mesh>
  );
}

function WorldScene({
  kind,
  caseSpec,
}: Readonly<{ kind: WorldKind; caseSpec: MoonCaseSpec }>) {
  const theta = (caseSpec.elongationDeg * Math.PI) / 180;
  const moonPosition: [number, number, number] = [
    Math.cos(theta) * 3,
    Math.sin(theta) * 3,
    0,
  ];

  return (
    <>
      <color attach="background" args={["#060b1d"]} />
      <ambientLight intensity={0.18} />
      <directionalLight color="#fff0bb" intensity={2.8} position={[5, 0, 1]} />

      <mesh position={[5, 0, 0]}>
        <sphereGeometry args={[0.55, 32, 20]} />
        <meshBasicMaterial color="#ffd76a" />
      </mesh>
      <pointLight color="#ffd76a" intensity={30} distance={12} position={[5, 0, 0]} />

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.56, 32, 20]} />
        <meshStandardMaterial color="#337bd4" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0, 0]} scale={1.03}>
        <sphereGeometry args={[0.56, 20, 12]} />
        <meshBasicMaterial color="#57e2f2" wireframe transparent opacity={0.12} />
      </mesh>

      <mesh position={moonPosition}>
        <sphereGeometry args={[0.34, 32, 20]} />
        <meshStandardMaterial color="#e5e9f3" roughness={0.82} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3, 0.012, 8, 96]} />
        <meshBasicMaterial color="#7785b5" transparent opacity={0.35} />
      </mesh>

      {kind === "learner" ? (
        <mesh position={[-2.05, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.72, 3.2, 32, 1, true]} />
          <meshBasicMaterial
            color="#6e61b8"
            side={2}
            transparent
            opacity={0.2}
          />
        </mesh>
      ) : (
        <>
          <LightRay y={-0.52} />
          <LightRay y={0} />
          <LightRay y={0.52} />
          <mesh position={[moonPosition[0] / 2, moonPosition[1] / 2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 3, 8]} />
            <meshBasicMaterial color="#57e2f2" transparent opacity={0.42} />
          </mesh>
        </>
      )}
    </>
  );
}

function HtmlWorldFallback({
  observation,
  kind,
}: Readonly<{
  observation: MoonSimulationObservation;
  kind: WorldKind;
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
      <p>Accessible diagram fallback. The text observation below contains the same evidence.</p>
    </div>
  );
}

function WorldViewport({
  observation,
  caseSpec,
  kind,
}: Readonly<{
  observation: MoonSimulationObservation;
  caseSpec: MoonCaseSpec;
  kind: WorldKind;
}>) {
  const [cameraAngle, setCameraAngle] = useState(0);
  const dragStart = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const fallback = <HtmlWorldFallback observation={observation} kind={kind} />;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const delta = event.clientX - dragStart.current;
    if (Math.abs(delta) >= 2) {
      setCameraAngle((angle) => angle - delta * 0.012);
      dragStart.current = event.clientX;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="world-viewport-shell">
      <div
        className="world-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {webglAvailable ? (
          <CanvasBoundary fallback={fallback}>
            <Canvas
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} model 3D view. Drag horizontally or use the view buttons to orbit.`}
              camera={{ fov: 43, near: 0.1, far: 100, position: [0, 4.8, 8.8] }}
              dpr={reducedMotion ? 1 : [1, 1.5]}
              frameloop="demand"
              gl={{ antialias: !reducedMotion, alpha: false }}
            >
              <CameraRig angle={cameraAngle} />
              <WorldScene kind={kind} caseSpec={caseSpec} />
            </Canvas>
          </CanvasBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="view-controls" role="group" aria-label={`${kind} model camera view`}>
        <button
          type="button"
          onClick={() => setCameraAngle((angle) => angle - Math.PI / 8)}
          aria-label={`Rotate ${kind} model view left`}
        >
          ←
        </button>
        <button type="button" onClick={() => setCameraAngle(0)}>
          Reset view
        </button>
        <button
          type="button"
          onClick={() => setCameraAngle((angle) => angle + Math.PI / 8)}
          aria-label={`Rotate ${kind} model view right`}
        >
          →
        </button>
      </div>
    </div>
  );
}

function WorldCard({
  kind,
  observation,
  caseSpec,
}: Readonly<{
  kind: WorldKind;
  observation: MoonSimulationObservation;
  caseSpec: MoonCaseSpec;
}>) {
  const isLearner = kind === "learner";

  return (
    <article className={`evidence-world ${isLearner ? "learner" : "scientific"}`}>
      <header>
        <span className="world-letter" aria-hidden="true">
          {isLearner ? "A" : "B"}
        </span>
        <div>
          <p>{isLearner ? "Learner world" : "Scientific world"}</p>
          <h3>{isLearner ? "Earth-shadow claim" : "Illumination + viewing angle"}</h3>
        </div>
      </header>

      <WorldViewport observation={observation} caseSpec={caseSpec} kind={kind} />

      <div className="prediction-block">
        <span>Model prediction</span>
        <strong>
          {isLearner
            ? "An Earth-shadow mask causes the visible half."
            : "The Sun lights one half; Earth sees it from the side."}
        </strong>
        <p>
          Predicted visible illumination: {Math.round(
            observation.modelPrediction.predictedIlluminationFraction * 100,
          )}%
        </p>
      </div>
    </article>
  );
}

function MoonComparison({
  caseSpec,
  learner,
  scientific,
}: Readonly<{
  caseSpec: MoonCaseSpec;
  learner: MoonSimulationObservation;
  scientific: MoonSimulationObservation;
}>) {
  const physical = scientific.physicalObservation;

  return (
    <section className="world-comparison" aria-labelledby="world-comparison-title">
      <div className="case-toolbar">
        <div>
          <p className="micro-label">Same deterministic test case</p>
          <h2 id="world-comparison-title">Run both worlds. Compare one observation.</h2>
        </div>
        <div className="case-control" role="group" aria-label="Test case selection">
          <button type="button" aria-pressed="true">
            First quarter · {caseSpec.elongationDeg}°
          </button>
        </div>
      </div>

      <div className="evidence-worlds">
        <WorldCard kind="learner" observation={learner} caseSpec={caseSpec} />
        <WorldCard kind="scientific" observation={scientific} caseSpec={caseSpec} />
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
            This is simulation evidence calculated from the validated test case. A model’s
            claim is shown separately above and is never treated as physical evidence.
          </p>
        </div>
      </article>
      <p className="scale-note">Visualization uses exaggerated body sizes and normalized distances. Not to scale.</p>
    </section>
  );
}

type SeasonsWorldKind = "learner" | "scientific";

function SeasonsWorldScene({
  caseSpec,
  observation,
}: Readonly<{
  caseSpec: SeasonsCaseSpec;
  observation: SeasonsSimulationObservation;
}>) {
  const visualTiltDeg =
    observation.modelPrediction.basis === "distance-only"
      ? 0
      : caseSpec.observedAxialTiltDeg;
  const tiltRadians = (visualTiltDeg * Math.PI) / 180;

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[-3, 0, 0]} intensity={3.2} color="#fff3c4" />
      <mesh position={[-3, 0, 0]}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshBasicMaterial color="#ffd36a" />
      </mesh>
      <group position={[1.1, 0, 0]} rotation={[0, 0, tiltRadians]}>
        <mesh>
          <sphereGeometry args={[0.88, 32, 32]} />
          <meshStandardMaterial color="#3f88c5" roughness={0.78} />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial color="#89d17c" />
        </mesh>
        <mesh position={[0, -0.98, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial color="#b9ddff" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, 2.7, 12]} />
          <meshBasicMaterial color="#f4f8ff" />
        </mesh>
      </group>
    </>
  );
}

function SeasonsHtmlFallback({
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

function SeasonsWorldViewport({
  observation,
  caseSpec,
  kind,
}: Readonly<{
  observation: SeasonsSimulationObservation;
  caseSpec: SeasonsCaseSpec;
  kind: SeasonsWorldKind;
}>) {
  const [cameraAngle, setCameraAngle] = useState(0);
  const dragStart = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const fallback = (
    <SeasonsHtmlFallback caseSpec={caseSpec} observation={observation} />
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const delta = event.clientX - dragStart.current;
    if (Math.abs(delta) >= 2) {
      setCameraAngle((angle) => angle - delta * 0.012);
      dragStart.current = event.clientX;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="world-viewport-shell">
      <div
        className="world-viewport seasons-world-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {webglAvailable ? (
          <CanvasBoundary fallback={fallback}>
            <Canvas
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} seasons model 3D view. Drag horizontally or use the view buttons to orbit.`}
              camera={{ fov: 43, near: 0.1, far: 100, position: [0, 4.8, 8.8] }}
              dpr={reducedMotion ? 1 : [1, 1.5]}
              frameloop="demand"
              gl={{ antialias: !reducedMotion, alpha: false }}
            >
              <CameraRig angle={cameraAngle} />
              <SeasonsWorldScene caseSpec={caseSpec} observation={observation} />
            </Canvas>
          </CanvasBoundary>
        ) : (
          fallback
        )}
      </div>
      <div
        className="view-controls"
        role="group"
        aria-label={`${kind} seasons model camera view`}
      >
        <button
          type="button"
          onClick={() => setCameraAngle((angle) => angle - Math.PI / 8)}
          aria-label={`Rotate ${kind} seasons model view left`}
        >
          ←
        </button>
        <button type="button" onClick={() => setCameraAngle(0)}>
          Reset view
        </button>
        <button
          type="button"
          onClick={() => setCameraAngle((angle) => angle + Math.PI / 8)}
          aria-label={`Rotate ${kind} seasons model view right`}
        >
          →
        </button>
      </div>
    </div>
  );
}

function SeasonsWorldCard({
  kind,
  caseSpec,
  observation,
}: Readonly<{
  kind: SeasonsWorldKind;
  caseSpec: SeasonsCaseSpec;
  observation: SeasonsSimulationObservation;
}>) {
  const prediction = observation.modelPrediction;
  const isLearner = kind === "learner";

  return (
    <article className={`evidence-world ${isLearner ? "learner" : "scientific"}`}>
      <header>
        <span className="world-letter" aria-hidden="true">
          {isLearner ? "A" : "B"}
        </span>
        <div>
          <p>{isLearner ? "Learner world" : "Scientific world"}</p>
          <h3>
            {isLearner
              ? "Distance-only seasonal prediction"
              : "Axial-tilt seasonal prediction"}
          </h3>
        </div>
      </header>

      <SeasonsWorldViewport
        kind={kind}
        caseSpec={caseSpec}
        observation={observation}
      />

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
}

function SeasonsComparison({
  caseSpec,
  learner,
  scientific,
}: Readonly<{
  caseSpec: SeasonsCaseSpec;
  learner: SeasonsSimulationObservation;
  scientific: SeasonsSimulationObservation;
}>) {
  const physical = scientific.physicalObservation;

  return (
    <section className="world-comparison" aria-labelledby="world-comparison-title">
      <div className="case-toolbar">
        <div>
          <p className="micro-label">Same deterministic test case</p>
          <h2 id="world-comparison-title">Run both worlds. Compare one observation.</h2>
        </div>
        <div className="case-control" role="group" aria-label="Test case selection">
          <button type="button" aria-pressed="true">
            June solstice · {caseSpec.earthSolarLongitudeDeg}° solar longitude
          </button>
        </div>
      </div>

      <div className="evidence-worlds">
        <SeasonsWorldCard kind="learner" observation={learner} caseSpec={caseSpec} />
        <SeasonsWorldCard kind="scientific" observation={scientific} caseSpec={caseSpec} />
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
            {physical.southernEnergy.toFixed(2)}. The shared Earth–Sun distance cannot
            explain the opposite hemispheres.
          </p>
        </div>
      </article>
      <p className="scale-note">
        Visualization is not to scale. Energy values are simplified relative incident-energy
        indices, not a full climate or day-length model; distance is included but is not the
        primary seasonal driver.
      </p>
    </section>
  );
}

type WorldComparisonProps =
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

export function WorldComparison(props: WorldComparisonProps) {
  return props.scenario === "moon-phases" ? (
    <MoonComparison
      caseSpec={props.caseSpec}
      learner={props.learner}
      scientific={props.scientific}
    />
  ) : (
    <SeasonsComparison
      caseSpec={props.caseSpec}
      learner={props.learner}
      scientific={props.scientific}
    />
  );
}
