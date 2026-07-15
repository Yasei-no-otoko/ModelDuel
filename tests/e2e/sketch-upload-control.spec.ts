import { expect, test } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test(
  "provides a deterministic mobile sketch upload control with clean resets",
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const uploadInput = page.getByLabel("Choose sketch");
    const uploadButton = page.locator(".sketch-upload-button");
    const uploadStatus = page.locator(".sketch-upload-status");
    const preview = page.locator(".sketch-preview img");
    const sketchFile = {
      name: "same-sketch.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    };

    await expect(uploadButton).toBeVisible();
    const buttonBox = await uploadButton.boundingBox();
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(uploadStatus).toHaveText("No sketch selected");
    await expect(page.getByLabel("Choose sketch")).toHaveCount(1);
    await expect(uploadInput).toBeEnabled();
    const hiddenInputBox = await uploadInput.boundingBox();
    expect(hiddenInputBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
    expect(hiddenInputBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);

    await uploadInput.focus();
    await expect(uploadInput).toBeFocused();
    const focusOutline = await uploadButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusOutline.style).not.toBe("none");
    expect(focusOutline.width).toBeGreaterThanOrEqual(2);

    await uploadInput.setInputFiles(sketchFile);
    await expect(uploadStatus).toHaveText("same-sketch.png");
    await expect(preview).toBeVisible();

    await page.getByRole("button", { name: "Remove sketch" }).click();
    await expect(uploadStatus).toHaveText("No sketch selected");
    await expect(preview).toHaveCount(0);
    expect(
      await uploadInput.evaluate(
        (element) => (element as HTMLInputElement).files?.length ?? -1,
      ),
    ).toBe(0);

    await uploadInput.setInputFiles(sketchFile);
    await expect(uploadStatus).toHaveText("same-sketch.png");
    await expect(preview).toBeVisible();

    const seasonsRadio = page.getByRole("radio", { name: /Seasons/ });
    await seasonsRadio.locator("xpath=ancestor::label").click();
    await expect(seasonsRadio).toBeChecked();
    await expect(uploadStatus).toHaveText("No sketch selected");
    await expect(preview).toHaveCount(0);
    expect(
      await uploadInput.evaluate(
        (element) => (element as HTMLInputElement).files?.length ?? -1,
      ),
    ).toBe(0);

    const viewportWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    const documentWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(documentWidth).toBeLessThanOrEqual(viewportWidth);
  },
);
