import { expect, test } from "@playwright/test";

test("makes the instant verified Moon duel the primary default path", async ({
  page,
}) => {
  let analyzeRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/analyze")) analyzeRequests += 1;
  });

  await page.goto("/");

  await expect(
    page.getByText(
      "Pit the common claim that Earth's shadow causes Moon phases against the sunlight-and-viewing-angle model, then run both worlds under one sealed test.",
      { exact: true },
    ),
  ).toBeVisible();

  const actions = page.locator(".capture-actions");
  const instantChallenge = actions.getByRole("button").nth(0);
  const liveProof = actions.getByRole("button").nth(1);

  await expect(instantChallenge).toHaveClass(/primary-button/);
  await expect(instantChallenge).toHaveAttribute("type", "submit");
  await expect(instantChallenge).toContainText("Run verified sample");
  await expect(instantChallenge).toContainText(
    "Instant Moon phases challenge · no API wait",
  );
  await expect(liveProof).toHaveClass(/secondary-button/);
  await expect(liveProof).toHaveAttribute("type", "button");
  await expect(liveProof).toContainText("Analyze with GPT-5.6");
  await expect(liveProof).toContainText(
    "Live technical proof · about 20 seconds",
  );
  await expect(liveProof).toBeDisabled();

  await expect(
    page.getByText(
      "Live GPT is only for people 18 or older, or learners using it with teacher or guardian authorization. Do not enter a student’s name or any personal or identifying information. For replay safety, ModelDuel schedules normalized live revision feedback for deletion after the authorization window and a one-minute grace. It attempts to re-arm cleanup after storage failures; its replay ledger does not store the raw revised explanation. The verified sample is open to everyone, sends no learner input to GPT, and requires no confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "I am 18 or older, or I have teacher or guardian authorization, and I will not include personal or identifying student information anywhere in this live attempt, including my revised explanation.",
    }),
  ).not.toBeChecked();

  const verifiedRequest = page.waitForRequest((request) =>
    request.url().includes("/api/demo?sessionId="),
  );
  await instantChallenge.click();
  await verifiedRequest;

  await expect(
    page.getByRole("heading", {
      name: "Turn one disagreement into a fair test.",
    }),
  ).toBeVisible();
  expect(analyzeRequests).toBe(0);
});

