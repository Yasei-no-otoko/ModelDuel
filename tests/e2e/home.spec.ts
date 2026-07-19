import { expect, test, type Page } from "@playwright/test";

const TEST_ORIGIN = "http://localhost:3000";

type VerifiedRequestLedger = {
  api: Array<{
    method: string;
    pathname: string;
    revisionMode: string | null;
  }>;
  externalHttp: string[];
};

const EXPECTED_VERIFIED_API_LEDGER = [
  { method: "GET", pathname: "/api/demo", revisionMode: null },
  {
    method: "POST",
    pathname: "/api/revision",
    revisionMode: "verified-sample",
  },
  { method: "POST", pathname: "/api/transfer", revisionMode: null },
] as const;

function observeVerifiedRequestLedger(page: Page): VerifiedRequestLedger {
  const ledger: VerifiedRequestLedger = { api: [], externalHttp: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== TEST_ORIGIN) {
      ledger.externalHttp.push(`${request.method()} ${url.origin}${url.pathname}`);
      return;
    }
    if (!url.pathname.startsWith("/api/")) return;

    const body =
      request.method() === "GET"
        ? null
        : (request.postDataJSON() as Record<string, unknown> | null);
    ledger.api.push({
      method: request.method(),
      pathname: url.pathname,
      revisionMode: typeof body?.mode === "string" ? body.mode : null,
    });
  });
  return ledger;
}

const revisedExplanation =
  "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.";

const seasonsRevisedExplanation =
  "Earth's axial tilt changes the sunlight angle, so the Northern and Southern Hemispheres receive different energy and experience opposite seasons.";

const liveUseConfirmation =
  "I am 18 or older, or I have teacher or guardian authorization, and I will not include personal or identifying student information anywhere in this live attempt, including my revised explanation.";

async function confirmLiveUse(page: Page) {
  await page.getByRole("checkbox", { name: liveUseConfirmation }).check();
}

async function selectScenario(page: Page, scenario: "moon-phases" | "seasons") {
  const name = scenario === "seasons" ? /Seasons/ : /Moon phases/;
  const radio = page.getByRole("radio", { name });
  await radio.locator("xpath=ancestor::label").click();
  await expect(radio).toBeChecked();
}

async function startChallenge(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
}

