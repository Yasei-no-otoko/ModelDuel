import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { MOON_HERO_SAMPLE } from "../../../lib/modelduel/samples";
import { issueEvaluationToken } from "../../../server/modelduel/evaluation-core";
import { createRateLimitStore } from "../../../server/modelduel/rate-limit";
import { createEphemeralRevisionReplayCoordinator } from "../../../server/modelduel/revision-replay-memory";
import type {
  RevisionFeedbackExtraction,
} from "../../../server/modelduel/openai/contracts";
import type {
  ModelDuelGateway,
  RevisionParseRequest,
} from "../../../server/modelduel/openai/gateway";
import { ModelDuelUpstreamError } from "../../../server/modelduel/openai/errors";
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
    const rateLimitStore = createRateLimitStore();
    const dependencies = {
      gateway: liveGateway(requests),
      now: NOW,
      rateLimitStore,
      replayCoordinator: createEphemeralRevisionReplayCoordinator(),
    };
    const replayedBody = liveBody();
    const firstResponse = await handleRevisionRequest(
      request(replayedBody),
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
          ...replayedBody,
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
    const secondJson = (await secondResponse.json()) as {
      requestId: string;
      feedback: unknown;
    };
    expect(secondJson.requestId).toBe("revision-route-live-request-2");
    expect(secondJson.feedback).toEqual(LIVE_FEEDBACK.feedback);
    expect(requests).toHaveLength(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);
  });

  it("deduplicates an exact token replay even when each request mints a cookie", async () => {
    const requests: RevisionParseRequest[] = [];
    const rateLimitStore = createRateLimitStore();
    const dependencies = {
      gateway: liveGateway(requests),
      now: NOW,
      rateLimitStore,
      replayCoordinator: createEphemeralRevisionReplayCoordinator(),
    };
    const body = liveBody();
    const first = await handleRevisionRequest(request(body), dependencies);
    const second = await handleRevisionRequest(
      request({
        ...body,
        requestId: "revision-route-live-request-2",
        idempotencyKey: "revision-route-live-idempotency-2",
      }),
      dependencies,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.has("set-cookie")).toBe(true);
    expect(second.headers.has("set-cookie")).toBe(true);
    expect(requests).toHaveLength(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);
  });

  it("never starts a second gateway call for a concurrent exact replay", async () => {
    const requests: RevisionParseRequest[] = [];
    let releaseGateway!: () => void;
    let markStarted!: () => void;
    const gatewayGate = new Promise<void>((resolve) => {
      releaseGateway = resolve;
    });
    const gatewayStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const baseGateway = liveGateway(requests);
    const gateway: ModelDuelGateway = {
      ...baseGateway,
      async parseRevisionFeedback(input) {
        requests.push(input);
        markStarted();
        await gatewayGate;
        return {
          status: "completed",
          hasError: false,
          hasRefusal: false,
          parsed: LIVE_FEEDBACK,
          outputText: "",
        };
      },
    };
    const rateLimitStore = createRateLimitStore();
    const dependencies = {
      gateway,
      now: NOW,
      rateLimitStore,
      replayCoordinator: createEphemeralRevisionReplayCoordinator(),
    };
    const body = liveBody();
    const cookie = `__Host-modelduel-safety-v1=mds1_${"a".repeat(32)}`;
    const leader = handleRevisionRequest(
      request(body, "application/json", cookie),
      dependencies,
    );
    await gatewayStarted;

    const follower = await handleRevisionRequest(
      request(
        {
          ...body,
          requestId: "revision-route-live-request-2",
          idempotencyKey: "revision-route-live-idempotency-2",
        },
        "application/json",
        cookie,
      ),
      dependencies,
    );
    expect(follower.status).toBe(409);
    expect(await follower.json()).toMatchObject({
      error: { code: "REVISION_IN_PROGRESS", retryable: true },
    });
    expect(requests).toHaveLength(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);

    releaseGateway();
    await expect(leader.then((response) => response.status)).resolves.toBe(200);
    const cached = await handleRevisionRequest(
      request(
        {
          ...body,
          requestId: "revision-route-live-request-3",
          idempotencyKey: "revision-route-live-idempotency-3",
        },
        "application/json",
        cookie,
      ),
      dependencies,
    );
    expect(cached.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);
  });

  it("fails a changed-input replay closed without another paid attempt", async () => {
    const requests: RevisionParseRequest[] = [];
    const rateLimitStore = createRateLimitStore();
    const dependencies = {
      gateway: liveGateway(requests),
      now: NOW,
      rateLimitStore,
      replayCoordinator: createEphemeralRevisionReplayCoordinator(),
    };
    const body = liveBody();
    const cookie = `__Host-modelduel-safety-v1=mds1_${"b".repeat(32)}`;
    expect(
      (
        await handleRevisionRequest(
          request(body, "application/json", cookie),
          dependencies,
        )
      ).status,
    ).toBe(200);

    const replay = await handleRevisionRequest(
      request(
        {
          ...body,
          requestId: "revision-route-live-request-2",
          idempotencyKey: "revision-route-live-idempotency-2",
          revisionText: "A different revision must not reuse the capability.",
        },
        "application/json",
        cookie,
      ),
      dependencies,
    );
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({
      error: { code: "INVALID_EVALUATION", retryable: false },
    });
    expect(requests).toHaveLength(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);
  });

  it("caches a post-commit failure without retrying the gateway", async () => {
    let calls = 0;
    const gateway: ModelDuelGateway = {
      ...liveGateway([]),
      async parseRevisionFeedback() {
        calls += 1;
        throw new ModelDuelUpstreamError("UPSTREAM_TIMEOUT");
      },
    };
    const rateLimitStore = createRateLimitStore();
    const dependencies = {
      gateway,
      now: NOW,
      rateLimitStore,
      replayCoordinator: createEphemeralRevisionReplayCoordinator(),
    };
    const body = liveBody();
    const cookie = `__Host-modelduel-safety-v1=mds1_${"c".repeat(32)}`;
    const first = await handleRevisionRequest(
      request(body, "application/json", cookie),
      dependencies,
    );
    expect(first.status).toBe(504);

    const replay = await handleRevisionRequest(
      request(
        {
          ...body,
          requestId: "revision-route-live-request-2",
          idempotencyKey: "revision-route-live-idempotency-2",
        },
        "application/json",
        cookie,
      ),
      dependencies,
    );
    expect(replay.status).toBe(504);
    expect(await replay.json()).toMatchObject({
      error: { code: "UPSTREAM_TIMEOUT", retryable: true },
    });
    expect(calls).toBe(1);
    expect(rateLimitStore.globals.get("live-revision")?.count).toBe(1);
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
