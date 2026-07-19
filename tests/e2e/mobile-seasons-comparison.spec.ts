import { expect, test } from "@playwright/test";

const seasonsObservationPattern =
  /Observed at -?\d+(?:\.\d+)? degrees north and south, relative energy is -?\d+(?:\.\d+)? and -?\d+(?:\.\d+)?, with solar declination -?\d+(?:\.\d+)? degrees\. This world predicts (?:summer|winter|equinox-like) in the north and (?:summer|winter|equinox-like) in the south\./;

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
  expect(comparisonHeight).toBeLessThan(1500);

  const learnerWorld = page.locator(".evidence-world.learner");
  const controlButtons = page.locator(".view-controls button");
  const staticDiagrams = page.locator(
    ".seasons-world-viewport .seasons-html-fallback",
  );

  await expect
    .poll(async () => {
      const controlCount = await controlButtons.count();
      const staticDiagramCount = await staticDiagrams.count();
      return (
        (controlCount === 6 && staticDiagramCount === 0) ||
        (controlCount === 0 && staticDiagramCount === 2)
      );
    })
    .toBe(true);

  const isStaticView = (await staticDiagrams.count()) === 2;
  if (isStaticView) {
    await expect(staticDiagrams).toHaveCount(2);
    await expect(page.locator(".view-controls")).toHaveCount(0);
    const staticViewNotes = page.locator(".static-view-note");
    await expect(staticViewNotes).toHaveCount(2);
    for (const note of await staticViewNotes.all()) {
      await expect(note).toHaveText(
        "Static evidence view · camera controls are not needed.",
      );
      const height = await note.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(height).toBeGreaterThanOrEqual(44);
    }

    for (const diagram of await staticDiagrams.all()) {
      await expect(diagram).toBeVisible();
      await expect(diagram).toHaveAttribute("role", "img");
      await expect(diagram).toHaveAttribute(
        "aria-label",
        seasonsObservationPattern,
      );
      await expect(diagram).toContainText("June case");
      await expect(diagram).toContainText("Predicted North:");
    }
  } else {
    await expect(staticDiagrams).toHaveCount(0);
    await expect(controlButtons).toHaveCount(6);
    for (const button of await controlButtons.all()) {
      const height = await button.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(height).toBeGreaterThanOrEqual(44);
    }

    const learnerViewport = learnerWorld.getByRole("img").first();
    const learnerViewportShell = learnerWorld.locator(".world-viewport[id]");
    const earthView = learnerWorld.getByRole("button", {
      name: "Earth-side view",
    });
    await expect(learnerViewport).toBeVisible();
    await expect(learnerViewport).toHaveAttribute(
      "aria-label",
      /Learner seasons model 3D view\. Case overview/,
    );
    const learnerViewportId = await learnerViewportShell.getAttribute("id");
    expect(learnerViewportId).toBeTruthy();
    await expect(earthView).toHaveAttribute(
      "aria-controls",
      learnerViewportId!,
    );
    await earthView.focus();
    await page.keyboard.press("Enter");
    await expect(learnerViewport).toHaveAttribute(
      "aria-label",
      /Earth-side view/,
    );
    await expect(learnerWorld.locator(".camera-view-status")).toHaveText(
      "Learner seasons model view: Earth-side view.",
    );
    const resetLearnerView = learnerWorld.getByRole("button", {
      name: "Case overview",
    });
    await resetLearnerView.focus();
    await page.keyboard.press("Enter");
    await expect(learnerViewport).toHaveAttribute(
      "aria-label",
      /Case overview/,
    );
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
