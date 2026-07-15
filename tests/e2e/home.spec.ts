import { expect, test, type Page } from "@playwright/test";

const revisedExplanation =
  "The Moon appears half illuminated because sunlight lights one half and our viewing angle reveals half, while Earth's shadow does not intersect it.";

async function startChallenge(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Build the test" }).click();
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
  const build = page.getByRole("button", { name: "Build the test" });
  await expect(build).toHaveAttribute("data-hydrated", "true");
  await expect(build).toBeEnabled();
  await build.click();

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
  const build = page.getByRole("button", { name: "Build the test" });
  await build.focus();
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
  await expect(page.getByRole("button", { name: "Build the test" })).toBeVisible();
});
