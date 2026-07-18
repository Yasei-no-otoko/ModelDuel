import {
  AnalysisResultSchema,
  LearnerModelSchema,
  ScenarioIdSchema,
} from "../../../lib/modelduel/schemas";
import type {
  AnalysisResult,
  LearnerModel,
} from "../../../lib/modelduel/schemas";
import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../../lib/modelduel/samples";
import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { ModelDuelUpstreamError } from "./errors";

export type RegistryPlan = Readonly<{
  scenarioId: AnalysisResult["scenarioId"];
  misconceptionType: LearnerModel["misconceptionType"];
  analysisTemplate: AnalysisResult;
  caseId: string;
  caseFingerprint: string;
  learnerWorldId: string;
  scientificWorldId: string;
}>;

function planFromSample(sampleInput: unknown): RegistryPlan {
  const sample = AnalysisResultSchema.parse(sampleInput);
  return {
    scenarioId: sample.scenarioId,
    misconceptionType: sample.learnerModel.misconceptionType,
    analysisTemplate: sample,
    caseId: sample.caseSpec.id,
    caseFingerprint: createCaseFingerprint(sample.caseSpec),
    learnerWorldId: sample.learnerWorld.worldId,
    scientificWorldId: sample.scientificWorld.worldId,
  };
}

const MOON_PLAN = planFromSample(MOON_HERO_SAMPLE);
const SEASONS_PLAN = planFromSample(SEASONS_SAMPLE);

export function resolveRegistryPlan(input: {
  scenarioId: string;
  learnerModel: LearnerModel;
}): RegistryPlan {
  const scenarioId = ScenarioIdSchema.safeParse(input.scenarioId);
  const learnerModel = LearnerModelSchema.safeParse(input.learnerModel);
  if (!scenarioId.success || !learnerModel.success) {
    throw new ModelDuelUpstreamError("MODEL_OUTPUT_INVALID");
  }

  if (
    scenarioId.data === "moon-phases" &&
    learnerModel.data.misconceptionType === "earth-shadow-phases"
  ) {
    return MOON_PLAN;
  }
  if (
    scenarioId.data === "seasons" &&
    learnerModel.data.misconceptionType === "distance-causes-seasons"
  ) {
    return SEASONS_PLAN;
  }
  throw new ModelDuelUpstreamError("UNSUPPORTED_MISCONCEPTION");
}

export function resolveRegistryIdentity(input: {
  scenarioId: string;
  misconceptionType: LearnerModel["misconceptionType"];
  caseId: string;
  caseFingerprint: string;
  learnerWorldId: string;
  scientificWorldId: string;
}): RegistryPlan {
  const plan =
    input.scenarioId === MOON_PLAN.scenarioId
      ? MOON_PLAN
      : input.scenarioId === SEASONS_PLAN.scenarioId
        ? SEASONS_PLAN
        : undefined;
  if (
    !plan ||
    input.misconceptionType !== plan.misconceptionType ||
    input.caseId !== plan.caseId ||
    input.caseFingerprint !== plan.caseFingerprint ||
    input.learnerWorldId !== plan.learnerWorldId ||
    input.scientificWorldId !== plan.scientificWorldId
  ) {
    throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
  }
  return plan;
}
