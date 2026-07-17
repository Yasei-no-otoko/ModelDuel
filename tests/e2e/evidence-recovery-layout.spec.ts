import { expect, test, type Page } from "@playwright/test";

type ChunkFailureGate = Readonly<{
  started: Promise<void>;
  fail: () => void;
}>;

async function installDynamicChunkFailure(page: Page): Promise<ChunkFailureGate> {
  let markStarted: (() => void) | undefined;
  let failRequests: (() => void) | undefined;
  let observedRequest = false;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const failureReleased = new Promise<void>((resolve) => {
    failRequests = resolve;
  });

  await page.route("**/_next/static/chunks/**", async (route) => {
    if (!observedRequest) {
      observedRequest = true;
      markStarted?.();
    }
    await failureReleased;
    await route.abort("failed");
  });

  return {
    started,
    fail: () => failRequests?.(),
  };
}

async function reachLockedMoonPrediction(page: Page, gate: ChunkFailureGate) {
  await page.getByRole("button", { name: "Run verified sample" }).click();
  await page.getByRole("button", { name: "Make a prediction" }).click();
  await page.getByLabel("Earth's shadow masks half of the Moon").check();
  await page.getByRole("button", { name: "Lock prediction" }).click();
  await gate.started;
  await page
    .getByRole("button", { name: "Run both worlds and reveal evidence" })
    .click();
}

for (const width of [320, 375, 768, 1280] as const) {
  test(`keeps delayed and recovered evidence layout stable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 812 });
    await page.addInitScript(() => {
      const state = window as typeof window & { __modelDuelCls?: number };
      state.__modelDuelCls = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput: boolean;
            value: number;
          };
          if (!shift.hadRecentInput) {
            state.__modelDuelCls = (state.__modelDuelCls ?? 0) + shift.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");

    const gate = await installDynamicChunkFailure(page);
    await reachLockedMoonPrediction(page, gate);

    const loading = page.locator(".world-comparison-loading");
    await expect(loading).toBeVisible();
    const loadingBox = await loading.boundingBox();
    expect(loadingBox).not.toBeNull();
    const expectedReservedHeight =
      width <= 520
        ? 104 * 16 - width * 0.62
        : width <= 780
          ? 82 * 16
          : Math.min(42 * 16, Math.max(32 * 16, width * 0.62));
    expect(Math.abs((loadingBox?.height ?? 0) - expectedReservedHeight)).toBeLessThan(2);
    await expect(loading.locator(".comparison-loading-worlds span")).toHaveCount(2);
    const skeletonColumns = await loading
      .locator(".comparison-loading-worlds")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(skeletonColumns).toBe(width <= 780 ? 1 : 2);

    gate.fail();
    const recovery = page.getByTestId("comparison-recovery");
    await expect(recovery).toBeVisible();
    const comparison = page.locator(".world-comparison");
    const worlds = comparison.locator(".evidence-world");
    await expect(worlds).toHaveCount(2);
    await expect(
      comparison.getByText("An Earth-shadow mask causes the visible half.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      comparison.getByText("The Sun lights one half; Earth sees it from the side.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(comparison.getByTestId("verified-observation")).toBeVisible();

    const worldGeometry = await worlds.evaluateAll((elements) =>
      elements.map((element) => {
        const card = element.getBoundingClientRect();
        const diagram = element
          .querySelector(".semantic-evidence-viewport")
          ?.getBoundingClientRect();
        const prediction = element
          .querySelector(".prediction-block")
          ?.getBoundingClientRect();
        return {
          card: { top: card.top, right: card.right, bottom: card.bottom, left: card.left },
          diagram: diagram
            ? { top: diagram.top, bottom: diagram.bottom, height: diagram.height }
            : null,
          prediction: prediction
            ? { top: prediction.top, bottom: prediction.bottom }
            : null,
        };
      }),
    );
    expect(worldGeometry).toHaveLength(2);
    const [learnerGeometry, scientificGeometry] = worldGeometry;
    if (!learnerGeometry || !scientificGeometry) {
      throw new Error("Recovery must render learner and scientific world cards.");
    }
    for (const geometry of worldGeometry) {
      expect(geometry.diagram).not.toBeNull();
      const expectedDiagramHeight = width <= 520 ? 180 : 285;
      expect(
        Math.abs((geometry.diagram?.height ?? 0) - expectedDiagramHeight),
      ).toBeLessThan(1);
      expect((geometry.prediction?.top ?? 0) - (geometry.diagram?.bottom ?? 0)).toBeGreaterThan(8);
      expect((geometry.card.bottom ?? 0) - (geometry.prediction?.bottom ?? 0)).toBeGreaterThan(10);
    }
    if (width <= 780) {
      expect(
        scientificGeometry.card.top - learnerGeometry.card.bottom,
      ).toBeGreaterThan(8);
    } else {
      expect(
        scientificGeometry.card.left - learnerGeometry.card.right,
      ).toBeGreaterThan(8);
      expect(
        Math.abs(scientificGeometry.card.top - learnerGeometry.card.top),
      ).toBeLessThan(1);
    }

    const verifiedBox = await comparison.getByTestId("verified-observation").boundingBox();
    expect(verifiedBox).not.toBeNull();
    const lowestWorldBottom = Math.max(
      learnerGeometry.card.bottom,
      scientificGeometry.card.bottom,
    );
    expect((verifiedBox?.y ?? 0) - lowestWorldBottom).toBeGreaterThan(10);

    const comparisonBox = await comparison.boundingBox();
    expect(comparisonBox).not.toBeNull();
    expect(
      Math.abs((comparisonBox?.height ?? 0) - (loadingBox?.height ?? 0)),
    ).toBeLessThan(160);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const cls = await page.evaluate(
      () =>
        (window as typeof window & { __modelDuelCls?: number }).__modelDuelCls ?? 0,
    );
    expect(cls).toBeLessThan(0.1);

    await page.getByRole("button", { name: "Revise my explanation" }).click();
    await expect(
      page.getByRole("heading", { name: "What changed in your explanation?" }),
    ).toBeVisible();
  });
}
