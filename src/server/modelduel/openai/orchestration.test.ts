import type * as Responses from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";

import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import { runDeterministicOrchestration } from "./orchestration";
import type {
  ModelDuelGateway,
  ProgramTurnRequest,
  ProgramTurnResponse,
} from "./gateway";
import { resolveRegistryPlan } from "./registry";

const PLAN = resolveRegistryPlan({
  scenarioId: "moon-phases",
  learnerModel: MOON_HERO_SAMPLE.learnerModel,
});
const CALLER = { caller_id: "program-call-1", type: "program" } as const;

function functionCall(
  callId: string,
  name: string,
  argumentsJson: string,
) {
  return {
    type: "function_call",
    id: `fc-${callId}`,
    call_id: callId,
    name,
    arguments: argumentsJson,
    status: "completed",
    caller: CALLER,
  } satisfies Responses.ResponseOutputItem;
}

function programItem(
  callId = "program-call-1",
  id = "program-1",
) {
  return {
    id,
    call_id: callId,
    code: "verify_registry_plan()",
    fingerprint: `fingerprint-${callId}`,
    type: "program",
  } satisfies Responses.ResponseOutputItem;
}

function completedTurn(output: readonly Responses.ResponseOutputItem[]) {
  return {
    status: "completed",
    hasError: false,
    hasRefusal: false,
    output,
    responseBytes: 1_024,
  };
}

function fakeGateway(
  turns: ProgramTurnResponse[],
  requests: ProgramTurnRequest[],
): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-sol",
    revisionModel: "gpt-5.6-terra",
    async parseLearnerModel() {
      throw new Error("Unexpected extraction");
    },
    async parseRevisionFeedback() {
      throw new Error("Unexpected revision");
    },
    async runProgramTurn(request) {
      requests.push(request);
      const response = turns.shift();
      if (!response) {
        throw new Error("Unexpected orchestration turn");
      }
      return response;
    },
  };
}

const WORLD_ARGS = JSON.stringify({
  learnerWorldId: PLAN.learnerWorldId,
  scientificWorldId: PLAN.scientificWorldId,
});
const SIMULATION_ARGS = JSON.stringify({
  caseId: PLAN.caseId,
  learnerWorldId: PLAN.learnerWorldId,
  scientificWorldId: PLAN.scientificWorldId,
});
const COMPARISON_ID = `comparison-${PLAN.caseId}`;

describe("programmatic orchestration transcript", () => {
  it("preserves every output item before appending tool outputs in call order", async () => {
    const requests: ProgramTurnRequest[] = [];
    const program = programItem();
    const programOutput = {
      id: "program-output-1",
      call_id: "program-call-1",
      result: "continuing",
      status: "completed",
      type: "program_output",
    } satisfies Responses.ResponseOutputItem;
    const firstOutput = [
      program,
      functionCall("call-validate", "validate_world_spec", WORLD_ARGS),
      programOutput,
      functionCall("call-simulate", "simulate_world", SIMULATION_ARGS),
    ];
    const secondOutput = [
      functionCall("call-compare", "compare_predictions", SIMULATION_ARGS),
      functionCall(
        "call-select",
        "select_discriminating_case",
        JSON.stringify({
          ...JSON.parse(SIMULATION_ARGS),
          comparisonId: COMPARISON_ID,
        }),
      ),
    ];
    const result = await runDeterministicOrchestration(
      fakeGateway(
        [
          completedTurn(firstOutput),
          completedTurn(secondOutput),
          completedTurn([]),
        ],
        requests,
      ),
      {
        requestId: "orchestration-order-test",
        learnerSummary: MOON_HERO_SAMPLE.learnerModel.summary,
        misconceptionType:
          MOON_HERO_SAMPLE.learnerModel.misconceptionType,
        plan: PLAN,
        signal: AbortSignal.timeout(10_000),
      },
    );

    expect(result.toolNames).toEqual([
      "validate_world_spec",
      "simulate_world",
      "compare_predictions",
      "select_discriminating_case",
    ]);
    const firstInput = requests[0]?.body.input;
    expect(Array.isArray(firstInput)).toBe(true);
    if (!Array.isArray(firstInput)) throw new Error("Expected initial input array");
    expect(firstInput).toHaveLength(2);
    expect(
      firstInput.map((item) => ("role" in item ? item.role : "output")),
    ).toEqual(["developer", "user"]);

    const secondInput = requests[1]?.body.input;
    expect(Array.isArray(secondInput)).toBe(true);
    if (!Array.isArray(secondInput)) {
      throw new Error("Expected accumulated input array");
    }
    expect(
      secondInput
        .slice(2)
        .map((item) => ("type" in item ? item.type : "easy_message")),
    ).toEqual([
      "program",
      "function_call",
      "program_output",
      "function_call",
      "function_call_output",
      "function_call_output",
    ]);
    expect(secondInput.at(-2)).toMatchObject({
      type: "function_call_output",
      call_id: "call-validate",
      caller: CALLER,
    });
    expect(secondInput.at(-1)).toMatchObject({
      type: "function_call_output",
      call_id: "call-simulate",
      caller: CALLER,
    });
  });

  it("rejects a direct function caller", async () => {
    const requests: ProgramTurnRequest[] = [];
    const directCall = {
      type: "function_call",
      id: "fc-direct",
      call_id: "call-direct",
      name: "validate_world_spec",
      arguments: WORLD_ARGS,
      status: "completed",
    } satisfies Responses.ResponseOutputItem;

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            {
              status: "completed",
              hasError: false,
              hasRefusal: false,
              output: [directCall],
              responseBytes: 1_024,
            },
          ],
          requests,
        ),
        {
          requestId: "orchestration-direct-test",
          learnerSummary: "Learner summary",
          misconceptionType: "earth-shadow-phases",
          plan: PLAN,
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });

  it("rejects tool calls that skip the required phase order", async () => {
    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem(),
              functionCall("call-simulate", "simulate_world", SIMULATION_ARGS),
            ]),
          ],
          [],
        ),
        {
          requestId: "orchestration-order-reject",
          learnerSummary: "Learner summary",
          misconceptionType: "earth-shadow-phases",
          plan: PLAN,
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });

  it("rejects duplicate call IDs even when content is identical", async () => {
    const duplicate = functionCall(
      "call-duplicate",
      "validate_world_spec",
      WORLD_ARGS,
    );
    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [completedTurn([programItem(), duplicate, duplicate])],
          [],
        ),
        {
          requestId: "orchestration-duplicate-call",
          learnerSummary: "Learner summary",
          misconceptionType: "earth-shadow-phases",
          plan: PLAN,
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });

  it("rejects duplicate output IDs and orphan program callers", async () => {
    const duplicateIdCall = {
      ...functionCall("call-duplicate-id", "validate_world_spec", WORLD_ARGS),
      id: "duplicate-item-id",
    } satisfies Responses.ResponseOutputItem;
    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem("program-call-1", "duplicate-item-id"),
              duplicateIdCall,
            ]),
          ],
          [],
        ),
        {
          requestId: "orchestration-duplicate-id",
          learnerSummary: "Learner summary",
          misconceptionType: "earth-shadow-phases",
          plan: PLAN,
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem("different-program-call"),
              functionCall("call-orphan", "validate_world_spec", WORLD_ARGS),
            ]),
          ],
          [],
        ),
        {
          requestId: "orchestration-orphan-caller",
          learnerSummary: "Learner summary",
          misconceptionType: "earth-shadow-phases",
          plan: PLAN,
          signal: AbortSignal.timeout(10_000),
        },
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });
});