for (const viewport of [
  { width: 768, height: 1024, maximumVerifiedTop: 900 },
  { width: 1280, height: 900, maximumVerifiedTop: 720 },
] as const) {
  test(`puts the verified path before live consent at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    const verifiedActions = page.getByRole("button", {
      name: /Run verified sample/,
    });
    await expect(verifiedActions).toHaveCount(1);
    const verified = page.locator(".capture-card-verified-action");
    const confirmation = page.getByRole("checkbox", {
      name: /I am 18 or older, or I have teacher or guardian authorization/,
    });
    const live = page.getByRole("button", { name: /Analyze with GPT-5\.6/ });
    await expect(verified).toBeVisible();
    await expect(verified).toBeEnabled();
    await expect(confirmation).not.toBeChecked();
    await expect(live).toBeDisabled();

    const verifiedBox = await verified.boundingBox();
    expect(verifiedBox).not.toBeNull();
    expect(verifiedBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
      viewport.maximumVerifiedTop,
    );
    const nativeOrder = await page.evaluate(() => {
      const verifiedControl = document.querySelector(
        ".capture-card-verified-action",
      );
      const confirmationControl = document.querySelector(
        ".live-use-boundary input",
      );
      const explanationControl = document.querySelector(
        "#learner-explanation",
      );
      const sketchControl = document.querySelector("#learner-sketch");
      const liveControl = document.querySelector(
        ".capture-actions-live .secondary-button",
      );
      if (
        !verifiedControl ||
        !explanationControl ||
        !sketchControl ||
        !confirmationControl ||
        !liveControl
      ) return null;
      return {
        explanationFollowsVerified: Boolean(
          verifiedControl.compareDocumentPosition(explanationControl) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        sketchFollowsExplanation: Boolean(
          explanationControl.compareDocumentPosition(sketchControl) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        confirmationFollowsSketch: Boolean(
          sketchControl.compareDocumentPosition(confirmationControl) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        liveFollowsConfirmation: Boolean(
          confirmationControl.compareDocumentPosition(liveControl) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    });
    expect(nativeOrder).toEqual({
      explanationFollowsVerified: true,
      sketchFollowsExplanation: true,
      confirmationFollowsSketch: true,
      liveFollowsConfirmation: true,
    });

    const typography = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const heading = getComputedStyle(
        document.querySelector("#capture-title") as HTMLElement,
      );
      return {
        bodyFamily: body.fontFamily,
        headingFamily: heading.fontFamily,
        headingLineHeight: Number.parseFloat(heading.lineHeight),
        headingFontSize: Number.parseFloat(heading.fontSize),
      };
    });
    expect(typography.headingFamily).not.toBe(typography.bodyFamily);
    expect(typography.headingFamily.split(",")[0]).not.toBe(
      typography.bodyFamily.split(",")[0],
    );
    expect(
      typography.headingLineHeight / typography.headingFontSize,
    ).toBeGreaterThanOrEqual(0.98);
    expect(
      typography.headingLineHeight / typography.headingFontSize,
    ).toBeLessThanOrEqual(1.02);

    await confirmation.check();
    await expect(live).toBeEnabled();
    await confirmation.uncheck();
    await expect(live).toBeDisabled();
    await verified.click();
    const stepHeading = page.locator(".stage-heading-block h1");
    await expect(stepHeading).toBeVisible();
    const stepHeadingFamily = await stepHeading.evaluate(
      (element) => getComputedStyle(element).fontFamily,
    );
    expect(stepHeadingFamily).toBe(typography.headingFamily);
    expect(stepHeadingFamily).not.toBe(typography.bodyFamily);
  });
}

test("keeps live GPT-5.6 analysis explicit and secondary", async ({ page }) => {
  let demoRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/demo")) demoRequests += 1;
  });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Mocked live analysis outage.",
          retryable: true,
        },
      }),
    });
  });

  await page.goto("/");
  const confirmation = page.getByRole("checkbox", {
    name: "I am 18 or older, or I have teacher or guardian authorization, and I will not include personal or identifying student information anywhere in this live attempt, including my revised explanation.",
  });
  const liveAnalysis = page.getByRole("button", {
    name: /Analyze with GPT-5\.6/,
  });
  await expect(liveAnalysis).toBeDisabled();
  await confirmation.check();
  await expect(liveAnalysis).toBeEnabled();
  await page
    .getByRole("button", { name: /Analyze with GPT-5\.6/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "GPT-5.6 analysis unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Mocked live analysis outage.")).toBeVisible();
  expect(demoRequests).toBe(0);
});

test("requires a fresh live-use confirmation after changing challenge", async ({
  page,
}) => {
  await page.goto("/");
  const confirmation = page.getByRole("checkbox", {
    name: "I am 18 or older, or I have teacher or guardian authorization, and I will not include personal or identifying student information anywhere in this live attempt, including my revised explanation.",
  });
  const liveAnalysis = page.getByRole("button", {
    name: /Analyze with GPT-5\.6/,
  });

  await confirmation.check();
  await expect(liveAnalysis).toBeEnabled();
  await page
    .getByRole("radio", { name: /Seasons/ })
    .locator("xpath=ancestor::label")
    .click();

  await expect(confirmation).not.toBeChecked();
  await expect(liveAnalysis).toBeDisabled();
  await expect(
    page.locator(".capture-actions").getByRole("button", {
      name: /Run verified sample/,
    }),
  ).toBeEnabled();
});

test("defers WebGL probing until the evidence comparison mounts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = globalThis as typeof globalThis & {
      __modelDuelWebGlProbeCount?: number;
    };
    state.__modelDuelWebGlProbeCount = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...argumentsList: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") {
        state.__modelDuelWebGlProbeCount =
          (state.__modelDuelWebGlProbeCount ?? 0) + 1;
        return null;
      }
      return Reflect.apply(getContext, this, [contextId, ...argumentsList]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  const probeCount = () =>
    page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __modelDuelWebGlProbeCount?: number;
          }
        ).__modelDuelWebGlProbeCount ?? 0,
    );

  await page.goto("/");
  expect(await probeCount()).toBe(0);
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await expect(
    page.getByRole("heading", { name: "Your prediction is locked." }),
  ).toBeVisible();
  expect(await probeCount()).toBe(0);

  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await expect.poll(probeCount).toBeGreaterThan(0);
  await expect(page.locator(".world-html-fallback")).toHaveCount(2);
  await expect(page.locator(".view-controls")).toHaveCount(0);
  await expect(
    page.getByText("Static evidence view · camera controls are not needed.", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await expect(
    page.getByRole("heading", { name: "What changed in your explanation?" }),
  ).toBeVisible();
});

test("removes camera controls when the interactive Canvas cannot start", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let availabilityProbePending = true;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...argumentsList: unknown[]
    ) {
      if (
        availabilityProbePending &&
        (contextId === "webgl" || contextId === "webgl2")
      ) {
        availabilityProbePending = false;
        return {
          getExtension: () => ({ loseContext: () => undefined }),
        } as unknown as WebGLRenderingContext;
      }
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(getContext, this, [contextId, ...argumentsList]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();

  await expect(page.locator(".world-html-fallback")).toHaveCount(2);
  await expect(page.locator(".view-controls")).toHaveCount(0);
  await expect(
    page.getByText("Static evidence view · camera controls are not needed.", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(page.getByTestId("verified-observation")).toBeVisible();
});
