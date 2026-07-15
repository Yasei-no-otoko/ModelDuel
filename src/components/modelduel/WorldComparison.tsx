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

export function WorldComparison({
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
            This is simulation evidence calculated from the validated CaseSpec. A model’s
            claim is shown separately above and is never treated as physical evidence.
          </p>
        </div>
      </article>
      <p className="scale-note">Visualization uses exaggerated body sizes and normalized distances. Not to scale.</p>
    </section>
  );
}
