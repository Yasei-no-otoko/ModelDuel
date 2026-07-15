import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

test("presents the ModelDuel learning promise and challenge path", async ({
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

  const primaryCta = page.getByRole("link", { name: "Start Moon Challenge" });
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toBeInViewport();
  await expect(primaryCta).toHaveAttribute("href", "#moon-challenge");

  const steps = page.getByTestId("learning-step");
  await expect(steps).toHaveCount(4);
  await expect(steps.getByRole("heading")).toHaveText([
    "Explain",
    "Predict",
    "Observe",
    "Revise",
  ]);

  await primaryCta.click();
  await expect(page).toHaveURL(/#moon-challenge$/);
  await expect(page.locator("#moon-challenge")).toBeInViewport();
  await expect(page.getByLabel("Learner explanation")).toHaveValue(
    "The Moon changes shape because Earth's shadow moves across it.",
  );
});
