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
  await page
    .getByRole("button", { name: /Analyze with GPT-5\.6/ })
    .click();

  await expect(
    page.getByRole("heading", { name: "GPT-5.6 analysis unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Mocked live analysis outage.")).toBeVisible();
  expect(demoRequests).toBe(0);
});