async function startSeasonsChallenge(page: Page) {
  await page.goto("/");
  await selectScenario(page, "seasons");
  await expect(page.getByLabel("Your current explanation")).toHaveValue(
    /Summer happens because Earth moves closer/,
  );
  const requestPromise = page.waitForRequest((request) =>
    request.url().includes("/api/demo?sessionId=") &&
    request.url().includes("scenarioId=seasons"),
  );
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await requestPromise;
  await expect(
    page.getByRole("heading", {
      name: "Turn one disagreement into a fair test.",
    }),
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

test("explains the duel through the interactive hero before the challenge starts", async ({
  page,
}) => {
  await page.goto("/");

  const visualizer = page.getByTestId("hero-visualizer");
  await expect(visualizer).toBeVisible();
  const focusControls = visualizer.getByRole("group", {
    name: "Focus the 3D comparison",
  });
  await expect(focusControls.getByRole("button")).toHaveCount(3);

  const learnerFocus = focusControls.getByRole("button", {
    name: "Learner claim",
  });
  await learnerFocus.click();
  await expect(learnerFocus).toHaveAttribute("aria-pressed", "true");
  await expect(
    visualizer.locator("figcaption").getByText(
      "Learner claim: Earth’s shadow is proposed as the cause.",
    ),
  ).toBeVisible();

  const evidenceFocus = focusControls.getByRole("button", {
    name: "Shared evidence",
  });
  await evidenceFocus.click();
  await expect(evidenceFocus).toHaveAttribute("aria-pressed", "true");
  await expect(
    visualizer.locator("figcaption").getByText(
      "Shared evidence: the half-lit Moon appears without Earth-shadow intersection.",
    ),
  ).toBeVisible();

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

test("completes the verified Seasons journey with sealed evidence and a transfer trace", async ({ page }) => {
  const verifiedLedger = observeVerifiedRequestLedger(page);
  await startSeasonsChallenge(page);
  await expect(page.getByText("Verified authored sample", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "This is a deterministic verified sample, not a live GPT response.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/distance explanation into a learner world/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page
    .getByLabel("One receives more direct light while the other receives less")
    .check();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);
  await expect(page.getByText(/relative incident energy/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await expect(page.getByTestId("verified-observation")).toHaveCount(0);
  await expect(
    page.getByText(/June observation and relative energy evidence stay sealed/i),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await expect(
    page.getByText(
      "Northern Hemisphere: summer; Southern Hemisphere: winter.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/Relative incident energy index:/)).toBeVisible();

  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await page
    .getByLabel("Revised causal explanation")
    .fill(seasonsRevisedExplanation);
  await page
    .getByRole("button", { name: "Capture revision and continue" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Can your revised model travel?" }),
  ).toBeVisible();
  await page.getByLabel("The higher-energy hemisphere reverses").check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();

  await expect(
    page.getByRole("heading", { name: "Your revised model transferred." }),
  ).toBeVisible();
  await expect(page.getByText("Model Revision Trace · complete", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Verified observation · seasonal evidence", { exact: true }),
  ).toBeVisible();
  const detailedTrace = page.locator(".trace-list");
  await expect(
    detailedTrace.getByRole("heading", {
      name: /Northern summer; Southern winter; relative incident energy/,
    }),
  ).toBeVisible();
  await expect(
    detailedTrace.getByRole("heading", { name: "Correct · 1/1", exact: true }),
  ).toBeVisible();
  const seasonsDebrief = page.getByTestId("teacher-debrief");
  await expect(seasonsDebrief).toContainText(
    "If Earth–Sun distance caused seasons, how could the two hemispheres have opposite seasons at the same time?",
  );
  await expect(seasonsDebrief).toContainText(
    "Listen for axial tilt changing sunlight angle and relative incoming energy in opposite ways while both hemispheres share one Earth–Sun distance.",
  );
  const seasonsHandoff = page.getByLabel("Teacher handoff preview");
  await expect(seasonsHandoff).toContainText("Scenario\n  Seasons");
  await expect(seasonsHandoff).toContainText("Verified authored sample");
  await expect(seasonsHandoff).toContainText(
    "Northern summer; Southern winter; relative incident energy",
  );
  await expect(seasonsHandoff).toContainText(
    "If Earth–Sun distance caused seasons, how could the two hemispheres have opposite seasons at the same time?",
  );
  await expect(seasonsHandoff).not.toContainText("deterministic-question-bank");
  expect(verifiedLedger.api).toEqual(EXPECTED_VERIFIED_API_LEDGER);
  expect(verifiedLedger.externalHttp).toEqual([]);

  await page
    .getByRole("button", { name: "New attempt", exact: true })
    .click();
  await expect(page.getByRole("radio", { name: /Seasons/ })).toBeChecked();
  await expect(page.getByLabel("Your current explanation")).toHaveValue(
    /Summer happens because Earth moves closer/,
  );
});

test("ignores a deferred Moon response after reset and switching to Seasons", async ({ page }) => {
  await page.goto("/");
  const routePattern = "**/api/demo**";
  const deferred = await installDeferredJsonRoute(
    page,
    routePattern,
    () => ({
      status: 503,
      body: {
        error: {
          code: "INTERNAL_ERROR",
          message: "STALE MOON RESPONSE MUST NOT APPEAR",
          retryable: true,
        },
      },
    }),
  );

  await page.getByRole("button", { name: "Run verified sample" }).click();
  await deferred.started;
  await page.getByRole("button", { name: "New attempt" }).click();
  await selectScenario(page, "seasons");
  deferred.release();
  await deferred.settled;
  await page.unroute(routePattern);

  await expect(page.getByRole("radio", { name: /Seasons/ })).toBeChecked();
  await expect(
    page.getByRole("heading", { name: "What causes Earth's seasons?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your current explanation")).toHaveValue(
    /Summer happens because Earth moves closer/,
  );
  await expect(page.getByText("STALE MOON RESPONSE MUST NOT APPEAR")).toHaveCount(0);
  await expect(page.locator(".protected-state-error")).toHaveCount(0);
  await expect(page.getByTestId("revision-trace")).toHaveCount(0);
  await expect(page.locator(".source-badge.live")).toHaveCount(0);

  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(page.getByText("Verified authored sample", { exact: true })).toBeVisible();
});

test("keeps the Seasons selector readable without horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await selectScenario(page, "seasons");

  await expect(page.getByRole("radio", { name: /Seasons/ })).toBeChecked();
  await expect(
    page.getByRole("heading", { name: "What causes Earth's seasons?" }),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

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
  await expect(analyze).toBeDisabled();
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
  await confirmLiveUse(page);
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();
  await expect(
    page.getByRole("heading", { name: "API key is not configured" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry GPT-5.6 analysis" })).toHaveCount(0);
  await page.getByRole("button", { name: "Run verified sample instead" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(page.getByText("Verified authored sample", { exact: true })).toBeVisible();
});

test("stops an unsupported live claim without a paid retry and offers the verified contrast", async ({
  page,
}) => {
  let analyzeRequests = 0;
  let demoRequests = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/analyze") analyzeRequests += 1;
    if (path === "/api/demo") demoRequests += 1;
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({
        error: {
          code: "UNSUPPORTED_MISCONCEPTION",
          message:
            "This pilot could not map the explanation to the selected validated misconception contrast.",
          retryable: false,
        },
      }),
    });
  });

  const uniqueExplanation =
    "I think reflected light from another planet changes the Moon's phases.";
  await page.goto("/");
  await page.getByLabel("Your current explanation").fill(uniqueExplanation);
  await confirmLiveUse(page);
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();

  await expect(
    page.getByRole("heading", { name: "This pilot cannot compare that claim yet" }),
  ).toBeVisible();
  await expect(page.getByText(/No second model request was started/)).toBeVisible();
  await expect(page.getByText(/confirmed live request already sent it once/)).toBeVisible();
  const submittedReview = page.getByTestId("submitted-input-review");
  await expect(submittedReview).toContainText(uniqueExplanation);
  await expect(submittedReview).toContainText("Sketch: none");
  await expect(page.getByRole("button", { name: "Retry GPT-5.6 analysis" })).toHaveCount(0);
  expect(analyzeRequests).toBe(1);

  await page.getByRole("button", { name: "Run verified sample instead" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(
    page.getByText("This is a deterministic verified sample, not a live GPT response.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(analyzeRequests).toBe(1);
  expect(demoRequests).toBe(1);
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
  await confirmLiveUse(page);
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
  await confirmLiveUse(page);
  const explanation = page.getByLabel("Your current explanation");
  await explanation.fill("");
  await expect(explanation).toHaveValue("");
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
    liveUseAttestation: true;
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
  await confirmLiveUse(page);
  await page.getByLabel("Choose sketch").setInputFiles({
    name: "moon-sketch.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]),
  });
  await expect(
    page.getByText("uploaded only if you choose live GPT analysis", {
      exact: false,
    }),
  ).toBeVisible();
  const explanation = page.getByLabel("Your current explanation");
  await explanation.fill("");
  await expect(explanation).toHaveValue("");
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();

  await expect(
    page.getByRole("heading", { name: "API key is not configured" }),
  ).toBeVisible();
  expect(captured.posted).toMatchObject({
    explanation: "",
    liveUseAttestation: true,
    sketch: { mimeType: "image/png" },
  });
  await expect
    .poll(() => captured.posted?.sketch?.dataUrl)
    .toMatch(/^data:image\/png;base64,/);
});

test("carries the live-use attestation through analysis and revision", async ({ page }) => {
  let capturedAnalyze: Record<string, unknown> | null = null;
  let capturedRevision: Record<string, unknown> | null = null;
  await page.route("**/api/analyze", async (route) => {
    const request = route.request().postDataJSON() as {
      requestId: string;
      sessionId: string;
    };
    capturedAnalyze = route.request().postDataJSON() as Record<string, unknown>;
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
            modelId: "gpt-5.6-terra",
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
  await confirmLiveUse(page);
  await page.getByRole("button", { name: "Analyze with GPT-5.6" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(
    page.getByText("Live analysis · gpt-5.6-terra", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("GPT-5.6 analyzed your typed explanation", { exact: false })).toBeVisible();
  expect(capturedAnalyze).toMatchObject({ liveUseAttestation: true });

  await page.route("**/api/revision", async (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>;
    capturedRevision = request;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "gpt-5.6",
        notice: "Revision feedback generated live with GPT-5.6.",
        requestId: request.requestId,
        modelId: "gpt-5.6-luna",
        evaluatedAt: Date.now(),
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "The revision now connects illumination and viewing angle.",
          strengths: ["Uses the observation as causal evidence."],
          nextStep: "Apply the model to the transfer case.",
        },
      }),
    });
  });

  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await expect(
    page.getByText(
      "Your live-use confirmation covers this entire attempt, including this revised explanation. Do not include names or personal or identifying student information. To prevent duplicate API charges, normalized feedback is scheduled for deletion after the authorization window and a one-minute grace. ModelDuel attempts to re-arm cleanup after storage failures. GPT feedback may be wrong; verify it with a teacher.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Revised causal explanation").fill(revisedExplanation);
  await page.locator(".revision-card button[type='submit']").click();
  await expect(
    page.getByRole("heading", { name: "Can your revised model travel?" }),
  ).toBeVisible();
  expect(capturedRevision).toMatchObject({
    mode: "live",
    liveUseAttestation: true,
  });
  await page.getByLabel("The Moon is in the Sun's direction").check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();
  const liveHandoff = page.getByLabel("Teacher handoff preview");
  await expect(liveHandoff).toContainText("Evidence source\n  Live GPT-5.6 analysis");
  await expect(liveHandoff).toContainText("Revision feedback\n  GPT-5.6 structured feedback");
  await expect(liveHandoff).not.toContainText("gpt-5.6-terra");
  await expect(liveHandoff).not.toContainText("gpt-5.6-luna");
});

test("completes the Moon path with server-authenticated transfer evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copiedTrace = text;
        },
      },
    });
  });
  const verifiedLedger = observeVerifiedRequestLedger(page);
  const internalIdentifiers = {
    sessionId: new Set<string>(),
    requestId: new Set<string>(),
    idempotencyKey: new Set<string>(),
    evaluationId: new Set<string>(),
    receiptId: new Set<string>(),
  };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return;
    const sessionId = url.searchParams.get("sessionId");
    if (sessionId) internalIdentifiers.sessionId.add(sessionId);
    if (request.method() !== "GET") {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      for (const key of ["sessionId", "requestId", "idempotencyKey", "evaluationId"] as const) {
        const value = body?.[key];
        if (typeof value === "string" && value) internalIdentifiers[key].add(value);
      }
    }
  });
  await advanceToTransfer(page);
  await page.getByLabel("The Moon is in the Sun's direction").check();
  const transferResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/transfer" && response.request().method() === "POST";
  });
  await page.getByRole("button", { name: "Lock and check answer" }).click();
  const transferPayload = (await (await transferResponsePromise).json()) as Record<
    string,
    unknown
  >;
  for (const key of ["evaluationId", "receiptId"] as const) {
    const value = transferPayload[key];
    if (typeof value === "string" && value) internalIdentifiers[key].add(value);
  }

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
  await expect(
    page.getByRole("heading", {
      name: "Review what changed—not just whether the answer was right.",
    }),
  ).toBeVisible();
  await expect(trace).toContainText("Before");
  await expect(trace).toContainText("Evidence → revision");
  await expect(trace).toContainText("Unseen transfer");
  const moonDebrief = page.getByTestId("teacher-debrief");
  await expect(moonDebrief).toContainText(
    "What would you expect to observe if Earth's shadow caused every phase, and how does that differ from the sunlight-and-viewing-angle model?",
  );
  await expect(moonDebrief).toContainText(
    "Listen for the learner to distinguish regular phases from eclipses and connect the illuminated fraction to Moon–Sun–Earth geometry.",
  );
  await expect(trace).toContainText(
    "This documents one completed attempt—not a grade, a longitudinal record, or proof of durable learning.",
  );

  const preview = page.getByLabel("Teacher handoff preview");
  const copyButton = page.getByTestId("copy-trace");
  const downloadButton = page.getByTestId("download-trace");
  const handoffStatus = trace.locator(".trace-handoff-status");
  const exportConfirmation = page.getByRole("checkbox", {
    name: /I reviewed the learner-written text/,
  });
  await expect(preview).toContainText(revisedExplanation);
  await expect(copyButton).toBeDisabled();
  await expect(downloadButton).toBeDisabled();

  expect(verifiedLedger.api).toEqual(EXPECTED_VERIFIED_API_LEDGER);
  expect(verifiedLedger.externalHttp).toEqual([]);
  const requestCountBeforeHandoff = verifiedLedger.api.length;
  const storageBeforeHandoff = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookies: document.cookie,
  }));
  await exportConfirmation.check();
  await copyButton.click();
  await expect(handoffStatus).toContainText("Teacher summary copied to the system clipboard.");
  const copiedTrace = await page.evaluate(
    () => document.documentElement.dataset.copiedTrace ?? "",
  );
  expect(copiedTrace).toContain("ModelDuel — Learner-controlled Revision Trace");
  expect(copiedTrace).toContain(revisedExplanation);
  expect(copiedTrace).not.toMatch(
    /receipt|session id|request id|cookie|deterministic-question-bank|gpt-5\.6-(?:terra|luna)/i,
  );
  for (const [kind, identifiers] of Object.entries(internalIdentifiers)) {
    expect(identifiers.size, `expected at least one captured ${kind}`).toBeGreaterThan(0);
    for (const identifier of identifiers) expect(copiedTrace).not.toContain(identifier);
  }
  const receiptNote = await trace
    .locator(".trace-note")
    .filter({ hasText: "receipt" })
    .textContent();
  const displayedReceipt = receiptNote?.split("receipt ").at(-1)?.trim();
  expect(displayedReceipt).toBeTruthy();
  expect(copiedTrace).not.toContain(displayedReceipt);

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("blocked")) },
    });
  });
  await copyButton.click();
  await expect(handoffStatus).toContainText(
    "Automatic copy is unavailable. The preview is selected;",
  );
  await expect(preview).toBeFocused();
  const selectedPreview = await preview.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  });
  expect(selectedPreview).toBe(copiedTrace);

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("modelduel-revision-trace.txt");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected a readable local trace download");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const downloadedTrace = Buffer.concat(chunks).toString("utf8");
  expect(downloadedTrace).toBe(copiedTrace);
  expect(downloadedTrace).not.toMatch(
    /receipt|session id|request id|cookie|deterministic-question-bank|gpt-5\.6-(?:terra|luna)/i,
  );
  for (const identifiers of Object.values(internalIdentifiers)) {
    for (const identifier of identifiers) expect(downloadedTrace).not.toContain(identifier);
  }
  expect(verifiedLedger.api).toHaveLength(requestCountBeforeHandoff);
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookies: document.cookie,
    })),
  ).toEqual(storageBeforeHandoff);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("heading", { name: /Let the learner choose/ })).toBeVisible();
  const mobileDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(mobileDimensions.page).toBeLessThanOrEqual(mobileDimensions.viewport);

  await page.getByRole("button", { name: "Start a new attempt" }).click();
  await expect(trace).toHaveCount(0);
  await expect(exportConfirmation).toHaveCount(0);
});

test("shows the authored support cue after an incorrect Moon transfer", async ({ page }) => {
  await advanceToTransfer(page);
  await page.getByLabel("The Moon is opposite the Sun").check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();

  const debrief = page.getByTestId("teacher-debrief");
  await expect(debrief).toContainText(
    "Listen for the learner to identify which half of the Moon sunlight illuminates and which half faces Earth at new moon before selecting an arrangement.",
  );
  await expect(debrief).not.toContainText(
    "Listen for the learner to distinguish regular phases from eclipses",
  );
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
