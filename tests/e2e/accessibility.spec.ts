import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];
const FULL_SCORE_REVISION =
  "The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions of the sunlit half. Earth's shadow does not cause the regular phases; it causes a lunar eclipse.";

async function expectNoAutomaticWcagViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  expect(results.violations, `${state} has automatically detectable WCAG A/AA violations`).toEqual(
    [],
  );
}

test("keeps the capture, evidence, and trace states free of automatic WCAG A/AA violations", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "chromium", "One deterministic axe scan is sufficient across projects.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Two models predict. Evidence decides." })).toBeVisible();
  await expectNoAutomaticWcagViolations(page, "capture");

  await page.getByRole("button", { name: /Run verified sample/ }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel(/Earth's shadow masks half of the Moon/).check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await page.getByRole("button", { name: "Run both worlds and reveal evidence" }).click();
  await expect(page.getByTestId("verified-observation")).toBeVisible();
  await expectNoAutomaticWcagViolations(page, "evidence");

  await page.getByRole("button", { name: "Revise my explanation" }).click();
  await page.getByLabel("Revised causal explanation").fill(FULL_SCORE_REVISION);
  await page.getByRole("button", { name: "Capture revision and continue" }).click();
  await page.getByLabel(/The Moon is in the Sun's direction/).check();
  await page.getByRole("button", { name: "Lock and check answer" }).click();
  await expect(page.getByTestId("revision-trace")).toBeVisible();
  await expectNoAutomaticWcagViolations(page, "trace");
});
