import { describe, expect, it } from "vitest";

import {
  MOON_HERO_SAMPLE,
  SEASONS_SAMPLE,
} from "../../../lib/modelduel/samples";
import { ModelDuelUpstreamError } from "./errors";
import { resolveRegistryPlan } from "./registry";
import {
  executeRegistryTool,
  PROGRAMMATIC_TOOLS,
  REQUIRED_TOOL_NAMES,
  validateExecutionLedger,
} from "./tools";

const PLAN = resolveRegistryPlan({
  scenarioId: "moon-phases",
  learnerModel: MOON_HERO_SAMPLE.learnerModel,
});

const WORLD_ARGS = {
  learnerWorldId: PLAN.learnerWorldId,
  scientificWorldId: PLAN.scientificWorldId,
};
const SIMULATION_ARGS = { ...WORLD_ARGS, caseId: PLAN.caseId };

const SEASONS_PLAN = resolveRegistryPlan({
  scenarioId: "seasons",
  learnerModel: SEASONS_SAMPLE.learnerModel,
});
const SEASONS_WORLD_ARGS = {
  learnerWorldId: SEASONS_PLAN.learnerWorldId,
  scientificWorldId: SEASONS_PLAN.scientificWorldId,
};
const SEASONS_SIMULATION_ARGS = {
  ...SEASONS_WORLD_ARGS,
  caseId: SEASONS_PLAN.caseId,
};

describe("Seasons programmatic tool registry", () => {
  it("executes the exact four-tool plan with a valid ledger", () => {
    const validate = executeRegistryTool(
      SEASONS_PLAN,
      "validate_world_spec",
      JSON.stringify(SEASONS_WORLD_ARGS),
    );
    const simulate = executeRegistryTool(
      SEASONS_PLAN,
      "simulate_world",
      JSON.stringify(SEASONS_SIMULATION_ARGS),
    );
    const compare = executeRegistryTool(
      SEASONS_PLAN,
      "compare_predictions",
      JSON.stringify(SEASONS_SIMULATION_ARGS),
    );
    const comparison = JSON.parse(compare.output) as {
      comparisonId: string;
      different: boolean;
    };
    const select = executeRegistryTool(
      SEASONS_PLAN,
      "select_discriminating_case",
      JSON.stringify({
        ...SEASONS_SIMULATION_ARGS,
        comparisonId: comparison.comparisonId,
      }),
    );

    expect(SEASONS_PLAN).toMatchObject({
      scenarioId: "seasons",
      misconceptionType: "distance-causes-seasons",
      learnerWorldId: "seasons-learner-distance-v1",
      scientificWorldId: "seasons-scientific-tilt-v1",
      caseId: "seasons-june-solstice",
    });
    expect(comparison.different).toBe(true);
    expect(() =>
      validateExecutionLedger([validate, simulate, compare, select]),
    ).not.toThrow();
  });

  it("rejects a learner model paired with the wrong scenario", () => {
    const expectRegistryMismatch = (
      input: Parameters<typeof resolveRegistryPlan>[0],
    ) => {
      try {
        resolveRegistryPlan(input);
        expect.fail("expected cross-scenario registry rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(ModelDuelUpstreamError);
        expect(error).toMatchObject({ code: "UNSUPPORTED_MISCONCEPTION" });
      }
    };

    expectRegistryMismatch({
      scenarioId: "seasons",
      learnerModel: MOON_HERO_SAMPLE.learnerModel,
    });
    expectRegistryMismatch({
      scenarioId: "moon-phases",
      learnerModel: SEASONS_SAMPLE.learnerModel,
    });
  });

  it.each([
    ["moon-phases", MOON_HERO_SAMPLE.learnerModel],
    ["seasons", SEASONS_SAMPLE.learnerModel],
  ] as const)("rejects a valid unsupported %s learner model explicitly", (scenarioId, learnerModel) => {
    expect(() =>
      resolveRegistryPlan({
        scenarioId,
        learnerModel: { ...learnerModel, misconceptionType: "other" },
      }),
    ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_MISCONCEPTION" }));
  });

  it("keeps malformed learner output distinct from a valid unsupported claim", () => {
    expect(() =>
      resolveRegistryPlan({
        scenarioId: "moon-phases",
        learnerModel: {} as typeof MOON_HERO_SAMPLE.learnerModel,
      }),
    ).toThrow(expect.objectContaining({ code: "MODEL_OUTPUT_INVALID" }));
  });
});

describe("programmatic tool registry", () => {
  it("declares four strict program-only tools and the PTC marker", () => {
    const functions = PROGRAMMATIC_TOOLS.filter(
      (tool) => tool.type === "function",
    );
    expect(functions.map((tool) => tool.name)).toEqual(REQUIRED_TOOL_NAMES);
    for (const tool of functions) {
      expect(tool.strict).toBe(true);
      expect(tool.allowed_callers).toEqual(["programmatic"]);
      expect(tool.parameters).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
      expect(tool.output_schema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
    expect(PROGRAMMATIC_TOOLS.at(-1)).toEqual({
      type: "programmatic_tool_calling",
    });
  });

  it("executes all four tools from registry IDs and validates the ledger", () => {
    const validate = executeRegistryTool(
      PLAN,
      "validate_world_spec",
      JSON.stringify(WORLD_ARGS),
    );
    const simulate = executeRegistryTool(
      PLAN,
      "simulate_world",
      JSON.stringify(SIMULATION_ARGS),
    );
    const compare = executeRegistryTool(
      PLAN,
      "compare_predictions",
      JSON.stringify(SIMULATION_ARGS),
    );
    const comparison = JSON.parse(compare.output) as {
      comparisonId: string;
      different: boolean;
    };
    const select = executeRegistryTool(
      PLAN,
      "select_discriminating_case",
      JSON.stringify({
        ...SIMULATION_ARGS,
        comparisonId: comparison.comparisonId,
      }),
    );

    expect(comparison.different).toBe(true);
    expect(() =>
      validateExecutionLedger([validate, simulate, compare, select]),
    ).not.toThrow();
  });

  it("rejects model-supplied world, case, comparison, and extra-field injection", () => {
    const invalidArguments = [
      ["validate_world_spec", { ...WORLD_ARGS, learnerWorldId: "injected" }],
      ["simulate_world", { ...SIMULATION_ARGS, caseId: "injected" }],
      [
        "compare_predictions",
        { ...SIMULATION_ARGS, arbitraryPhysicsValue: 999 },
      ],
      [
        "select_discriminating_case",
        { ...SIMULATION_ARGS, comparisonId: "injected" },
      ],
    ] as const;
    for (const [name, args] of invalidArguments) {
      expect(() =>
        executeRegistryTool(PLAN, name, JSON.stringify(args)),
      ).toThrow(ModelDuelUpstreamError);
    }
  });
});
