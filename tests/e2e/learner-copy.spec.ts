import { expect, test, type Page } from "@playwright/test";

async function openVerifiedScenario(
  page: Page,
  scenario: "moon-phases" | "seasons",
) {
  await page.goto("/");
  if (scenario === "seasons") {
    const radio = page.getByRole("radio", { name: /Seasons/ });
    await radio.locator("xpath=ancestor::label").click();
    await expect(radio).toBeChecked();
  }
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Turn one disagreement into a fair test." }),
  ).toBeVisible();
}

test("renders Moon relations and hidden evidence without internal DSL copy", async ({ page }) => {
  await openVerifiedScenario(page, "moon-phases");

  await expect(
    page.getByText("Earth casts a shadow on the Moon.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Still hidden: Moon–Sun–Earth geometry, illuminated fraction, Earth-shadow intersection, and the observed phase.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/casts-shadow-on|CaseSpec/)).toHaveCount(0);

  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Prediction locked. Ready to run both worlds.",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
  await expect(
    page.getByText(
      /This is simulation evidence calculated from the validated test case\./,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({
      hasText: "Both models ran the same validated case. Verified evidence is now visible.",
    }),
  ).toHaveText(
    "Both models ran the same validated case. Verified evidence is now visible.",
  );
  await expect(page.getByText(/CaseSpec/)).toHaveCount(0);
});

test("renders Seasons relations and hidden evidence without internal DSL copy", async ({ page }) => {
  await openVerifiedScenario(page, "seasons");

  await expect(
    page.getByText(
      "The Sun changes the seasonal energy received by Earth.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Still hidden: June geometry, sunlight angles, relative energy, and each hemisphere's seasonal result.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/causes-seasonal-energy|CaseSpec/)).toHaveCount(0);

  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page
    .getByLabel("One receives more direct light while the other receives less")
    .check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Prediction locked. Ready to run both worlds.",
    }),
  ).toBeVisible();
});
