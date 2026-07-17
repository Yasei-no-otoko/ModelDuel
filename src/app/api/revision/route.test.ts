import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import { issueEvaluationToken } from "../../../server/modelduel/evaluation-core";
import { createRateLimitStore } from "../../../server/modelduel/rate-limit";
import type {
  RevisionFeedbackExtraction,
} from "../../../server/modelduel/openai/contracts";
import type {
  ModelDuelGateway,
  RevisionParseRequest,
} from "../../../server/modelduel/openai/gateway";
import { handleRevisionRequest, POST } from "./route";

const NOW = 1_800_000_000_000;
const SECRET = "revision-route-live-secret-long-enough";
const LIVE_FEEDBACK: RevisionFeedbackExtraction = {
  schemaVersion: "1.0",
  feedback: {
    conceptualChange: "revised",
    score: 1,
    summary: "The explanation now uses illumination and viewing geometry.",
    strengths: ["Connects the evidence to a causal model."],
    nextStep: "Apply the model to first quarter.",
  },
};

function validBody(now = Date.now()): Record<string, unknown> {
  return {
    mode: "verified-sample",
    requestId: "revision-route-request-1",
    idempotencyKey: "revision-route-idempotency-1",
    requestedAt: now,
    sessionId: "revision-route-session-1",
    scenarioId: "moon-phases",
    caseFingerprint: createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
    revisionText:
      "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.",
  };
}

function liveBody(
  input: { issuedAt?: number; expiresAt?: number } = {},
): Record<string, unknown> {
  const sessionId = "revision-route-live-session";
  return {
    mode: "live",
    requestId: "revision-route-live-request-1",
    idempotencyKey: "revision-route-live-idempotency-1",
    requestedAt: NOW,
    sessionId,
    liveUseAttestation: true,
    revisionText:
      "Sunlight lights half the Moon, and our viewing angle reveals the visible part.",
    evaluationId: issueEvaluationToken(SECRET, {
      sessionId,
      questionId: MOON_HERO_SAMPLE.transferQuestion.questionId,
      questionVersion: MOON_HERO_SAMPLE.transferQuestion.version,
      optionIds: MOON_HERO_SAMPLE.transferQuestion.options.map(
        (option) => option.id,
      ),
      correctOptionId: "toward-sun",
      rationale: "Private route-test rationale.",
      source: "deterministic-question-bank",
      issuedAt: input.issuedAt ?? NOW,
      expiresAt: input.expiresAt ?? NOW + 20 * 60 * 1_000,
      revisionContext: {
        scenarioId: "moon-phases",
        caseId: MOON_HERO_SAMPLE.caseSpec.id,
        caseFingerprint: createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
        learnerWorldId: MOON_HERO_SAMPLE.learnerWorld.worldId,
        scientificWorldId: MOON_HERO_SAMPLE.scientificWorld.worldId,
        misconceptionType: "earth-shadow-phases",
      },
    }),
  };
}

function liveGateway(requests: RevisionParseRequest[]): ModelDuelGateway {
  return {
    analysisModel: "gpt-5.6-terra",
    revisionModel: "gpt-5.6-luna",
    async parseLearnerModel() {
      throw new Error("Unexpected learner extraction");
    },
    async runProgramTurn() {
      throw new Error("Unexpected orchestration");
    },
    async parseRevisionFeedback(request) {
      requests.push(request);
      return {
        status: "completed",
        hasError: false,
        hasRefusal: false,
        parsed: LIVE_FEEDBACK,
        outputText: "",
      };
    },
  };
}

