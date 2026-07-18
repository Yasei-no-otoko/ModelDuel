type ModelDuelLogoProps = Readonly<{
  className?: string;
}>;

export function ModelDuelLogo({ className }: ModelDuelLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      role="img"
      aria-label="ModelDuel"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="logo-orbit logo-orbit-learner"
        d="M7.5 31.5C12.5 26.2 14.4 18.9 13 8.5"
      />
      <path
        className="logo-orbit logo-orbit-science"
        d="M32.5 31.5C27.5 26.2 25.6 18.9 27 8.5"
      />
      <path className="logo-baseline" d="M8 31.5H32" />
      <circle className="logo-evidence-halo" cx="20" cy="20" r="5.25" />
      <circle className="logo-evidence-point" cx="20" cy="20" r="2.2" />
    </svg>
  );
}
