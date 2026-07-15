import type * as Responses from "openai/resources/responses/responses";
import { z } from "zod";

import { WorldSpecSchema } from "../../../lib/modelduel/schemas";
import { simulateWorld } from "../../../lib/modelduel/simulation";
import { ModelDuelUpstreamError } from "./errors";
import type { RegistryPlan } from "./registry";

const IdSchema = z.string().trim().min(1).max(128);

const WorldPairArgsSchema = z.strictObject({
  learnerWorldId: IdSchema,
  scientificWorldId: IdSchema,
});
const SimulationArgsSchema = WorldPairArgsSchema.extend({
  caseId: IdSchema,
}).strict();
const CompareArgsSchema = SimulationArgsSchema;
const SelectArgsSchema = SimulationArgsSchema.extend({
  comparisonId: IdSchema,
}).strict();

const worldPairParameters = {
  type: "object",
  properties: {
    learnerWorldId: { type: "string" },
    scientificWorldId: { type: "string" },
  },
  required: ["learnerWorldId", "scientificWorldId"],
  additionalProperties: false,
} as const;

const simulationParameters = {
  type: "object",
  properties: {
    caseId: { type: "string" },
    learnerWorldId: { type: "string" },
    scientificWorldId: { type: "string" },
  },
  required: ["caseId", "learnerWorldId", "scientificWorldId"],
  additionalProperties: false,
} as const;

const validateWorldSpecTool = {
  type: "function",
  name: "validate_world_spec",
  description: "Validate both registry-owned world specifications by ID.",
  strict: true,
  allowed_callers: ["programmatic"],
  parameters: worldPairParameters,
  output_schema: {
    type: "object",
    properties: {
      learnerWorldId: { type: "string" },
      scientificWorldId: { type: "string" },
      valid: { type: "boolean" },
    },
    required: ["learnerWorldId", "scientificWorldId", "valid"],
    additionalProperties: false,
  },
} satisfies Responses.FunctionTool;

const simulateWorldTool = {
  type: "function",
  name: "simulate_world",
  description: "Run both registry-owned worlds for the registry-owned case.",
  strict: true,
  allowed_callers: ["programmatic"],
  parameters: simulationParameters,
  output_schema: {
    type: "object",
    properties: {
      caseId: { type: "string" },
      caseFingerprint: { type: "string" },
      learnerPredictionCode: { type: "string" },
      scientificPredictionCode: { type: "string" },
      learnerObservationCode: { type: "string" },
      scientificObservationCode: { type: "string" },
    },
    required: [
      "caseId",
      "caseFingerprint",
      "learnerPredictionCode",
      "scientificPredictionCode",
      "learnerObservationCode",
      "scientificObservationCode",
    ],
    additionalProperties: false,
  },
} satisfies Responses.FunctionTool;

const comparePredictionsTool = {
  type: "function",
  name: "compare_predictions",
  description: "Compare causal and observable predictions recomputed by the server.",
  strict: true,
  allowed_callers: ["programmatic"],
  parameters: simulationParameters,
  output_schema: {
    type: "object",
    properties: {
      comparisonId: { type: "string" },
      caseId: { type: "string" },
      different: { type: "boolean" },
      contrastScore: { type: "number" },
      learnerPredictionCode: { type: "string" },
      scientificPredictionCode: { type: "string" },
    },
    required: [
      "comparisonId",
      "caseId",
      "different",
      "contrastScore",
      "learnerPredictionCode",
      "scientificPredictionCode",
    ],
    additionalProperties: false,
  },
} satisfies Responses.FunctionTool;

const selectDiscriminatingCaseTool = {
  type: "function",
  name: "select_discriminating_case",
  description: "Select the registry case only after server-side contrast recomputation.",
  strict: true,
  allowed_callers: ["programmatic"],
  parameters: {
    type: "object",
    properties: {
      ...simulationParameters.properties,
      comparisonId: { type: "string" },
    },
    required: [...simulationParameters.required, "comparisonId"],
    additionalProperties: false,
  },
  output_schema: {
    type: "object",
    properties: {
      selectedCaseId: { type: "string" },
      caseFingerprint: { type: "string" },
      comparisonId: { type: "string" },
      contrastScore: { type: "number" },
      selected: { type: "boolean" },
    },
    required: [
      "selectedCaseId",
      "caseFingerprint",
      "comparisonId",
      "contrastScore",
      "selected",
    ],
    additionalProperties: false,
  },
} satisfies Responses.FunctionTool;

export const PROGRAMMATIC_TOOLS = [
  validateWorldSpecTool,
  simulateWorldTool,
  comparePredictionsTool,
  selectDiscriminatingCaseTool,
  { type: "programmatic_tool_calling" },
] satisfies Responses.Tool[];

export const REQUIRED_TOOL_NAMES = [
  "validate_world_spec",
  "simulate_world",
  "compare_predictions",
  "select_discriminating_case",
] as const;

export type RequiredToolName = (typeof REQUIRED_TOOL_NAMES)[number];

export type ToolExecution = Readonly<{
  name: RequiredToolName;
  output: string;
}>;

function requireIdentity(
  plan: RegistryPlan,
  input: {
    learnerWorldId: string;
    scientificWorldId: string;
    caseId?: string;
  },
): void {
  if (
    input.learnerWorldId !== plan.learnerWorldId ||
    input.scientificWorldId !== plan.scientificWorldId ||
    (input.caseId !== undefined && input.caseId !== plan.caseId)
  ) {
    throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
  }
}

