import type { ScenarioId } from "./modelduel";

export const PRODUCT = {
  name: "ModelDuel",
  title: "ModelDuel | Evidence-led science learning",
  tagline: "Two models predict. Evidence decides.",
  category: "Education",
} as const;

export type LearningStep = {
  id: "explain" | "predict" | "observe" | "revise";
  label: "Explain" | "Predict" | "Observe" | "Revise";
  description: string;
};

export const LEARNING_STEPS = [
  {
    id: "explain",
    label: "Explain",
    description: "Put your current idea into words or a sketch.",
  },
  {
    id: "predict",
    label: "Predict",
    description: "Commit to what your model says will happen.",
  },
  {
    id: "observe",
    label: "Observe",
    description: "Run both worlds under the same conditions.",
  },
  {
    id: "revise",
    label: "Revise",
    description: "Use the evidence to rebuild your explanation.",
  },
] as const satisfies readonly LearningStep[];

export type ScenarioContent = Readonly<{
  label: string;
  topic: string;
  progressLabel: string;
  sampleMisconception: string;
  heroSummary: string;
  capturePrompt: string;
  interpretSummary: string;
  scientificTitle: string;
  scientificBullets: readonly string[];
  sealedCaseCopy: string;
  revisionPlaceholder: string;
  transferEyebrow: string;
  traceObservationLabel: string;
}>;

export const SCENARIO_CONTENT = {
  "moon-phases": {
    label: "Moon phases",
    topic: "Earth shadow vs. viewing angle",
    progressLabel: "Moon challenge progress",
    sampleMisconception:
      "The Moon changes shape because Earth's shadow moves across it.",
    heroSummary:
      "Explain what causes the Moon's phases, then compare two runnable worlds before the evidence is revealed.",
    capturePrompt: "What causes the Moon's phases?",
    interpretSummary:
      "We turned the explanation into a learner world and paired it with the scientific model under the same test.",
    scientificTitle: "Sunlight and viewing angle",
    scientificBullets: [
      "The Sun illuminates half of the Moon.",
      "The visible fraction changes with the Moon's position around Earth.",
      "Earth's shadow is reserved for lunar eclipses.",
    ],
    sealedCaseCopy:
      "The observation stays sealed until you lock a prediction and run both worlds.",
    revisionPlaceholder:
      "Explain how sunlight, the Moon's orbit, and the viewing angle account for the observed phase.",
    transferEyebrow: "Transfer test · Moon phases",
    traceObservationLabel: "Verified observation · lunar evidence",
  },
  seasons: {
    label: "Seasons",
    topic: "Distance vs. axial tilt",
    progressLabel: "Seasons challenge progress",
    sampleMisconception:
      "Summer happens because Earth moves closer to the Sun, so both hemispheres should warm together.",
    heroSummary:
      "Explain what causes seasons, then compare a distance-only world with Earth's tilted-axis world before the evidence is revealed.",
    capturePrompt: "What causes Earth's seasons?",
    interpretSummary:
      "We turned the distance explanation into a learner world and paired it with the axial-tilt model under the same June test.",
    scientificTitle: "Axial tilt and sunlight angle",
    scientificBullets: [
      "Earth's axis is tilted by 23.44°.",
      "In June, the Northern Hemisphere receives more direct sunlight while the Southern Hemisphere receives less.",
      "The hemispheres therefore experience opposite seasons even though both share the same Earth–Sun distance.",
    ],
    sealedCaseCopy:
      "The June observation and relative energy evidence stay sealed until you lock a prediction and run both worlds.",
    revisionPlaceholder:
      "Explain how axial tilt changes sunlight angle and produces opposite seasons in the two hemispheres.",
    transferEyebrow: "Transfer test · Seasons",
    traceObservationLabel: "Verified observation · seasonal evidence",
  },
} as const satisfies Record<ScenarioId, ScenarioContent>;
