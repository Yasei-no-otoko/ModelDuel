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

test("keeps progress labels semantic and collision-free at 768px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");

  const progress = page.getByRole("navigation", {
    name: "Moon challenge progress",
  });
  await expect(progress.locator(".progress-current")).toBeVisible();
  await expect(progress.locator(".progress-current")).toHaveText(
    "Step 1 of 7 · Capture",
  );

  const semanticLabels = progress.locator("ol li > span:last-child");
  await expect(semanticLabels).toHaveCount(STEP_LABELS.length);
  for (const label of STEP_LABELS) {
    await expect(
      progress.locator("ol").getByText(label, { exact: true }),
    ).toHaveCount(1);
  }

  const labelLayouts = await semanticLabels.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        height: bounds.height,
        position: getComputedStyle(element).position,
        width: bounds.width,
      };
    }),
  );
  for (const label of labelLayouts) {
    expect(label.position).toBe("absolute");
    expect(label.width).toBeLessThanOrEqual(1);
    expect(label.height).toBeLessThanOrEqual(1);
  }

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  const visualizer = page.getByTestId("hero-visualizer");
  const captureCard = page.locator(".capture-card");
  const [visualizerBox, captureCardBox] = await Promise.all([
    visualizer.boundingBox(),
    captureCard.boundingBox(),
  ]);
  expect(visualizerBox).not.toBeNull();
  expect(captureCardBox).not.toBeNull();
  expect(visualizerBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
    captureCardBox?.y ?? Number.NEGATIVE_INFINITY,
  );
});

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
  const mobileVerifiedCta = page.getByTestId("mobile-verified-cta");
  await expect(mobileVerifiedCta).toBeVisible();
  await expect(
    page.locator(".capture-card-verified-action"),
  ).toBeHidden();
  const cardBounds = await captureCard.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, right: bounds.right, viewportWidth: innerWidth };
  });
  expect(cardBounds.top).toBeGreaterThan(0);
  expect(cardBounds.right).toBeLessThanOrEqual(cardBounds.viewportWidth);

  const primaryActionBounds = await mobileVerifiedCta.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { bottom: bounds.bottom, top: bounds.top };
  });
  expect(primaryActionBounds.top).toBeLessThan(cardBounds.top);
  expect(primaryActionBounds.top).toBeLessThan(600);
  expect(primaryActionBounds.bottom).toBeLessThanOrEqual(812);

  await mobileVerifiedCta.click();
  await expect(progress.locator(".progress-current")).toHaveText(
    "Step 2 of 7 · Interpret",
  );
});
