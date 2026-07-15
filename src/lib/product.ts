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

export const SAMPLE_MISCONCEPTION =
  "The Moon changes shape because Earth's shadow moves across it.";
