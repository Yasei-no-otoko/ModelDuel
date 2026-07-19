"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

import { usePrefersReducedMotion, useWebGlAvailability } from "./browser";
import {
  HERO_COMPLETE_SUMMARY,
  HeroVisualizerFallback,
  type HeroFocus,
} from "./hero-visualizer-fallback";
import {
  EarthBody,
  LightBeam,
  MoonBody,
  OrbitRing,
  SunBody,
  TechnicalStarField,
} from "./ScenePrimitives";

const FOCUS_COPY: Record<HeroFocus, string> = {
  learner: "Learner claim: Earth’s shadow is proposed as the cause.",
  scientific: "Scientific model: sunlight and viewing angle predict the phase.",
  evidence: "Shared evidence: the half-lit Moon appears without Earth-shadow intersection.",
};

type HeroCanvasBoundaryProps = Readonly<{
  children: ReactNode;
  fallback: ReactNode;
}>;

class HeroCanvasBoundary extends Component<
  HeroCanvasBoundaryProps,
  Readonly<{ failed: boolean }>
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The semantic diagram carries the complete comparison when WebGL fails.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function HeroCameraRig({ focus }: Readonly<{ focus: HeroFocus }>) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (focus === "learner") {
      camera.position.set(-2.35, 2.65, 7.4);
      camera.lookAt(-2.35, -0.05, 0);
    } else if (focus === "scientific") {
      camera.position.set(2.35, 2.65, 7.4);
      camera.lookAt(2.35, -0.05, 0);
    } else {
      camera.position.set(0, 3.25, 9.8);
      camera.lookAt(0, -0.35, 0);
    }
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, focus, invalidate]);

  return null;
}

