"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { WebGLRenderer } from "three";
import {
  Component,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
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
import {
  MoonEvidenceDiagram,
  SeasonsEvidenceDiagram,
  type WorldComparisonProps,
} from "./semantic-evidence";

type WorldKind = "learner" | "scientific";

type CanvasBoundaryProps = Readonly<{
  children: ReactNode;
  fallback: ReactNode;
  onFailure: () => void;
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
    this.props.onFailure();
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

const CAMERA_ORBIT_STEP = Math.PI / 8;
let cachedThreeRendererAvailability: boolean | null = null;

function canCreateThreeRenderer() {
  if (cachedThreeRendererAvailability !== null) {
    return cachedThreeRendererAvailability;
  }
  if (typeof document === "undefined") return false;

  let renderer: WebGLRenderer | null = null;
  try {
    renderer = new WebGLRenderer({
      canvas: document.createElement("canvas"),
      antialias: false,
      alpha: false,
    });
    cachedThreeRendererAvailability = true;
  } catch {
    cachedThreeRendererAvailability = false;
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return cachedThreeRendererAvailability;
}

function useThreeRendererAvailability(webglAvailable: boolean | null) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setAvailable(webglAvailable === true && canCreateThreeRenderer());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [webglAvailable]);

  return available;
}

function formatCameraOrientation(angle: number) {
  const degrees = (angle * 180) / Math.PI;
  const normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  const rounded = Math.round(normalized * 10) / 10;
  return `${Object.is(rounded, -0) ? 0 : rounded} degrees`;
}

function CameraViewControls({
  cameraAngle,
  controlLabel,
  setCameraAngle,
  viewportId,
}: Readonly<{
  cameraAngle: number;
  controlLabel: string;
  setCameraAngle: Dispatch<SetStateAction<number>>;
  viewportId: string;
}>) {
  const [announcement, setAnnouncement] = useState("");
  const displayLabel = `${controlLabel.charAt(0).toUpperCase()}${controlLabel.slice(1)}`;

  function setAnnouncedAngle(nextAngle: number, action: string) {
    setCameraAngle(nextAngle);
    setAnnouncement(
      `${displayLabel} ${action}. Camera orientation ${formatCameraOrientation(nextAngle)}.`,
    );
  }

  const leftAngle = cameraAngle - CAMERA_ORBIT_STEP;
  const rightAngle = cameraAngle + CAMERA_ORBIT_STEP;

  return (
    <>
      <div className="view-controls" role="group" aria-label={`${controlLabel} camera controls`}>
        <button
          type="button"
          onClick={() => setAnnouncedAngle(leftAngle, "rotated left")}
          aria-controls={viewportId}
          aria-label={`Rotate ${controlLabel} left to ${formatCameraOrientation(leftAngle)}`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setAnnouncedAngle(0, "reset")}
          aria-controls={viewportId}
          aria-label={`Reset ${controlLabel} to 0 degrees`}
        >
          Reset view
        </button>
        <button
          type="button"
          onClick={() => setAnnouncedAngle(rightAngle, "rotated right")}
          aria-controls={viewportId}
          aria-label={`Rotate ${controlLabel} right to ${formatCameraOrientation(rightAngle)}`}
        >
          →
        </button>
      </div>
      <p className="sr-only camera-view-status" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
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
  const [canvasFailed, setCanvasFailed] = useState(false);
  const viewportId = useId();
  const dragStart = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const rendererAvailable = useThreeRendererAvailability(webglAvailable);
  const fallback = <MoonEvidenceDiagram observation={observation} kind={kind} />;

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
        id={viewportId}
        className="world-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {webglAvailable && rendererAvailable ? (
          <CanvasBoundary fallback={fallback} onFailure={() => setCanvasFailed(true)}>
            <Canvas
              role="img"
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} model 3D view. Camera orientation ${formatCameraOrientation(cameraAngle)}. Drag horizontally or use the view buttons to orbit.`}
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
      {webglAvailable && rendererAvailable && !canvasFailed ? (
        <CameraViewControls
          cameraAngle={cameraAngle}
          controlLabel={`${kind} model view`}
          setCameraAngle={setCameraAngle}
          viewportId={viewportId}
        />
      ) : (
        <p className="static-view-note">Static evidence view · camera controls are not needed.</p>
      )}
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

      <p
        className="mobile-evidence-preview"
        data-testid="mobile-evidence-preview"
        aria-hidden="true"
      >
        <strong>Verified observation:</strong>{" "}
        {Math.round(physical.illuminationFraction * 100)}% illuminated; Earth-shadow
        intersection: {physical.earthShadowIntersection}.
      </p>

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
  const [canvasFailed, setCanvasFailed] = useState(false);
  const viewportId = useId();
  const dragStart = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const rendererAvailable = useThreeRendererAvailability(webglAvailable);
  const fallback = (
    <SeasonsEvidenceDiagram caseSpec={caseSpec} observation={observation} />
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
        id={viewportId}
        className="world-viewport seasons-world-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {webglAvailable && rendererAvailable ? (
          <CanvasBoundary fallback={fallback} onFailure={() => setCanvasFailed(true)}>
            <Canvas
              role="img"
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} seasons model 3D view. Camera orientation ${formatCameraOrientation(cameraAngle)}. Drag horizontally or use the view buttons to orbit.`}
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
      {webglAvailable && rendererAvailable && !canvasFailed ? (
        <CameraViewControls
          cameraAngle={cameraAngle}
          controlLabel={`${kind} seasons model view`}
          setCameraAngle={setCameraAngle}
          viewportId={viewportId}
        />
      ) : (
        <p className="static-view-note">Static evidence view · camera controls are not needed.</p>
      )}
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
    <section
      className="world-comparison seasons-comparison"
      aria-labelledby="world-comparison-title"
    >
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

      <p
        className="mobile-evidence-preview"
        data-testid="mobile-evidence-preview"
        aria-hidden="true"
      >
        <strong>Verified observation:</strong> Northern Hemisphere {physical.northernSeason};
        Southern Hemisphere {physical.southernSeason}.
      </p>

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
