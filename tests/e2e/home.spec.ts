import { expect, test, type Page } from "@playwright/test";

const revisedExplanation =
  "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.";

async function startChallenge(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
}

async function advanceToObservation(page: Page) {
  await startChallenge(page);
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
}

type DeferredJsonRoute = {
  started: Promise<void>;
  settled: Promise<void>;
  release: () => void;
};

async function installDeferredJsonRoute(
  page: Page,
  url: string,
  responseFor: (body: Record<string, unknown>) => {
    status: number;
    body: unknown;
  },
): Promise<DeferredJsonRoute> {
  let release!: () => void;
  let markStarted!: () => void;
  let markSettled!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const settled = new Promise<void>((resolve) => {
    markSettled = resolve;
  });

  await page.route(url, async (route) => {
    const requestBody = route.request().postDataJSON() as Record<string, unknown>;
    markStarted();
    await gate;
    const response = responseFor(requestBody);
    try {
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: JSON.stringify(response.body),
      });
    } catch {
      // Reset aborts the browser request, so a late route fulfillment may be cancelled.
    } finally {
      markSettled();
    }
  });

  return { started, settled, release };
}

async function expectFreshCaptureAndVerifiedReuse(page: Page) {
  await expect(page.getByRole("heading", { name: "Two models predict. Evidence decides." })).toBeVisible();
  await expect(page.locator(".protected-state-error")).toHaveCount(0);
  await expect(page.getByTestId("revision-trace")).toHaveCount(0);
  await expect(page.getByTestId("transfer-error")).toHaveCount(0);
  await expect(page.getByText(/Revision response received|Transfer response received/)).toHaveCount(0);
  await expect(page.getByText(/Revision check failed|Transfer check failed/)).toHaveCount(0);

  const verifiedCta = page.getByRole("button", { name: "Run verified sample" });
  await expect(verifiedCta).toBeEnabled();
  await verifiedCta.click();
  await expect(page.getByRole("heading", { name: "Turn one disagreement into a fair test." })).toBeVisible();
}

test("reset discards a deferred revision response and keeps a fresh attempt usable", async ({ page }) => {
  await advanceToRevision(page);
  const deferred = await installDeferredJsonRoute(page, "**/api/revision", (body) => ({
    status: 200,
    body: {
      source: "deterministic-authored-rubric",
      notice: "STALE REVISION NOTICE MUST NOT APPEAR",
      requestId: body.requestId,
      evaluatedAt: Date.now(),
      feedback: {
        conceptualChange: "revised",
        score: 1,
        summary: "STALE REVISION FEEDBACK MUST NOT APPEAR",
        strengths: ["stale feedback"],
        nextStep: "stale next step",
      },
    },
  }));

  await page.getByRole("button", { name: "Capture revision and continue" }).click();
  await deferred.started;
  await page.getByRole("button", { name: "New attempt" }).click();
  deferred.release();
  await deferred.settled;

  await expect(page.getByText("STALE REVISION NOTICE MUST NOT APPEAR")).toHaveCount(0);
  await expect(page.getByText("STALE REVISION FEEDBACK MUST NOT APPEAR")).toHaveCount(0);
  await expectFreshCaptureAndVerifiedReuse(page);
});

test("reset discards a deferred transfer result and keeps a fresh attempt usable", async ({ page }) => {
  await advanceToTransfer(page);
  await page.getByLabel("The Moon is in the Sun's direction").check();
  const deferred = await installDeferredJsonRoute(page, "**/api/transfer", (body) => ({
    status: 200,
    body: {
      receiptId: "receipt-stale-reset-test",
      evaluationId: body.evaluationId,
      questionId: body.questionId,
      questionVersion: body.questionVersion,
      selectedOptionId: body.selectedOptionId,
      isCorrect: true,
      score: 1,
      rationale: "STALE TRANSFER RESULT MUST NOT APPEAR",
      evaluatedAt: Date.now(),
      source: "deterministic-question-bank",
    },
  }));

  await page.getByRole("button", { name: "Lock and check answer" }).click();
  await deferred.started;
  await page.getByRole("button", { name: "New attempt" }).click();
  deferred.release();
  await deferred.settled;

  await expect(page.getByText("STALE TRANSFER RESULT MUST NOT APPEAR")).toHaveCount(0);
  await expectFreshCaptureAndVerifiedReuse(page);
});

async function advanceToRevision(page: Page) {
  await advanceToObservation(page);
  await page.getByRole("button", { name: "Run both worlds and reveal evidence" }).click();
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await page.getByLabel("Revised causal explanation").fill(revisedExplanation);
}

