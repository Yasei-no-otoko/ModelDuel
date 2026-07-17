import type * as Responses from "openai/resources/responses/responses";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function finalAssistantMessage(id = "final-message") {
  return {
    id,
    type: "message",
    role: "assistant",
    status: "completed",
    phase: "final_answer",
    content: [
      {
        type: "output_text",
        text: "The deterministic plan is verified.",
        annotations: [],
      },
    ],
  } satisfies Responses.ResponseOutputItem;
}

function programOutput(
  id = "program-output-1",
  result = "continuing",
  status: "completed" | "incomplete" = "completed",
  callId = "program-call-1",
) {
  return {
    id,
    call_id: callId,
    result,
    status,
    type: "program_output",
  } satisfies Responses.ResponseOutputItem;
}

function fakeGateway(
  turns: ProgramTurnResponse[],
  requests: ProgramTurnRequest[],
): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-terra",
    revisionModel: "gpt-5.6-luna",
    async parseLearnerModel() {
      throw new Error("Unexpected extraction");
    },
    async parseRevisionFeedback() {
      throw new Error("Unexpected revision");
    },
    async runProgramTurn(request) {
      expect(request.body.safety_identifier).toBe(SAFETY_IDENTIFIER);
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

function sequentialToolTurns(): ProgramTurnResponse[] {
  return [
    completedTurn([
      programItem(),
      functionCall("call-validate", "validate_world_spec", WORLD_ARGS),
    ]),
    completedTurn([
      functionCall("call-simulate", "simulate_world", SIMULATION_ARGS),
    ]),
    completedTurn([
      functionCall("call-compare", "compare_predictions", SIMULATION_ARGS),
    ]),
    completedTurn([
      functionCall(
        "call-select",
        "select_discriminating_case",
        JSON.stringify({
          ...JSON.parse(SIMULATION_ARGS),
          comparisonId: COMPARISON_ID,
        }),
      ),
    ]),
  ];
}

const SAFETY_IDENTIFIER = `mds1_${"A".repeat(43)}`;

function orchestrationInput(
  overrides: Partial<
    Parameters<typeof runDeterministicOrchestration>[1]
  > = {},
): Parameters<typeof runDeterministicOrchestration>[1] {
  return {
    requestId: "orchestration-sequential-test",
    learnerSummary: MOON_HERO_SAMPLE.learnerModel.summary,
    misconceptionType: MOON_HERO_SAMPLE.learnerModel.misconceptionType,
    plan: PLAN,
    safetyIdentifier: SAFETY_IDENTIFIER,
    signal: AbortSignal.timeout(10_000),
    ...overrides,
  };
}

describe("programmatic orchestration transcript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("preserves every output item before appending tool outputs in call order", async () => {
    const requests: ProgramTurnRequest[] = [];
    const program = programItem();
    const replayedProgramOutput = programOutput();
    const firstOutput = [
      program,
      functionCall("call-validate", "validate_world_spec", WORLD_ARGS),
      replayedProgramOutput,
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
          completedTurn([finalAssistantMessage()]),
        ],
        requests,
      ),
      orchestrationInput({
        requestId: "orchestration-order-test",
      }),
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
    expect(requests).toHaveLength(3);
    expect(requests[0]?.body).toMatchObject({
      reasoning: { effort: "low" },
      service_tier: "default",
      prompt_cache_key: "modelduel:ptc:v1:moon-phases",
      prompt_cache_options: { mode: "implicit", ttl: "30m" },
      text: { verbosity: "low" },
      max_output_tokens: 900,
    });
    expect(requests[1]?.body.max_output_tokens).toBe(600);
    expect(requests[2]?.body.max_output_tokens).toBe(600);
    expect(requests.every((request) => !request.body.parallel_tool_calls)).toBe(
      true,
    );
  });

  it("allows one required function per round followed by program output and a final message on round five", async () => {
    const requests: ProgramTurnRequest[] = [];
    const result = await runDeterministicOrchestration(
      fakeGateway(
        [
          ...sequentialToolTurns(),
          completedTurn([
            programOutput("program-output-round-5", "verified"),
            finalAssistantMessage(),
          ]),
        ],
        requests,
      ),
      orchestrationInput(),
    );

    expect(result.toolNames).toEqual([
      "validate_world_spec",
      "simulate_world",
      "compare_predictions",
      "select_discriminating_case",
    ]);
    expect(requests).toHaveLength(5);
    expect(requests.every((request) => !request.body.parallel_tool_calls)).toBe(
      true,
    );
  });

  it("allows program output on round five and the final message on round six", async () => {
    const requests: ProgramTurnRequest[] = [];
    const result = await runDeterministicOrchestration(
      fakeGateway(
        [
          ...sequentialToolTurns(),
          completedTurn([
            programOutput("program-output-round-5", "verified"),
          ]),
          completedTurn([finalAssistantMessage("final-message-round-6")]),
        ],
        requests,
      ),
      orchestrationInput(),
    );

    expect(result.toolNames).toHaveLength(4);
    expect(requests).toHaveLength(6);
  });

  it("replays an incomplete program output and succeeds after its later completed status", async () => {
    const requests: ProgramTurnRequest[] = [];
    const result = await runDeterministicOrchestration(
      fakeGateway(
        [
          ...sequentialToolTurns(),
          completedTurn([
            programOutput(
              "program-output-incomplete",
              "continuing",
              "incomplete",
            ),
          ]),
          completedTurn([
            programOutput(
              "program-output-completed",
              "verified",
              "completed",
            ),
            finalAssistantMessage("final-after-completed-program-output"),
          ]),
        ],
        requests,
      ),
      orchestrationInput(),
    );

    expect(result.toolNames).toHaveLength(4);
    expect(requests).toHaveLength(6);
    const finalInput = requests[5]?.body.input;
    expect(Array.isArray(finalInput)).toBe(true);
    if (!Array.isArray(finalInput)) throw new Error("Expected final input array");
    expect(finalInput).toContainEqual(
      expect.objectContaining({
        id: "program-output-incomplete",
        type: "program_output",
        status: "incomplete",
      }),
    );
  });

  it("rejects a final message while the latest program output remains incomplete", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            ...sequentialToolTurns(),
            completedTurn([
              programOutput(
                "program-output-incomplete",
                "still-running",
                "incomplete",
              ),
              finalAssistantMessage(),
            ]),
          ],
          [],
        ),
        orchestrationInput(),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "INCOMPLETE_PROGRAM_OUTPUT",
    });
  });

  it("rejects a later final message when an incomplete program output was never resolved", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            ...sequentialToolTurns(),
            completedTurn([
              programOutput(
                "program-output-incomplete",
                "still-running",
                "incomplete",
              ),
            ]),
            completedTurn([finalAssistantMessage()]),
          ],
          [],
        ),
        orchestrationInput(),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "INCOMPLETE_PROGRAM_OUTPUT",
    });
  });

  it("rejects an orphan program output with a fixed privacy-safe reason", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programOutput(
                "private-output-id",
                "private-result-text",
                "completed",
                "private-orphan-call-id",
              ),
            ]),
          ],
          [],
        ),
        orchestrationInput({
          requestId: "private-request-id",
          learnerSummary: "private learner text",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    const serialized = String(info.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      event: "ptc_failure",
      reason: "ORPHAN_PROGRAM_OUTPUT",
    });
    expect(serialized).not.toContain("private");
  });

  it("rejects a fifth distinct function call with the fixed call-limit reason", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem(),
              functionCall("call-validate", "validate_world_spec", WORLD_ARGS),
              functionCall("call-simulate", "simulate_world", SIMULATION_ARGS),
              functionCall("call-compare", "compare_predictions", SIMULATION_ARGS),
              functionCall(
                "call-select",
                "select_discriminating_case",
                JSON.stringify({
                  ...JSON.parse(SIMULATION_ARGS),
                  comparisonId: COMPARISON_ID,
                }),
              ),
              functionCall(
                "private-fifth-call-id",
                "validate_world_spec",
                "private-fifth-call-arguments",
              ),
            ]),
          ],
          [],
        ),
        orchestrationInput(),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    const serialized = String(info.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      event: "ptc_failure",
      reason: "CALL_LIMIT",
    });
    expect(serialized).not.toContain("private");
  });

  it("rejects six valid rounds that never produce a final message", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            ...sequentialToolTurns(),
            completedTurn([
              programOutput("program-output-round-5", "verified"),
            ]),
            completedTurn([]),
          ],
          [],
        ),
        orchestrationInput(),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "ROUND_LIMIT",
    });
  });

  it("emits production-only JSON diagnostics without private payloads", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await runDeterministicOrchestration(
      fakeGateway(
        [
          ...sequentialToolTurns(),
          completedTurn([
            programOutput("program-output-private-id", "private-result"),
            finalAssistantMessage("private-final-id"),
          ]),
        ],
        [],
      ),
      orchestrationInput({
        requestId: "private-request-id",
        learnerSummary: "private learner text",
      }),
    );

    expect(info).toHaveBeenCalledTimes(5);
    const records = info.mock.calls.map(([value]) => JSON.parse(String(value)));
    expect(records[0]).toEqual({
      event: "ptc_turn",
      round: 1,
      status: "completed",
      responseBytes: 1_024,
      transcriptBytes: expect.any(Number),
      outputTypeCounts: {
        message: 0,
        reasoning: 0,
        function_call: 1,
        program: 1,
        program_output: 0,
      },
      functionCallCount: 1,
      functionNames: ["validate_world_spec"],
      expectedNextTool: "simulate_world",
      completedToolCount: 1,
      hasProgramOutput: false,
      hasFinalMessage: false,
    });
    expect(records[4]).toMatchObject({
      event: "ptc_turn",
      round: 5,
      functionCallCount: 0,
      functionNames: [],
      expectedNextTool: null,
      completedToolCount: 4,
      hasProgramOutput: true,
      hasFinalMessage: true,
    });
    const serialized = JSON.stringify(records);
    for (const privateValue of [
      "private-request-id",
      "private learner text",
      "private-result",
      "private-final-id",
      WORLD_ARGS,
      "verify_registry_plan",
      "The deterministic plan is verified.",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("does not emit PTC diagnostics outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await runDeterministicOrchestration(
      fakeGateway(
        [
          ...sequentialToolTurns(),
          completedTurn([finalAssistantMessage()]),
        ],
        [],
      ),
      orchestrationInput(),
    );

    expect(info).not.toHaveBeenCalled();
  });

  it("swallows production diagnostic logger failures", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("logger unavailable");
    });

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            ...sequentialToolTurns(),
            completedTurn([finalAssistantMessage()]),
          ],
          [],
        ),
        orchestrationInput(),
      ),
    ).resolves.toMatchObject({ toolNames: expect.any(Array) });
  });

  it("requires a final assistant message after the exact four-tool ledger", async () => {
    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem(),
              functionCall("call-validate", "validate_world_spec", WORLD_ARGS),
              functionCall("call-simulate", "simulate_world", SIMULATION_ARGS),
              functionCall("call-compare", "compare_predictions", SIMULATION_ARGS),
              functionCall(
                "call-select",
                "select_discriminating_case",
                JSON.stringify({
                  ...JSON.parse(SIMULATION_ARGS),
                  comparisonId: COMPARISON_ID,
                }),
              ),
            ]),
            completedTurn([]),
            completedTurn([]),
            completedTurn([]),
            completedTurn([]),
            completedTurn([]),
          ],
          [],
        ),
        orchestrationInput({
          requestId: "orchestration-final-message-required",
          learnerSummary: "Learner summary",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });

  it("rejects a final message before the required ledger is complete", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway([completedTurn([finalAssistantMessage()])], []),
        orchestrationInput(),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "FINAL_BEFORE_LEDGER",
    });
  });

  it("rejects a direct function caller", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
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
        orchestrationInput({
          requestId: "orchestration-direct-test",
          learnerSummary: "Learner summary",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "CALLER_INVALID",
    });
  });

  it("rejects tool calls that skip the required phase order", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

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
        orchestrationInput({
          requestId: "orchestration-order-reject",
          learnerSummary: "Learner summary",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0]))).toEqual({
      event: "ptc_failure",
      reason: "TOOL_ORDER",
    });
  });

  it("reports invalid tool JSON with a fixed privacy-safe validation reason", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      runDeterministicOrchestration(
        fakeGateway(
          [
            completedTurn([
              programItem(),
              functionCall(
                "private-invalid-call-id",
                "validate_world_spec",
                "private-invalid-json",
              ),
            ]),
          ],
          [],
        ),
        orchestrationInput({
          requestId: "private-request-id",
          learnerSummary: "private learner text",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });

    const serialized = String(info.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      event: "ptc_failure",
      reason: "TOOL_VALIDATION",
    });
    expect(serialized).not.toContain("private");
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
        orchestrationInput({
          requestId: "orchestration-duplicate-call",
          learnerSummary: "Learner summary",
        }),
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
        orchestrationInput({
          requestId: "orchestration-duplicate-id",
          learnerSummary: "Learner summary",
        }),
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
        orchestrationInput({
          requestId: "orchestration-orphan-caller",
          learnerSummary: "Learner summary",
        }),
      ),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_INVALID" });
  });
});
