import { afterEach, describe, expect, it, vi } from "vitest";
import { createCaseFingerprint } from "../../../lib/modelduel/simulation";
import { verifyLiveRevisionToken } from "../../../server/modelduel/evaluation";

import { POST as transferPost } from "../transfer/route";
import { GET, POST } from "./route";

const SECRET = "modelduel-demo-route-test-secret-long-enough";

type SeasonsDemoBundle = {
  source: string;
  notice: string;
  analysis: {
    scenarioId: "seasons";
    caseSpec: {
      id: string;
      scenario: "seasons";
      earthSolarLongitudeDeg: number;
      earthSunDistanceAu: number;
      latitudeDeg: number;
      observedAxialTiltDeg: number;
    };
    learnerWorld: {
      worldId: string;
      scenario: "seasons";
      claims: { distanceCausesSeasons: boolean };
      parameters: { axialTiltDeg: number };
    };
    scientificWorld: {
      worldId: string;
      scenario: "seasons";
      claims: { distanceCausesSeasons: boolean };
      parameters: { axialTiltDeg: number };
    };
    transferQuestion: {
      evaluationId: string;
      questionId: string;
      version: string;
      options: Array<{ id: string }>;
    };
  };
};

type DemoBundle = {
  source: string;
  notice: string;
  analysis: {
    transferQuestion: {
      evaluationId: string;
      questionId: string;
      version: string;
      options: Array<{ id: string }>;
    };
  };
};

function getRequest(query: string): Request {
  return new Request(`http://localhost/api/demo?${query}`);
}

function postRequest(
  payload: unknown,
  contentType = "application/json",
): Request {
  return new Request("http://localhost/api/demo", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(payload),
  });
}

