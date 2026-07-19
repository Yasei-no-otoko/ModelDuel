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

  const heroCanvas = page.getByTestId("hero-visualizer").locator("canvas");
  if ((await heroCanvas.count()) === 1) {
    const dpr = await heroCanvas.evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      return {
        x: canvas.width / canvas.clientWidth,
        y: canvas.height / canvas.clientHeight,
      };
    });
    expect(dpr.x).toBeLessThanOrEqual(1.01);
    expect(dpr.y).toBeLessThanOrEqual(1.01);
  }

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

test("keeps Moon evidence legends clear of every named camera control at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();

  const shells = page.locator(".moon-world-viewport-shell");
  await expect(shells).toHaveCount(2);
  const cameraButtons = page.locator(".moon-world-viewport-shell .view-controls button");
  const staticNotes = page.locator(".moon-world-viewport-shell .static-view-note");
  await expect
    .poll(async () => {
      const buttonCount = await cameraButtons.count();
      const noteCount = await staticNotes.count();
      return (buttonCount === 6 && noteCount === 0) || (buttonCount === 0 && noteCount === 2);
    })
    .toBe(true);

  for (const shell of await shells.all()) {
    const layout = await shell.evaluate((element) => {
      const viewport = element.querySelector(".world-viewport")!;
      const legend = element.querySelector(".scene-encoding-legend")!;
      const controlsOrNote = element.querySelector(".view-controls, .static-view-note")!;
      const viewportBounds = viewport.getBoundingClientRect();
      const legendBounds = legend.getBoundingClientRect();
      const controlsBounds = controlsOrNote.getBoundingClientRect();
      return {
        controlsTop: controlsBounds.top,
        legendBottom: legendBounds.bottom,
        viewportBottom: viewportBounds.bottom,
      };
    });
    expect(layout.legendBottom).toBeLessThanOrEqual(layout.viewportBottom + 1);
    expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.viewportBottom - 1);
  }

  if ((await cameraButtons.count()) === 6) {
    const viewNames = ["Case overview", "Earth-side view", "Plane view"] as const;
    for (const world of await shells.all()) {
      for (const viewName of viewNames) {
        const button = world.getByRole("button", { name: viewName });
        const height = await button.evaluate(
          (element) => element.getBoundingClientRect().height,
        );
        expect(height).toBeGreaterThanOrEqual(44);
        await button.click({ position: { x: 10, y: height / 2 } });
        await expect(button).toHaveAttribute("aria-pressed", "true");
      }
    }
  }

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
