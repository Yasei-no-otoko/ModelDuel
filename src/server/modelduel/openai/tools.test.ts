import { describe, expect, it } from "vitest";

import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
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