function transferRequest(
  bundle: DemoBundle,
  sessionId: string,
  index: number,
  selectedOptionId = "toward-sun",
): Request {
  const question = bundle.analysis.transferQuestion;
  return new Request("http://localhost/api/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: `demo-transfer-request-${index}`,
      idempotencyKey: `demo-transfer-idempotency-${index}`,
      requestedAt: Date.now(),
      evaluationId: question.evaluationId,
      sessionId,
      questionId: question.questionId,
      questionVersion: question.version,
      selectedOptionId,
    }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/demo verified issuance", () => {
  it("issues a session-bound Seasons bundle without exposing private evaluation material", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const sessionId = "seasons-demo-session";
    const response = await GET(
      getRequest(`sessionId=${sessionId}&scenarioId=seasons`),
    );
    const text = await response.text();
    const bundle = JSON.parse(text) as SeasonsDemoBundle;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(bundle.source).toBe("verified-sample");
    expect(bundle.analysis.scenarioId).toBe("seasons");
    expect(bundle.analysis.learnerWorld).toMatchObject({
      worldId: "seasons-learner-distance-v1",
      scenario: "seasons",
      claims: { distanceCausesSeasons: true },
      parameters: { axialTiltDeg: 0 },
    });
    expect(bundle.analysis.scientificWorld).toMatchObject({
      worldId: "seasons-scientific-tilt-v1",
      scenario: "seasons",
      claims: { distanceCausesSeasons: false },
      parameters: { axialTiltDeg: 23.44 },
    });
    expect(bundle.analysis.caseSpec).toEqual({
      id: "seasons-june-solstice",
      scenario: "seasons",
      earthSolarLongitudeDeg: 90,
      earthSunDistanceAu: 1.017,
      latitudeDeg: 45,
      observedAxialTiltDeg: 23.44,
    });
    expect(createCaseFingerprint(bundle.analysis.caseSpec)).toBe(
      "case-v1|seasons|id=seasons-june-solstice|longitude=90.000000|distance=1.017000|latitude=45.000000|observed-tilt=23.440000",
    );
    expect(bundle.analysis.transferQuestion).toMatchObject({
      questionId: "seasons-december-transfer",
      version: "seasons-transfer-v1",
    });
    expect(bundle.analysis.transferQuestion.evaluationId).toMatch(/^v1\./);
    expect(bundle.analysis.transferQuestion.evaluationId).not.toBe(
      "seasons-transfer-evaluation-v1",
    );
    const verificationNow = Date.now();
    try {
      verifyLiveRevisionToken({
        evaluationId: bundle.analysis.transferQuestion.evaluationId,
        sessionId,
        requestedAt: verificationNow,
        now: verificationNow,
      });
      expect.fail("verified demo token must not authorize live revision");
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_TOKEN" });
    }
    expect(text).not.toContain("correctOptionId");
    expect(text).not.toContain("rationale");

    const transferResponse = await transferPost(
      transferRequest(bundle, sessionId, 20, "reverse"),
    );
    const transferBody = (await transferResponse.json()) as {
      isCorrect: boolean;
      score: number;
    };
    expect(transferResponse.status).toBe(200);
    expect(transferBody).toMatchObject({ isCorrect: true, score: 1 });
  });

  it("serves valid GET and POST bundles without private answer material", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const getResponse = await GET(
      getRequest("sessionId=demo-get-session&scenarioId=moon-phases"),
    );
    const postResponse = await POST(
      postRequest({
        sessionId: "demo-post-session",
        scenarioId: "moon-phases",
      }),
    );
    const getText = await getResponse.text();
    const postText = await postResponse.text();
    const getBundle = JSON.parse(getText) as DemoBundle;
    const postBundle = JSON.parse(postText) as DemoBundle;

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
    expect(getResponse.headers.get("cache-control")).toBe("no-store");
    expect(postResponse.headers.get("cache-control")).toBe("no-store");
    expect(getBundle.analysis.transferQuestion.evaluationId).toMatch(/^v1\./);
    expect(postBundle.analysis.transferQuestion.evaluationId).toMatch(/^v1\./);
    expect(getText).not.toContain("correctOptionId");
    expect(postText).not.toContain("correctOptionId");
    expect(getText).not.toContain(
      "At new Moon, the Moon is in the Sun's direction from Earth",
    );
    expect(postText).not.toContain(
      "At new Moon, the Moon is in the Sun's direction from Earth",
    );
  });

  it("issues GET and POST tokens accepted by the transfer route", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const cases = [
      {
        sessionId: "demo-integration-get",
        response: await GET(
          getRequest(
            "sessionId=demo-integration-get&scenarioId=moon-phases",
          ),
        ),
      },
      {
        sessionId: "demo-integration-post",
        response: await POST(
          postRequest({
            sessionId: "demo-integration-post",
            scenarioId: "moon-phases",
          }),
        ),
      },
    ];

    for (const [index, item] of cases.entries()) {
      const bundle = (await item.response.json()) as DemoBundle;
      const evaluation = await transferPost(
        transferRequest(bundle, item.sessionId, index),
      );
      const result = (await evaluation.json()) as {
        isCorrect: boolean;
        score: number;
      };

      expect(evaluation.status).toBe(200);
      expect(evaluation.headers.get("cache-control")).toBe("no-store");
      expect(result).toMatchObject({ isCorrect: true, score: 1 });
    }
  });

  it.each([
    "sessionId=one&sessionId=two&scenarioId=moon-phases",
    "sessionId=one&scenarioId=moon-phases&unexpected=true",
    "sessionId=one",
  ])("rejects a non-strict GET query: %s", async (query) => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const response = await GET(getRequest(query));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error.code).toBe("INVALID_REQUEST");
  });

  it("rejects a non-JSON or non-strict POST body", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", SECRET);
    const badType = await POST(
      postRequest(
        { sessionId: "demo-post-session", scenarioId: "moon-phases" },
        "text/plain",
      ),
    );
    const unknown = await POST(
      postRequest({
        sessionId: "demo-post-session",
        scenarioId: "moon-phases",
        unexpected: true,
      }),
    );

    expect(((await badType.json()) as { error: { code: string } }).error.code).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
    expect(((await unknown.json()) as { error: { code: string } }).error.code).toBe(
      "INVALID_REQUEST",
    );
  });

  it("returns a safe configuration error for a configured weak secret", async () => {
    vi.stubEnv("MODELDUEL_EVALUATION_SECRET", "weak");
    const response = await GET(
      getRequest("sessionId=demo-weak-secret&scenarioId=moon-phases"),
    );
    const json = (await response.json()) as {
      error: { code: string; message: string; retryable: boolean };
    };

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.error).toEqual({
      code: "SERVER_CONFIGURATION",
      message: "The evaluation service is unavailable.",
      retryable: true,
    });
  });
});
