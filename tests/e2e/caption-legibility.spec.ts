import { expect, test, type Page } from "@playwright/test";

const CAPTION_SELECTORS = [
  ".header-meta",
  ".experience-progress li",
  ".eyebrow, .micro-label",
  ".sample-pill, .source-badge",
  ".field-meta",
  ".sketch-field p",
  ".sketch-field input",
  ".sketch-preview span",
  ".sketch-preview button",
  ".form-disclosure",
  ".source-notice p",
  ".model-review-grid ul",
  ".stage-action-row p",
  ".sealed-banner",
  ".option-list legend",
  ".case-control button, .view-controls button",
  ".evidence-world > header p",
  ".world-html-fallback p",
  ".prediction-block span",
  ".prediction-block strong",
  ".prediction-block p",
  ".verified-observation > div > p:first-child",
  ".verified-observation > div > p:last-child",
  ".scale-note",
  ".evidence-brief dt",
  ".evidence-brief > p:last-child",
  ".rubric-notice",
  ".server-check-banner p",
  ".protected-state-error p",
  ".trace-source-notice",
  ".api-error p",
  ".trace-list p",
  ".trace-note",
  ".app-footer",
] as const;

async function expectCaptionFloorForPresentElements(page: Page) {
  for (const selector of CAPTION_SELECTORS) {
    const elements = page.locator(selector);
    for (const element of await elements.all()) {
      const fontSize = await element.evaluate((node) =>
        Number.parseFloat(getComputedStyle(node).fontSize),
      );
      expect(fontSize, selector).toBeGreaterThanOrEqual(12);
    }
  }
}

function relativeLuminance(red: number, green: number, blue: number) {
  const channelLuminance = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

test("keeps learner-facing captions legible through the Moon evidence flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...argumentsList: unknown[]
    ) {
      if (
        contextId === "webgl" ||
        contextId === "webgl2" ||
        contextId === "experimental-webgl"
      ) {
        return null;
      }
      return Reflect.apply(getContext, this, [contextId, ...argumentsList]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");

  await page.locator(".sketch-field input").setInputFiles({
    name: "caption-check.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".sketch-preview span")).toBeVisible();
  await expect(page.locator(".sketch-preview button")).toBeVisible();
  for (const selector of [
    ".experience-progress li",
    ".field-meta",
    ".sketch-field p",
    ".sketch-field input",
    ".form-disclosure",
    ".app-footer",
  ]) {
    await expect(page.locator(selector).first()).toBeVisible();
  }
  await expect(page.locator(".progress-current")).toHaveText(
    "Step 1 of 7 · Capture",
  );
  await expectCaptionFloorForPresentElements(page);

  const inactiveProgress = page.locator(".experience-progress li").nth(1);
  const inactiveColor = await inactiveProgress.evaluate(
    (element) => getComputedStyle(element).color,
  );
  expect(inactiveColor).toBe("rgb(113, 128, 171)");
  const foreground = relativeLuminance(113, 128, 171);
  const background = relativeLuminance(4, 7, 19);
  const contrast =
    (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05);
  expect(contrast).toBeGreaterThanOrEqual(4.5);

  await page.locator(".sketch-preview button").click();
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
  await expect(page.locator(".source-badge")).toBeVisible();
  await expect(page.locator(".source-notice p").first()).toBeVisible();
  await expect(page.locator(".model-review-grid ul").first()).toBeVisible();
  await expect(page.locator(".stage-action-row p")).toBeVisible();
  await expectCaptionFloorForPresentElements(page);

  await page.getByRole("button", { name: "Make a prediction" }).click();
  await expect(page.locator(".option-list legend")).toBeVisible();
  await expectCaptionFloorForPresentElements(page);
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();

  await expect(page.locator(".case-control button")).toBeVisible();
  await expect(page.locator(".view-controls button").first()).toBeVisible();
  await expect(page.locator(".evidence-world > header p").first()).toBeVisible();
  await expect(page.locator(".world-html-fallback").first()).toBeVisible();
  await expect(page.locator(".prediction-block").first()).toBeVisible();
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await expect(page.locator(".scale-note")).toBeVisible();
  await expectCaptionFloorForPresentElements(page);

  const viewControls = page.locator(".view-controls button");
  await expect(viewControls).toHaveCount(6);
  for (const button of await viewControls.all()) {
    const height = await button.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(44);
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