function FocusRing({
  active,
  color,
  position,
}: Readonly<{
  active: boolean;
  color: string;
  position: [number, number, number];
}>) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.86, active ? 0.035 : 0.014, 10, 72]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={active ? 0.82 : 0.2}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function LearnerModel({ active }: Readonly<{ active: boolean }>) {
  return (
    <group position={[-2.35, 0.35, 0]}>
      <FocusRing active={active} color="#f2b765" position={[0, -0.05, 0]} />
      <EarthBody accent="#f2b765" radius={0.5} />
      <MoonBody position={[1.18, 0.62, 0]} radius={0.25} />
      <OrbitRing color="#f2b765" radius={1.34} opacity={active ? 0.56 : 0.28} />
      <mesh position={[0.9, 0.47, 0]} rotation={[0, 0, -0.99]}>
        <coneGeometry args={[0.42, 1.75, 32, 1, true]} />
        <meshBasicMaterial
          color="#9c78d4"
          side={2}
          transparent
          opacity={active ? 0.34 : 0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <LightBeam
        color="#f2b765"
        start={[-0.62, -0.85, 0]}
        end={[2.35, -2.15, 0]}
        opacity={active ? 0.62 : 0.25}
      />
    </group>
  );
}

function ScientificModel({ active }: Readonly<{ active: boolean }>) {
  return (
    <group position={[2.35, 0.35, 0]}>
      <FocusRing active={active} color="#55dceb" position={[0, -0.05, 0]} />
      <SunBody position={[-1.38, 0.1, 0]} radius={0.38} />
      <EarthBody accent="#55dceb" position={[0.25, 0, 0]} radius={0.48} />
      <MoonBody position={[1.25, 0.72, 0]} radius={0.24} />
      <OrbitRing color="#55dceb" radius={1.18} opacity={active ? 0.62 : 0.3} />
      <LightBeam
        color="#f6c97d"
        start={[-1.05, 0.34, 0.08]}
        end={[1.08, 0.88, 0.08]}
        opacity={active ? 0.68 : 0.3}
        radius={0.014}
      />
      <LightBeam
        color="#f6c97d"
        start={[-1.05, -0.08, -0.08]}
        end={[1.08, 0.5, -0.08]}
        opacity={active ? 0.54 : 0.24}
        radius={0.01}
      />
      <LightBeam
        color="#55dceb"
        start={[0.62, -0.82, 0]}
        end={[-2.35, -2.15, 0]}
        opacity={active ? 0.62 : 0.25}
      />
    </group>
  );
}

function EvidenceTarget({ active }: Readonly<{ active: boolean }>) {
  return (
    <group position={[0, -1.8, 0]}>
      <FocusRing active={active} color="#68e4b2" position={[0, 0, 0]} />
      <mesh rotation={[0, -0.35, 0]}>
        <sphereGeometry args={[0.39, 32, 18, 0, Math.PI]} />
        <meshStandardMaterial color="#e2e6e4" roughness={0.82} />
      </mesh>
      <mesh rotation={[0, -0.35, 0]}>
        <sphereGeometry args={[0.39, 32, 18, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#172332" roughness={0.96} />
      </mesh>
      <mesh scale={active ? 1.35 : 1.18}>
        <sphereGeometry args={[0.39, 24, 16]} />
        <meshBasicMaterial
          color="#68e4b2"
          transparent
          opacity={active ? 0.14 : 0.06}
          side={1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function HeroScene({ focus }: Readonly<{ focus: HeroFocus }>) {
  return (
    <>
      <color attach="background" args={["#060a12"]} />
      <fog attach="fog" args={["#060a12", 8, 16]} />
      <ambientLight intensity={0.46} />
      <directionalLight color="#d5f7ff" intensity={1.25} position={[0, 5, 5]} />
      <directionalLight color="#8d79c6" intensity={0.55} position={[-5, 1, -2]} />
      <TechnicalStarField opacity={0.46} />
      <LearnerModel active={focus === "learner"} />
      <ScientificModel active={focus === "scientific"} />
      <EvidenceTarget active={focus === "evidence"} />
    </>
  );
}

export function HeroVisualizer() {
  const [focus, setFocus] = useState<HeroFocus>("evidence");
  const viewportId = useId();
  const summaryId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const webglAvailable = useWebGlAvailability();
  const fallback = (
    <HeroVisualizerFallback descriptionId={summaryId} focus={focus} />
  );

  return (
    <figure className="hero-visualizer" data-testid="hero-visualizer">
      <p className="sr-only" id={summaryId}>
        {HERO_COMPLETE_SUMMARY}
      </p>
      <div className="hero-visualizer-heading">
        <span>Live model comparison</span>
        <span>One sealed test</span>
      </div>
      <div className="hero-visualizer-viewport" id={viewportId}>
        {webglAvailable ? (
          <HeroCanvasBoundary fallback={fallback}>
            <Canvas
              role="img"
              aria-label={`Interactive 3D model comparison. ${FOCUS_COPY[focus]}`}
              aria-describedby={summaryId}
              camera={{ fov: 38, near: 0.1, far: 100, position: [0, 3.25, 9.8] }}
              dpr={reducedMotion ? 1 : [1, 1.5]}
              frameloop="demand"
              gl={{ antialias: !reducedMotion, alpha: false, powerPreference: "high-performance" }}
            >
              <HeroCameraRig focus={focus} />
              <HeroScene focus={focus} />
            </Canvas>
          </HeroCanvasBoundary>
        ) : (
          fallback
        )}
        <div className="hero-world-labels" aria-hidden="true">
          <span className="learner-label">A · Learner claim</span>
          <span className="science-label">B · Scientific model</span>
          <span className="evidence-label">Verified observation</span>
        </div>
      </div>
      <div className="hero-focus-controls" role="group" aria-label="Focus the 3D comparison">
        {(
          [
            ["learner", "Learner claim"],
            ["scientific", "Science model"],
            ["evidence", "Shared evidence"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-controls={viewportId}
            aria-pressed={focus === value}
            onClick={() => setFocus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <figcaption>
        <strong>{FOCUS_COPY[focus]}</strong>
        <span>Exaggerated scale · deterministic geometry · drag-free view controls</span>
      </figcaption>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {FOCUS_COPY[focus]}
      </p>
    </figure>
  );
}