async function advanceToTransfer(page: Page) {
  await advanceToObservation(page);
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await page.getByLabel("Revised causal explanation").fill(revisedExplanation);
  await page.getByRole("button", { name: "Capture revision and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Can your revised model travel?" }),
  ).toBeVisible();
}

test("keeps physical evidence sealed until a prediction is locked and run", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ModelDuel | Evidence-led science learning");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Two models predict. Evidence decides.",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);

  await startChallenge(page);
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await expect(page.getByTestId("evidence-sealed")).toBeVisible();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);
  await page.getByLabel("Our viewing angle reveals half of the sunlit side").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await expect(page.getByTestId("verified-observation")).toContainText(
    "Earth-shadow intersection: none",
  );
  await expect(page.getByTestId("verified-observation")).toContainText(
    "model’s claim is shown separately",
  );
});

test("holds the session at interpretation when the validated demo fails, then retries", async ({
  page,
}) => {
  let demoRequests = 0;
  await page.route("**/api/demo?**", async (route) => {
    demoRequests += 1;
    if (demoRequests === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "The authored challenge is temporarily unavailable.",
            retryable: true,
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  const analyze = page.getByRole("button", { name: "Analyze with GPT-5.6" });
  await expect(analyze).toHaveAttribute("data-hydrated", "true");
  await expect(analyze).toBeEnabled();
  await page.getByRole("button", { name: "Run verified sample" }).click();

  await expect(
    page.getByRole("heading", { name: "Authored challenge unavailable" }),
  ).toBeVisible();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Can your revised model travel?" }),
  ).toHaveCount(0);
  await expect(page.getByText("No local sample was substituted.")).toBeVisible();

  await page.getByRole("button", { name: "Retry validated challenge" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  expect(demoRequests).toBe(2);
});

test("offers an explicit verified path when the GPT-5.6 API key is not configured", async ({
  page,
}) => {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "CONFIGURATION_REQUIRED",
          message: "Live analysis is not configured.",
          retryable: false,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();
  await expect(
    page.getByRole("heading", { name: "API key is not configured" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry GPT-5.6 analysis" })).toBeVisible();
  await page.getByRole("button", { name: "Run verified sample instead" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(page.getByText("Verified authored sample", { exact: true })).toBeVisible();
});

test("cancels and ignores a stale analysis response after New attempt", async ({
  page,
}) => {
  let releaseOldResponse!: () => void;
  let markOldRequestStarted!: () => void;
  let markOldHandlerSettled!: () => void;
  const oldResponseGate = new Promise<void>((resolve) => {
    releaseOldResponse = resolve;
  });
  const oldRequestStarted = new Promise<void>((resolve) => {
    markOldRequestStarted = resolve;
  });
  const oldHandlerSettled = new Promise<void>((resolve) => {
    markOldHandlerSettled = resolve;
  });

  await page.route("**/api/analyze", async (route) => {
    markOldRequestStarted();
    await oldResponseGate;
    try {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "Stale analysis response.",
            retryable: true,
          },
        }),
      });
    } catch {
      // The expected AbortController cancellation may close the route first.
    } finally {
      markOldHandlerSettled();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();
  await oldRequestStarted;
  await expect(
    page.getByRole("heading", { name: "Analyzing with GPT-5.6…" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New attempt" }).click();
  releaseOldResponse();
  await oldHandlerSettled;

  await expect(
    page.getByRole("heading", { name: "Two models predict. Evidence decides." }),
  ).toBeVisible();
  await expect(page.locator(".source-badge.live")).toHaveCount(0);
  await expect(page.getByText("Stale analysis response.")).toHaveCount(0);
  await expect(page.getByTestId("revision-trace")).toHaveCount(0);
  await expect(
    page.getByText("Live analysis unavailable. No evidence or score was shown."),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
});

test("runs the explicit verified sample with no learner input", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your current explanation").fill("");
  await page.getByRole("button", { name: "Run verified sample" }).click();

  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(page.getByText("Verified authored sample", { exact: true })).toBeVisible();
  await expect(
    page.getByText("did not analyze your typed explanation or sketch", {
      exact: false,
    }),
  ).toBeVisible();
});

test("blocks live analysis when both explanation and sketch are empty", async ({
  page,
}) => {
  let analyzeRequests = 0;
  await page.route("**/api/analyze", async (route) => {
    analyzeRequests += 1;
    await route.abort();
  });

  await page.goto("/");
  await page.getByLabel("Your current explanation").fill("");
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();

  await expect(
    page.getByText("Add an explanation or a valid sketch for live GPT-5.6 analysis."),
  ).toBeVisible();
  expect(analyzeRequests).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Two models predict. Evidence decides." }),
  ).toBeVisible();
});

test("submits a sketch-only live analysis with an empty explanation", async ({
  page,
}) => {
  type PostedAnalyzeRequest = {
    explanation: string;
    sketch: { mimeType: string; dataUrl: string } | null;
  };
  const captured: { posted: PostedAnalyzeRequest | null } = { posted: null };
  await page.route("**/api/analyze", async (route) => {
    captured.posted = route.request().postDataJSON() as PostedAnalyzeRequest;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "CONFIGURATION_REQUIRED",
          message: "Live analysis is not configured.",
          retryable: false,
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Your current explanation").fill("");
  await page.getByLabel("Add a sketch optional").setInputFiles({
    name: "moon-sketch.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]),
  });
  await expect(
    page.getByText("uploaded only if you choose live GPT analysis", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();

  await expect(
    page.getByRole("heading", { name: "API key is not configured" }),
  ).toBeVisible();
  expect(captured.posted).toMatchObject({
    explanation: "",
    sketch: { mimeType: "image/png" },
  });
  await expect
    .poll(() => captured.posted?.sketch?.dataUrl)
    .toMatch(/^data:image\/png;base64,/);
});

test("labels a correlated live analysis with the exact GPT-5.6 model", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    const request = route.request().postDataJSON() as {
      requestId: string;
      sessionId: string;
    };
    const demoResponse = await page.request.get(
      `/api/demo?sessionId=${request.sessionId}&scenarioId=moon-phases`,
    );
    const demo = (await demoResponse.json()) as {
      analysis: Record<string, unknown> & { metadata: unknown };
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live",
        notice: "Analyzed with GPT-5.6 using validated orchestration.",
        requestId: request.requestId,
        analysis: {
          ...demo.analysis,
          metadata: {
            mode: "live",
            modelId: "gpt-5.6-sol",
            analyzedSubmission: true,
            orchestrationToolNames: [
              "validate_world_spec",
              "simulate_world",
              "compare_predictions",
              "select_discriminating_case",
            ],
          },
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(
    page.getByText("Live analysis · gpt-5.6-sol", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("GPT-5.6 analyzed your typed explanation", { exact: false })).toBeVisible();
});

test("completes the Moon path with server-authenticated transfer evidence", async ({
  page,
}) => {
  await advanceToTransfer(page);
  await page.getByLabel("The Moon is in the Sun's direction").check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();

  const trace = page.getByTestId("revision-trace");
  await expect(trace).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your revised model transferred." }),
  ).toBeVisible();
  await expect(trace).toContainText("Initial belief");
  await expect(trace).toContainText("Locked prediction");
  await expect(trace).toContainText("Verified observation");
  await expect(trace).toContainText(revisedExplanation);
  await expect(trace).toContainText("deterministic-question-bank");
});

test("never fabricates a local score when the transfer API fails", async ({ page }) => {
  await advanceToTransfer(page);
  await page.route("**/api/transfer", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "Evaluation service unavailable for this test.",
          retryable: true,
        },
      }),
    });
  });

  const option = page.getByLabel("The Moon is in the Sun's direction");
  await option.check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();

  const error = page.getByTestId("transfer-error");
  await expect(error).toContainText("No score was inferred in the browser");
  await expect(option).toBeDisabled();
  await expect(page.getByTestId("revision-trace")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry server check" })).toBeVisible();
});

test("supports the core prediction path from the keyboard", async ({ page }) => {
  await page.goto("/");
  const verified = page.getByRole("button", { name: "Run verified sample" });
  await expect(verified).toBeEnabled();
  await verified.focus();
  await page.keyboard.press("Enter");
  const predict = page.getByRole("button", { name: "Make a prediction" });
  await expect(predict).toBeVisible();
  await predict.focus();
  await page.keyboard.press("Enter");

  const choice = page.getByLabel("Our viewing angle reveals half of the sunlit side");
  await choice.focus();
  await page.keyboard.press("Space");
  await expect(choice).toBeChecked();
  const lock = page.getByRole("button", { name: "Lock prediction" });
  await lock.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your prediction is locked." }),
  ).toBeVisible();
});

test("keeps the 320px layout inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));

  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole("button", { name: "Analyze with GPT-5.6" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run verified sample" })).toBeVisible();
});