function request(
  payload: unknown,
  contentType = "application/json",
  cookie?: string,
): Request {
  return new Request("http://localhost/api/revision", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/revision", () => {
  beforeEach(() => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns strict authored feedback with no-store", async () => {
    const response = await POST(request(validBody()));
    const json = (await response.json()) as {
      source: string;
      notice: string;
      feedback: { conceptualChange: string; score: number };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(json.source).toBe("deterministic-authored-rubric");
    expect(json.notice).toBe(
      "This feedback uses an authored deterministic rubric, not AI grading.",
    );
    expect(json.feedback).toMatchObject({ conceptualChange: "revised", score: 1 });
  });

  it("rejects fingerprint mismatch with a safe invalid-request response", async () => {
    const response = await POST(
      request({ ...validBody(), caseFingerprint: "case-wrong" }),
    );
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error.code).toBe("INVALID_REQUEST");
  });

  it("rejects unknown fields", async () => {
    const response = await POST(
      request({ ...validBody(), unexpected: "not-allowed" }),
    );
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
  });

  it("rejects timestamps more than five minutes in the future", async () => {
    const response = await POST(
      request(validBody(Date.now() + 5 * 60 * 1_000 + 2_000)),
    );
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("INVALID_REQUEST");
  });

  it("requires application/json", async () => {
    const response = await POST(request(validBody(), "text/plain"));
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("mints and reuses a live cookie after signed-token verification", async () => {
    const requests: RevisionParseRequest[] = [];
    const dependencies = {
      gateway: liveGateway(requests),
      now: NOW,
      rateLimitStore: createRateLimitStore(),
    };
    const firstResponse = await handleRevisionRequest(
      request(liveBody()),
      dependencies,
    );

    expect(firstResponse.status).toBe(200);
    const setCookie = firstResponse.headers.get("set-cookie");
    expect(setCookie).toMatch(
      /^__Host-modelduel-safety-v1=mds1_[a-f0-9]{32}; Path=\/; HttpOnly; Secure; SameSite=Strict$/,
    );
    const cookiePair = setCookie?.split(";", 1)[0];
    expect(cookiePair).toBeTruthy();

    const secondResponse = await handleRevisionRequest(
      request(
        {
          ...liveBody(),
          requestId: "revision-route-live-request-2",
          idempotencyKey: "revision-route-live-idempotency-2",
        },
        "application/json",
        cookiePair,
      ),
      dependencies,
    );
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.has("set-cookie")).toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.safetyIdentifier).toBe(
      requests[1]?.safetyIdentifier,
    );
  });

  it("keeps unusable live tokens cookie-free and stops before the gateway", async () => {
    const requests: RevisionParseRequest[] = [];
    const valid = liveBody();
    const evaluationId = valid.evaluationId as string;
    const tamperIndex = evaluationId.indexOf(".") + 1;
    const replacement = evaluationId[tamperIndex] === "A" ? "B" : "A";
    const cases = [
      { ...valid, evaluationId: "v1.invalid" },
      {
        ...valid,
        evaluationId: `${evaluationId.slice(
          0,
          tamperIndex,
        )}${replacement}${evaluationId.slice(tamperIndex + 1)}`,
      },
      { ...valid, sessionId: "revision-route-wrong-session" },
      liveBody({
        issuedAt: NOW - 40 * 60 * 1_000,
        expiresAt: NOW - 10 * 60 * 1_000,
      }),
    ];

    for (const payload of cases) {
      const response = await handleRevisionRequest(request(payload), {
        gateway: liveGateway(requests),
        now: NOW,
        rateLimitStore: createRateLimitStore(),
      });
      const json = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(400);
      expect(response.headers.has("set-cookie")).toBe(false);
      expect(json.error.code).toBe("INVALID_EVALUATION");
    }
    expect(requests).toHaveLength(0);
  });

  it.each(["missing", "false"])(
    "rejects a %s live attestation before rate limiting or the Luna gateway",
    async (variant) => {
      const requests: RevisionParseRequest[] = [];
      const body = liveBody();
      if (variant === "missing") {
        delete body.liveUseAttestation;
      } else {
        body.liveUseAttestation = false;
      }
      const rateLimitStore = createRateLimitStore();

      const response = await handleRevisionRequest(request(body), {
        gateway: liveGateway(requests),
        now: NOW,
        rateLimitStore,
      });
      const json = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("INVALID_REQUEST");
      expect(rateLimitStore.globals.size).toBe(0);
      expect(requests).toHaveLength(0);
    },
  );
});
