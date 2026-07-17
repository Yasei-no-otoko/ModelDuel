import { expect, test } from "@playwright/test";

test("keeps both Seasons worlds compact and operable at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const seasonsRadio = page.getByRole("radio", { name: /Seasons/ });
  await seasonsRadio.locator("xpath=ancestor::label").click();
  await expect(seasonsRadio).toBeChecked();
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page
    .getByLabel("One receives more direct light while the other receives less")
    .check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();

  const seasonsViewports = page.locator(
    ".world-viewport.seasons-world-viewport",
  );
  await expect(seasonsViewports).toHaveCount(2);
  for (const viewport of await seasonsViewports.all()) {
    await expect(viewport).toBeVisible();
    const height = await viewport.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(180);
    expect(height).toBeLessThanOrEqual(205);
  }

  await expect(page.locator(".evidence-world.learner")).toBeVisible();
  await expect(page.locator(".evidence-world.scientific")).toBeVisible();
  await expect(page.getByTestId("verified-observation")).toBeVisible();

  const evidencePreview = page.getByTestId("mobile-evidence-preview");
  await expect(evidencePreview).toBeVisible();
  await expect(evidencePreview).toContainText(
    "Northern Hemisphere summer; Southern Hemisphere winter",
  );
  const evidenceOrder = await page.evaluate(() => ({
    previewTop: document
      .querySelector("[data-testid='mobile-evidence-preview']")!
      .getBoundingClientRect().top,
    firstWorldTop: document
      .querySelector(".evidence-world")!
      .getBoundingClientRect().top,
  }));
  expect(evidenceOrder.previewTop).toBeLessThan(evidenceOrder.firstWorldTop);

  const comparisonHeight = await page
    .locator(".world-comparison")
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(comparisonHeight).toBeLessThan(1450);

  const controlButtons = page.locator(".view-controls button");
  await expect(controlButtons).toHaveCount(6);
  for (const button of await controlButtons.all()) {
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
