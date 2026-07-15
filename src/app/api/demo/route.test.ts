import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as transferPost } from "../transfer/route";
import { GET, POST } from "./route";

const SECRET = "modelduel-demo-route-test-secret-long-enough";

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

function transferRequest(bundle: DemoBundle, sessionId: string, index: number): Request {
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
      selectedOptionId: "toward-sun",
    }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/demo verified issuance", () => {
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
