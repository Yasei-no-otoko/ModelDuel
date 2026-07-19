"use client";

import { Canvas } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import {
  Component,
  useId,
  useRef,
  useState,
  type Dispatch,
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
  useCompactViewport,
  usePrefersReducedMotion,
} from "./browser";
import {
  AngleArc,
  DirectionVector,
  EarthBody,
  MoonBody,
  OrbitRing,
  SunBody,
  ValueHalo,
} from "./ScenePrimitives";
import {
  MoonEvidenceDiagram,
  SeasonsEvidenceDiagram,
  type WorldComparisonProps,
} from "./semantic-evidence";
import {
  useThreeRendererAvailability,
  WebGlContextLossGuard,
} from "./ThreeCanvasRuntime";

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

const CAMERA_VIEWS = {
  overview: { angle: 0, label: "Case overview" },
  earth: { angle: Math.PI / 4, label: "Earth-side view" },
  plane: { angle: -Math.PI / 4, label: "Plane view" },
} as const;

type CameraView = keyof typeof CAMERA_VIEWS;

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

function CameraViewControls({
  cameraView,
  controlLabel,
  setCameraView,
  viewportId,
}: Readonly<{
  cameraView: CameraView;
  controlLabel: string;
  setCameraView: Dispatch<SetStateAction<CameraView>>;
  viewportId: string;
}>) {
  const [announcement, setAnnouncement] = useState("");
  const displayLabel = `${controlLabel.charAt(0).toUpperCase()}${controlLabel.slice(1)}`;

  function setAnnouncedView(nextView: CameraView) {
    setCameraView(nextView);
    setAnnouncement(`${displayLabel}: ${CAMERA_VIEWS[nextView].label}.`);
  }

  return (
    <>
      <div className="view-controls" role="group" aria-label={`${controlLabel} camera controls`}>
        {(Object.entries(CAMERA_VIEWS) as [CameraView, (typeof CAMERA_VIEWS)[CameraView]][]).map(
          ([view, config]) => (
            <button
              key={view}
              type="button"
              onClick={() => setAnnouncedView(view)}
              aria-controls={viewportId}
              aria-pressed={cameraView === view}
            >
              {config.label}
            </button>
          ),
        )}
      </div>
      <p className="sr-only camera-view-status" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}

function SceneEncodingLegend({
  items,
}: Readonly<{ items: ReadonlyArray<Readonly<{ className: string; text: string }>> }>) {
  return (
    <ul className="scene-encoding-legend" aria-label="Scene encoding legend">
      {items.map((item) => (
        <li key={item.text}>
          <i className={item.className} aria-hidden="true" />
          {item.text}
        </li>
      ))}
    </ul>
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
      <SunBody position={[5, 0, 0]} radius={0.55} />
      <EarthBody accent={kind === "learner" ? "#f2b765" : "#55dceb"} />
      <MoonBody position={moonPosition} />
      <OrbitRing
        color={kind === "learner" ? "#f2b765" : "#55dceb"}
        radius={3}
        rotation={[0, 0, 0]}
        opacity={0.42}
      />
      <AngleArc
        color="#68e4b2"
        position={[0, 0, 0.05]}
        radius={0.78}
        opacity={0.78}
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
        <mesh position={[-1.68, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
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
          <DirectionVector
            color="#f6c97d"
            start={[4.35, 0.34, 0.12]}
            end={[moonPosition[0] + 0.16, moonPosition[1] + 0.16, 0.12]}
            opacity={0.72}
            radius={0.022}
          />
        </>
      )}
      <DirectionVector
        color="#f6c97d"
        start={[4.35, -0.26, -0.12]}
        end={[0.62, -0.26, -0.12]}
        opacity={0.68}
        radius={0.02}
      />
      <DirectionVector
        color="#55dceb"
        start={[0, 0, 0.08]}
        end={[moonPosition[0], moonPosition[1], 0.08]}
        opacity={0.72}
        radius={0.018}
      />
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
  const [cameraView, setCameraView] = useState<CameraView>("overview");
  const [canvasFailed, setCanvasFailed] = useState(false);
  const viewportId = useId();
  const cameraViewRef = useRef<CameraView>("overview");
  const cameraControlRef = useRef<CameraControlHandle | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const compactViewport = useCompactViewport();
  const webglAvailable = useThreeRendererAvailability();
  const fallback = <MoonEvidenceDiagram observation={observation} kind={kind} />;

  const setControlledCameraView: Dispatch<SetStateAction<CameraView>> = (nextValue) => {
    const nextView =
      typeof nextValue === "function"
        ? nextValue(cameraViewRef.current)
        : nextValue;
    cameraViewRef.current = nextView;
    applyCameraAngle(cameraControlRef.current, CAMERA_VIEWS[nextView].angle);
    setCameraView(nextView);
  };

  return (
    <div className="world-viewport-shell moon-world-viewport-shell">
      <div
        id={viewportId}
        className="world-viewport"
        data-camera-state={cameraView}
      >
        {webglAvailable && !canvasFailed ? (
          <CanvasBoundary fallback={fallback} onFailure={() => setCanvasFailed(true)}>
            <Canvas
              role="img"
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} model 3D view. ${CAMERA_VIEWS[cameraView].label}. Use the named view buttons below.`}
              camera={{ fov: 43, near: 0.1, far: 100, position: [0, 4.8, 8.8] }}
              dpr={reducedMotion || compactViewport ? 1 : [1, 1.5]}
              frameloop="demand"
              gl={{ antialias: !reducedMotion, alpha: false, powerPreference: "default" }}
              onCreated={({ camera, invalidate }) => {
                const handle = {
                  camera: camera as PerspectiveCamera,
                  invalidate,
                };
                cameraControlRef.current = handle;
                applyCameraAngle(handle, CAMERA_VIEWS[cameraViewRef.current].angle);
              }}
            >
              <WebGlContextLossGuard onContextLoss={() => setCanvasFailed(true)} />
              <WorldScene kind={kind} caseSpec={caseSpec} />
            </Canvas>
          </CanvasBoundary>
        ) : (
          fallback
        )}
      </div>
      <SceneEncodingLegend
        items={
          kind === "learner"
            ? [
                { className: "legend-sunlight", text: "Sunlight direction" },
                { className: "legend-shadow", text: "Proposed umbra misses Moon" },
                { className: "legend-angle", text: `${caseSpec.elongationDeg}° sealed angle` },
              ]
            : [
                { className: "legend-sunlight", text: "Lit hemisphere" },
                { className: "legend-view", text: "Earth-to-Moon view" },
                { className: "legend-angle", text: `${caseSpec.elongationDeg}° sealed angle` },
              ]
        }
      />
      {webglAvailable && !canvasFailed ? (
        <CameraViewControls
          cameraView={cameraView}
          controlLabel={`${kind} model view`}
          setCameraView={setControlledCameraView}
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
  const visualTiltDeg = caseSpec.observedAxialTiltDeg;
  const tiltRadians = (visualTiltDeg * Math.PI) / 180;
  const accent = kind === "learner" ? "#f2b765" : "#55dceb";
  const northEnergyRadius =
    kind === "learner"
      ? 0.28
      : 0.2 + observation.physicalObservation.northernEnergy * 0.18;
  const southEnergyRadius =
    kind === "learner"
      ? 0.28
      : 0.2 + observation.physicalObservation.southernEnergy * 0.18;

  return (
    <>
      <color attach="background" args={["#060a12"]} />
      <fog attach="fog" args={["#060a12", 8, 16]} />
      <SunBody position={[-3.1, 0, 0]} radius={0.68} />
      <OrbitRing color={accent} radius={3.5} opacity={0.28} rotation={[Math.PI / 2, 0, 0]} />
      <DirectionVector color="#f6c97d" start={[-2.38, -0.44, -0.22]} end={[0.18, -0.44, -0.22]} opacity={0.58} radius={0.018} />
      <DirectionVector color="#f6c97d" start={[-2.38, 0.44, 0.22]} end={[0.18, 0.44, 0.22]} opacity={0.7} radius={0.018} />
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
        <ValueHalo
          color="#68e4b2"
          position={[0, 0.98, 0.04]}
          radius={northEnergyRadius}
          opacity={kind === "learner" ? 0.52 : 0.74}
        />
        <mesh position={[0, -0.98, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial color="#b9f4f8" emissive="#17334a" />
        </mesh>
        <ValueHalo
          color="#b9f4f8"
          position={[0, -0.98, 0.04]}
          radius={southEnergyRadius}
          opacity={kind === "learner" ? 0.52 : 0.74}
        />
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
  const [cameraView, setCameraView] = useState<CameraView>("overview");
  const [canvasFailed, setCanvasFailed] = useState(false);
  const viewportId = useId();
  const cameraViewRef = useRef<CameraView>("overview");
  const cameraControlRef = useRef<CameraControlHandle | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const compactViewport = useCompactViewport();
  const webglAvailable = useThreeRendererAvailability();
  const fallback = (
    <SeasonsEvidenceDiagram caseSpec={caseSpec} observation={observation} />
  );

  const setControlledCameraView: Dispatch<SetStateAction<CameraView>> = (nextValue) => {
    const nextView =
      typeof nextValue === "function"
        ? nextValue(cameraViewRef.current)
        : nextValue;
    cameraViewRef.current = nextView;
    applyCameraAngle(cameraControlRef.current, CAMERA_VIEWS[nextView].angle);
    setCameraView(nextView);
  };

  return (
    <div className="world-viewport-shell seasons-world-viewport-shell">
      <div
        id={viewportId}
        className="world-viewport seasons-world-viewport"
        data-camera-state={cameraView}
      >
        {webglAvailable && !canvasFailed ? (
          <CanvasBoundary fallback={fallback} onFailure={() => setCanvasFailed(true)}>
            <Canvas
              role="img"
              aria-label={`${kind === "learner" ? "Learner" : "Scientific"} seasons model 3D view. ${CAMERA_VIEWS[cameraView].label}. Use the named view buttons below.`}
              camera={{ fov: 43, near: 0.1, far: 100, position: [0, 4.8, 8.8] }}
              dpr={reducedMotion || compactViewport ? 1 : [1, 1.5]}
              frameloop="demand"
              gl={{ antialias: !reducedMotion, alpha: false, powerPreference: "default" }}
              onCreated={({ camera, invalidate }) => {
                const handle = {
                  camera: camera as PerspectiveCamera,
                  invalidate,
                };
                cameraControlRef.current = handle;
                applyCameraAngle(handle, CAMERA_VIEWS[cameraViewRef.current].angle);
              }}
            >
              <WebGlContextLossGuard onContextLoss={() => setCanvasFailed(true)} />
              <SeasonsWorldScene caseSpec={caseSpec} kind={kind} observation={observation} />
            </Canvas>
          </CanvasBoundary>
        ) : (
          fallback
        )}
      </div>
      <SceneEncodingLegend
        items={
          kind === "learner"
            ? [
                { className: "legend-distance", text: `${caseSpec.earthSunDistanceAu.toFixed(3)} AU shared distance` },
                { className: "legend-energy-equal", text: "Model predicts equal hemisphere response" },
                { className: "legend-axis", text: `${caseSpec.observedAxialTiltDeg.toFixed(2)}° physical axis retained` },
              ]
            : [
                { className: "legend-sunlight", text: "Incoming sunlight" },
                { className: "legend-energy", text: `Energy N ${observation.physicalObservation.northernEnergy.toFixed(2)} · S ${observation.physicalObservation.southernEnergy.toFixed(2)}` },
                { className: "legend-axis", text: `${caseSpec.observedAxialTiltDeg.toFixed(2)}° axial tilt` },
              ]
        }
      />
      {webglAvailable && !canvasFailed ? (
        <CameraViewControls
          cameraView={cameraView}
          controlLabel={`${kind} seasons model view`}
          setCameraView={setControlledCameraView}
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
            ? "Physical tilt is retained; the distance-only model still predicts the same season in both hemispheres."
            : "This model uses axial tilt to predict opposite seasons and unequal incident energy across the two hemispheres."}
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
