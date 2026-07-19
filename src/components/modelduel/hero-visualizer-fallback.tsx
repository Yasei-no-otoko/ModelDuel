export type HeroFocus = "learner" | "scientific" | "evidence";

export const HERO_COMPLETE_SUMMARY =
  "The learner model claims Earth’s shadow causes Moon phases. The scientific model uses sunlight and viewing angle. The shared half-lit Moon observation has no Earth-shadow intersection, so the scientific model explains the evidence.";

export function HeroVisualizerFallback({
  descriptionId,
  focus,
}: Readonly<{ descriptionId?: string; focus: HeroFocus }>) {
  return (
    <div
      className={`hero-visualizer-fallback focus-${focus}`}
      role="img"
      aria-label={descriptionId ? "Static model comparison" : HERO_COMPLETE_SUMMARY}
      aria-describedby={descriptionId}
      data-testid="hero-visualizer-fallback"
    >
      <div className="hero-fallback-world hero-fallback-learner" aria-hidden="true">
        <span className="hero-fallback-earth" />
        <span className="hero-fallback-moon" />
        <span className="hero-fallback-shadow" />
      </div>
      <div className="hero-fallback-world hero-fallback-science" aria-hidden="true">
        <span className="hero-fallback-sun" />
        <span className="hero-fallback-earth" />
        <span className="hero-fallback-moon" />
        <span className="hero-fallback-light" />
      </div>
      <span className="hero-fallback-evidence" aria-hidden="true" />
    </div>
  );
}
