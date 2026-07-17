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
      "Live GPT is only for people 18 or older, or learners using it with teacher or guardian authorization. Do not enter a student’s name or any personal or identifying information. The verified sample is open to everyone, sends no learner input to GPT, and requires no confirmation.",
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
