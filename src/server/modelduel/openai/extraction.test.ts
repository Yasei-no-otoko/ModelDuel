import { describe, expect, it } from "vitest";

import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import type { LearnerModelExtraction } from "./contracts";
import { extractLearnerModel } from "./extraction";
import { ModelDuelUpstreamError } from "./errors";
import type {
  LearnerParseRequest,
  ModelDuelGateway,
} from "./gateway";

const VALID: LearnerModelExtraction = {
  schemaVersion: "1.0",
  learnerModel: MOON_HERO_SAMPLE.learnerModel,
};

function fakeGateway(
  attempts: Array<{
    status: string;
    hasError: boolean;
    hasRefusal: boolean;
    parsed: LearnerModelExtraction | null;
    outputText: string;
  }>,
  requests: LearnerParseRequest[],
): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-terra",
    revisionModel: "gpt-5.6-luna",
    async parseLearnerModel(request) {
      requests.push(request);
      const next = attempts.shift();
      if (!next) {
        throw new Error("Unexpected extraction attempt");
      }
      return next;
    },
    async runProgramTurn() {
      throw new Error("Unexpected orchestration turn");
    },
    async parseRevisionFeedback() {
      throw new Error("Unexpected revision attempt");
    },
  };
}

const INPUT = {
  scenarioId: "moon-phases",
  explanation: "Earth's shadow causes the phases.",
  requestId: "extraction-test-request",
  signal: AbortSignal.timeout(10_000),
};

describe("extractLearnerModel", () => {
  it("accepts one strict structured result", async () => {
    const requests: LearnerParseRequest[] = [];
    const learnerModel = await extractLearnerModel(
      fakeGateway(
        [
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: VALID,
            outputText: "",
          },
        ],
        requests,
      ),
      INPUT,
    );
    expect(learnerModel).toEqual(VALID.learnerModel);
    expect(requests).toHaveLength(1);
  });

  it("repairs schema-invalid output once without resending the image", async () => {
    const requests: LearnerParseRequest[] = [];
    const learnerModel = await extractLearnerModel(
      fakeGateway(
        [
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: null,
            outputText: "invalid first output",
          },
          {
            status: "completed",
            hasError: false,
            hasRefusal: false,
            parsed: VALID,
            outputText: "",
          },
        ],
        requests,
      ),
      { ...INPUT, imageDataUrl: "data:image/png;base64,iVBORw0KGgo=" },
    );
    expect(learnerModel).toEqual(VALID.learnerModel);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.imageDataUrl).toBeDefined();
    expect(requests[1]?.repair).toBe(true);
    expect(requests[1]?.imageDataUrl).toBeUndefined();
  });

  it("propagates arbitrary parser defects without a repair call", async () => {
    const requests: LearnerParseRequest[] = [];
    const gateway: ModelDuelGateway = {
      analysisModel: "gpt-5.6-terra",
      revisionModel: "gpt-5.6-luna",
      async parseLearnerModel(request) {
        requests.push(request);
        throw new TypeError("SDK parser defect");
      },
      async runProgramTurn() {
        throw new Error("Unexpected orchestration turn");
      },
      async parseRevisionFeedback() {
        throw new Error("Unexpected revision attempt");
      },
    };

    await expect(extractLearnerModel(gateway, INPUT)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.repair).toBe(false);
  });

  it("does not fabricate a repair for image-only output with no repair text", async () => {
    const requests: LearnerParseRequest[] = [];
    await expect(
      extractLearnerModel(
        fakeGateway(
          [
            {
              status: "completed",
              hasError: false,
              hasRefusal: false,
              parsed: null,
              outputText: "",
            },
          ],
          requests,
        ),
        { ...INPUT, explanation: "", imageDataUrl: "data:image/png;base64,x" },
      ),
    ).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(requests).toHaveLength(1);
  });

  it.each([
    {
      status: "completed",
      hasError: false,
      hasRefusal: true,
      code: "MODEL_REFUSAL",
    },
    {
      status: "incomplete",
      hasError: false,
      hasRefusal: false,
      code: "UPSTREAM_INCOMPLETE",
    },
  ])("does not repair $code", async (attempt) => {
    const requests: LearnerParseRequest[] = [];
    await expect(
      extractLearnerModel(
        fakeGateway(
          [
            {
              ...attempt,
              parsed: null,
              outputText: "repairable-looking text",
            },
          ],
          requests,
        ),
        INPUT,
      ),
    ).rejects.toBeInstanceOf(ModelDuelUpstreamError);
    expect(requests).toHaveLength(1);
  });
});
