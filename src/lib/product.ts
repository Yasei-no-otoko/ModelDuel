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
  livePilotScope: string;
  interpretSummary: string;
  scientificTitle: string;
  scientificBullets: readonly string[];
  hiddenEvidenceCopy: string;
  sealedCaseCopy: string;
  revisionPlaceholder: string;
  transferEyebrow: string;
  traceObservationLabel: string;
  teacherNextQuestion: string;
  teacherListenForCorrect: string;
  teacherListenForNeedsSupport: string;
}>;

export const SCENARIO_CONTENT = {
  "moon-phases": {
    label: "Moon phases",
    topic: "Earth shadow vs. viewing angle",
    progressLabel: "Moon challenge progress",
    sampleMisconception:
      "The Moon changes shape because Earth's shadow moves across it.",
    heroSummary:
      "Pit the common claim that Earth's shadow causes Moon phases against the sunlight-and-viewing-angle model, then run both worlds under one sealed test.",
    capturePrompt: "What causes the Moon's phases?",
    livePilotScope:
      "This pilot compares the Earth-shadow claim with the sunlight-and-viewing-angle model. GPT maps your explanation to that validated contrast; it does not generate a new physics world.",
    interpretSummary:
      "We turned the explanation into a learner world and paired it with the scientific model under the same test.",
    scientificTitle: "Sunlight and viewing angle",
    scientificBullets: [
      "The Sun illuminates half of the Moon.",
      "The visible fraction changes with the Moon's position around Earth.",
      "Earth's shadow is reserved for lunar eclipses.",
    ],
    hiddenEvidenceCopy:
      "Moon–Sun–Earth geometry, illuminated fraction, Earth-shadow intersection, and the observed phase.",
    sealedCaseCopy:
      "The observation stays sealed until you lock a prediction and run both worlds.",
    revisionPlaceholder:
      "Explain how sunlight, the Moon's orbit, and the viewing angle account for the observed phase.",
    transferEyebrow: "Transfer test · Moon phases",
    traceObservationLabel: "Verified observation · lunar evidence",
    teacherNextQuestion:
      "What would you expect to observe if Earth's shadow caused every phase, and how does that differ from the sunlight-and-viewing-angle model?",
    teacherListenForCorrect:
      "Listen for the learner to distinguish regular phases from eclipses and connect the illuminated fraction to Moon–Sun–Earth geometry.",
    teacherListenForNeedsSupport:
      "Listen for the learner to identify which half of the Moon sunlight illuminates and which half faces Earth at new moon before selecting an arrangement.",
  },
  seasons: {
    label: "Seasons",
    topic: "Distance vs. axial tilt",
    progressLabel: "Seasons challenge progress",
    sampleMisconception:
      "Summer happens because Earth moves closer to the Sun, so both hemispheres should warm together.",
    heroSummary:
      "Pit the distance-only explanation for summer against Earth's tilted-axis model, then test both hemispheres under one sealed June case.",
    capturePrompt: "What causes Earth's seasons?",
    livePilotScope:
      "This pilot compares the distance-only claim with the axial-tilt model. GPT maps your explanation to that validated contrast; it does not generate a new physics world.",
    interpretSummary:
      "We turned the distance explanation into a learner world and paired it with the axial-tilt model under the same June test.",
    scientificTitle: "Axial tilt and sunlight angle",
    scientificBullets: [
      "Earth's axis is tilted by 23.44°.",
      "In June, the Northern Hemisphere receives more direct sunlight while the Southern Hemisphere receives less.",
      "The hemispheres therefore experience opposite seasons even though both share the same Earth–Sun distance.",
    ],
    hiddenEvidenceCopy:
      "June geometry, sunlight angles, relative energy, and each hemisphere's seasonal result.",
    sealedCaseCopy:
      "The June observation and relative energy evidence stay sealed until you lock a prediction and run both worlds.",
    revisionPlaceholder:
      "Explain how axial tilt changes sunlight angle and produces opposite seasons in the two hemispheres.",
    transferEyebrow: "Transfer test · Seasons",
    traceObservationLabel: "Verified observation · seasonal evidence",
    teacherNextQuestion:
      "If Earth–Sun distance caused seasons, how could the two hemispheres have opposite seasons at the same time?",
    teacherListenForCorrect:
      "Listen for axial tilt changing sunlight angle and relative incoming energy in opposite ways while both hemispheres share one Earth–Sun distance.",
    teacherListenForNeedsSupport:
      "Listen for the learner to compare the June sunlight angle in both hemispheres before deciding whether one shared Earth–Sun distance can explain opposite seasons.",
  },
} as const satisfies Record<ScenarioId, ScenarioContent>;
