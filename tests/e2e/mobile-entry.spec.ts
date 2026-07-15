import { expect, test } from "@playwright/test";

const STEP_LABELS = [
  "Capture",
  "Interpret",
  "Predict",
  "Observe",
  "Revise",
  "Transfer",
  "Trace",
] as const;

test("keeps the first task and all seven progress steps usable at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const progress = page.getByRole("navigation", {
    name: "Moon challenge progress",
  });
  await expect(progress.locator(".progress-current")).toHaveText(
    "Step 1 of 7 · Capture",
  );

  for (const label of STEP_LABELS) {
    await expect(
      progress.locator("ol").getByText(label, { exact: true }),
    ).toHaveCount(1);
  }
  const semanticLabels = progress.locator("ol li > span:last-child");
  await expect(semanticLabels).toHaveCount(7);
  const clippedLabels = await semanticLabels.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        height: bounds.height,
        position: getComputedStyle(element).position,
        width: bounds.width,
      };
    }),
  );
  for (const label of clippedLabels) {
    expect(label.position).toBe("absolute");
    expect(label.width).toBeLessThanOrEqual(1);
    expect(label.height).toBeLessThanOrEqual(1);
  }

  const layout = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(
    layout.documentClientWidth,
  );

  const progressWidths = await progress.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(progressWidths.scrollWidth).toBeLessThanOrEqual(
    progressWidths.clientWidth,
  );

  const captureCard = page.locator(".capture-card");
  await expect(captureCard).toBeVisible();
  const cardBounds = await captureCard.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, viewportWidth: innerWidth };
  });
  expect(cardBounds.top).toBeGreaterThan(0);
  expect(cardBounds.top).toBeLessThan(600);
  expect(cardBounds.right).toBeLessThanOrEqual(cardBounds.viewportWidth);

  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(progress.locator(".progress-current")).toHaveText(
    "Step 2 of 7 · Interpret",
  );
});