function compactSimulation(plan: RegistryPlan) {
  const learner = simulateWorld(
    plan.analysisTemplate.learnerWorld,
    plan.analysisTemplate.caseSpec,
  );
  const scientific = simulateWorld(
    plan.analysisTemplate.scientificWorld,
    plan.analysisTemplate.caseSpec,
  );
  if (learner.scenario !== scientific.scenario) {
    throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
  }

  if (learner.scenario === "moon-phases" && scientific.scenario === "moon-phases") {
    return {
      caseId: plan.caseId,
      caseFingerprint: plan.caseFingerprint,
      learnerPredictionCode: `${learner.modelPrediction.cause}:${learner.modelPrediction.assumesEarthShadowMask}:${learner.modelPrediction.predictedIlluminationFraction}`,
      scientificPredictionCode: `${scientific.modelPrediction.cause}:${scientific.modelPrediction.assumesEarthShadowMask}:${scientific.modelPrediction.predictedIlluminationFraction}`,
      learnerObservationCode: `${learner.physicalObservation.illuminationFraction}:${learner.physicalObservation.earthShadowIntersection}`,
      scientificObservationCode: `${scientific.physicalObservation.illuminationFraction}:${scientific.physicalObservation.earthShadowIntersection}`,
    };
  }
  if (learner.scenario === "seasons" && scientific.scenario === "seasons") {
    return {
      caseId: plan.caseId,
      caseFingerprint: plan.caseFingerprint,
      learnerPredictionCode: `${learner.modelPrediction.basis}:${learner.modelPrediction.predictedNorthernSeason}:${learner.modelPrediction.predictedSouthernSeason}:${learner.modelPrediction.predictsSameSeasonBothHemispheres}`,
      scientificPredictionCode: `${scientific.modelPrediction.basis}:${scientific.modelPrediction.predictedNorthernSeason}:${scientific.modelPrediction.predictedSouthernSeason}:${scientific.modelPrediction.predictsSameSeasonBothHemispheres}`,
      learnerObservationCode: `${learner.physicalObservation.northernSeason}:${learner.physicalObservation.southernSeason}:${learner.physicalObservation.northernEnergy}:${learner.physicalObservation.southernEnergy}`,
      scientificObservationCode: `${scientific.physicalObservation.northernSeason}:${scientific.physicalObservation.southernSeason}:${scientific.physicalObservation.northernEnergy}:${scientific.physicalObservation.southernEnergy}`,
    };
  }
  throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
}

function recomputeComparison(plan: RegistryPlan) {
  const simulation = compactSimulation(plan);
  const different =
    simulation.learnerPredictionCode !== simulation.scientificPredictionCode;
  return {
    comparisonId: `comparison-${plan.caseId}`,
    caseId: plan.caseId,
    different,
    contrastScore: different ? 1 : 0,
    learnerPredictionCode: simulation.learnerPredictionCode,
    scientificPredictionCode: simulation.scientificPredictionCode,
  };
}

export function executeRegistryTool(
  plan: RegistryPlan,
  name: string,
  argumentsJson: string,
): ToolExecution {
  let json: unknown;
  try {
    json = JSON.parse(argumentsJson);
  } catch {
    throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
  }

  if (name === "validate_world_spec") {
    const args = WorldPairArgsSchema.safeParse(json);
    if (!args.success) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    requireIdentity(plan, args.data);
    WorldSpecSchema.parse(plan.analysisTemplate.learnerWorld);
    WorldSpecSchema.parse(plan.analysisTemplate.scientificWorld);
    return {
      name,
      output: JSON.stringify({
        learnerWorldId: plan.learnerWorldId,
        scientificWorldId: plan.scientificWorldId,
        valid: true,
      }),
    };
  }

  if (name === "simulate_world") {
    const args = SimulationArgsSchema.safeParse(json);
    if (!args.success) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    requireIdentity(plan, args.data);
    return { name, output: JSON.stringify(compactSimulation(plan)) };
  }

  if (name === "compare_predictions") {
    const args = CompareArgsSchema.safeParse(json);
    if (!args.success) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    requireIdentity(plan, args.data);
    const comparison = recomputeComparison(plan);
    if (!comparison.different) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    return { name, output: JSON.stringify(comparison) };
  }

  if (name === "select_discriminating_case") {
    const args = SelectArgsSchema.safeParse(json);
    if (!args.success) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    requireIdentity(plan, args.data);
    const comparison = recomputeComparison(plan);
    if (
      !comparison.different ||
      args.data.comparisonId !== comparison.comparisonId
    ) {
      throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
    }
    return {
      name,
      output: JSON.stringify({
        selectedCaseId: plan.caseId,
        caseFingerprint: plan.caseFingerprint,
        comparisonId: comparison.comparisonId,
        contrastScore: comparison.contrastScore,
        selected: true,
      }),
    };
  }

  throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
}

export function validateExecutionLedger(executions: readonly ToolExecution[]): void {
  if (
    executions.length !== REQUIRED_TOOL_NAMES.length ||
    REQUIRED_TOOL_NAMES.some(
      (name, index) => executions[index]?.name !== name,
    )
  ) {
    throw new ModelDuelUpstreamError("ORCHESTRATION_INVALID");
  }
}
