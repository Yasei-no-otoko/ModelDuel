"use client";

import { Canvas } from "@react-three/fiber";
import { WebGLRenderer, type PerspectiveCamera } from "three";
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
  EarthBody,
  LightBeam,
  MoonBody,
  OrbitRing,
  SunBody,
  TechnicalStarField,
} from "./ScenePrimitives";
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

const CAMERA_ORBIT_STEP = Math.PI / 8;
let cachedThreeRendererAvailability: boolean | null = null;

type CameraControlHandle = Readonly<{
  camera: PerspectiveCamera;
  invalidate: () => void;
}>;

function applyCameraAngle(handle: CameraControlHandle | null, angle: number) {
  if (!handle) return;
  const radius = 8.8;
  handle.camera.position.set(
    Math.sin(angle) * radius,
    4.8,
    Math.cos(angle) * radius,
  );
  handle.camera.lookAt(0, 0, 0);
  handle.camera.updateProjectionMatrix();
  handle.invalidate();
}

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
      <color attach="background" args={["#060a12"]} />
      <fog attach="fog" args={["#060a12", 9, 18]} />
      <TechnicalStarField opacity={0.52} />
      <SunBody position={[5, 0, 0]} radius={0.55} />
      <EarthBody accent={kind === "learner" ? "#f2b765" : "#55dceb"} />
      <MoonBody position={moonPosition} />
      <OrbitRing
        color={kind === "learner" ? "#f2b765" : "#55dceb"}
        radius={3}
        opacity={0.42}
      />
      <mesh position={moonPosition} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.018, 8, 48]} />
        <meshBasicMaterial
          color={kind === "learner" ? "#f2b765" : "#68e4b2"}
          transparent
          opacity={0.64}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {kind === "learner" ? (
        <mesh position={[-2.05, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.82, 3.35, 32, 1, true]} />
          <meshBasicMaterial
            color="#9c78d4"
            side={2}
            transparent
            opacity={0.28}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <>
          <LightBeam color="#f6c97d" start={[4.45, -0.5, -0.28]} end={[-2.8, -0.5, -0.28]} />
          <LightBeam color="#f6c97d" start={[4.45, 0, 0]} end={[-2.8, 0, 0]} opacity={0.5} />
          <LightBeam color="#f6c97d" start={[4.45, 0.5, 0.28]} end={[-2.8, 0.5, 0.28]} />
          <LightBeam
            color="#f6c97d"
            start={[4.45, 0.32, 0.12]}
            end={[moonPosition[0] + 0.18, moonPosition[1] + 0.18, 0.12]}
            opacity={0.48}
          />
          <LightBeam
            color="#f6c97d"
            start={[4.45, -0.32, -0.12]}
            end={[moonPosition[0] - 0.18, moonPosition[1] - 0.18, -0.12]}
            opacity={0.4}
          />
          <LightBeam
            color="#55dceb"
            start={[0, 0, 0]}
            end={moonPosition}
            opacity={0.58}
            radius={0.015}
          />
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
  const cameraAngleRef = useRef(0);
  const cameraControlRef = useRef<CameraControlHandle | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const rendererAvailable = useThreeRendererAvailability(webglAvailable);
  const fallback = <MoonEvidenceDiagram observation={observation} kind={kind} />;

  const setControlledCameraAngle: Dispatch<SetStateAction<number>> = (nextValue) => {
    const nextAngle =
      typeof nextValue === "function"
        ? nextValue(cameraAngleRef.current)
        : nextValue;
    cameraAngleRef.current = nextAngle;
    applyCameraAngle(cameraControlRef.current, nextAngle);
    setCameraAngle(nextAngle);
  };

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const delta = event.clientX - dragStart.current;
    if (Math.abs(delta) >= 2) {
      cameraAngleRef.current -= delta * 0.012;
      applyCameraAngle(cameraControlRef.current, cameraAngleRef.current);
      dragStart.current = event.clientX;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    setCameraAngle(cameraAngleRef.current);
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
              onCreated={({ camera, invalidate }) => {
                const handle = {
                  camera: camera as PerspectiveCamera,
                  invalidate,
                };
                cameraControlRef.current = handle;
                applyCameraAngle(handle, cameraAngleRef.current);
              }}
            >
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
          setCameraAngle={setControlledCameraAngle}
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
  kind,
  observation,
}: Readonly<{
  caseSpec: SeasonsCaseSpec;
  kind: SeasonsWorldKind;
  observation: SeasonsSimulationObservation;
}>) {
  const visualTiltDeg =
    observation.modelPrediction.basis === "distance-only"
      ? 0
      : caseSpec.observedAxialTiltDeg;
  const tiltRadians = (visualTiltDeg * Math.PI) / 180;
  const accent = kind === "learner" ? "#f2b765" : "#55dceb";

  return (
    <>
      <color attach="background" args={["#060a12"]} />
      <fog attach="fog" args={["#060a12", 8, 16]} />
      <TechnicalStarField opacity={0.5} />
      <SunBody position={[-3.1, 0, 0]} radius={0.68} />
      <OrbitRing color={accent} radius={3.5} opacity={0.28} rotation={[Math.PI / 2, 0, 0]} />
      <LightBeam color="#f6c97d" start={[-2.42, -0.48, -0.26]} end={[0.24, -0.48, -0.26]} opacity={0.4} />
      <LightBeam color="#f6c97d" start={[-2.42, 0, 0]} end={[0.24, 0, 0]} opacity={0.52} />
      <LightBeam color="#f6c97d" start={[-2.42, 0.48, 0.26]} end={[0.24, 0.48, 0.26]} opacity={0.4} />
      <group position={[1.1, 0, 0]} rotation={[0, 0, tiltRadians]}>
        <EarthBody accent={accent} radius={0.88} />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.018, 8, 64]} />
          <meshBasicMaterial color={accent} transparent opacity={0.58} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial color="#68e4b2" emissive="#163b30" />
        </mesh>
        <mesh position={[0, -0.98, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial color="#b9f4f8" emissive="#17334a" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, 2.7, 12]} />
          <meshBasicMaterial color="#f4f8ff" toneMapped={false} />
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
  const cameraAngleRef = useRef(0);
  const cameraControlRef = useRef<CameraControlHandle | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const rendererAvailable = useThreeRendererAvailability(webglAvailable);
  const fallback = (
    <SeasonsEvidenceDiagram caseSpec={caseSpec} observation={observation} />
  );

  const setControlledCameraAngle: Dispatch<SetStateAction<number>> = (nextValue) => {
    const nextAngle =
      typeof nextValue === "function"
        ? nextValue(cameraAngleRef.current)
        : nextValue;
    cameraAngleRef.current = nextAngle;
    applyCameraAngle(cameraControlRef.current, nextAngle);
    setCameraAngle(nextAngle);
  };

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const delta = event.clientX - dragStart.current;
    if (Math.abs(delta) >= 2) {
      cameraAngleRef.current -= delta * 0.012;
      applyCameraAngle(cameraControlRef.current, cameraAngleRef.current);
      dragStart.current = event.clientX;
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = null;
    setCameraAngle(cameraAngleRef.current);
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
              onCreated={({ camera, invalidate }) => {
                const handle = {
                  camera: camera as PerspectiveCamera,
                  invalidate,
                };
                cameraControlRef.current = handle;
                applyCameraAngle(handle, cameraAngleRef.current);
              }}
            >
              <SeasonsWorldScene caseSpec={caseSpec} kind={kind} observation={observation} />
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
          setCameraAngle={setControlledCameraAngle}
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
