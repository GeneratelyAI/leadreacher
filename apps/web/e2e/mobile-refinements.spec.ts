import { expect, test } from "@playwright/test";

for (const width of [320, 390, 414]) {
  for (const [step, route] of [["personalized-video-style", "personalized-video"], ["ai-video-style", "ai-video"]] as const) {
    test(`${step} final card preserves a previous-card peek at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(
        `/onboarding-preview/campaign-content/${route}?media=placeholder&capture=1`,
      );
      const aggressive = page.getByRole("radio", { name: /^Aggressive/ });
      await page
        .getByRole("button", { name: "Aggressive", exact: true })
        .click();
      await expect(aggressive).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(() =>
          aggressive.evaluate((card) => {
            const rail = card.parentElement!;
            return Math.round(
              rail.getBoundingClientRect().right -
                card.getBoundingClientRect().right,
            );
          }),
        )
        .toBe(2);
      const previous = page.getByRole("radio", { name: /^Casual/ });
      expect(
        await previous.evaluate(
          (card) =>
            card.getBoundingClientRect().right -
            card.parentElement!.getBoundingClientRect().left,
        ),
      ).toBeGreaterThanOrEqual(12);
      await expect(page.getByRole("button", { name: "Previous video style" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Next video style" })).toBeDisabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    });
  }
  for (const [step, route] of [["upload-video", "your-video"], ["upload-document", "document"]] as const) {
    test(`${step} keeps both borders inset at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/onboarding-preview/campaign-content/${route}?capture=1`);
      const panel = page.locator('[class$="-drop-zone"]');
      await expect(panel).toBeVisible();
      const geometry = await panel.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          right: innerWidth - box.right,
          outline: getComputedStyle(element).outlineStyle,
          inset: getComputedStyle(element, "::before").left,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(20);
      expect(geometry.right).toBeGreaterThanOrEqual(20);
      expect(geometry.outline).toBe("none");
      expect(geometry.inset).toBe("12px");
    });
  }
}

test("mobile style rail mirrors its adjacent peek on the final option", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  const rail = page.getByRole("radiogroup", { name: "Personalized video style" });
  await expect(page.getByRole("button", { name: "Use this style", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Casual", exact: true }).click();
  const casual = page.getByRole("radio", { name: /^Casual/ });
  const aggressive = page.getByRole("radio", { name: /^Aggressive/ });
  await expect.poll(() => casual.evaluate((card) => Math.round(card.getBoundingClientRect().left - card.parentElement!.getBoundingClientRect().left))).toBe(2);
  const forwardPeek = await aggressive.evaluate((card) => card.parentElement!.getBoundingClientRect().right - card.getBoundingClientRect().left);
  const middleScreenshot = testInfo.outputPath("middle-option-peek.png");
  await page.screenshot({ path: middleScreenshot });
  await testInfo.attach("middle-option-peek", { path: middleScreenshot, contentType: "image/png" });
  await page.getByRole("button", { name: "Aggressive", exact: true }).click();
  await expect(aggressive).toBeChecked();
  await expect.poll(() => aggressive.evaluate((card) => Math.round(card.parentElement!.getBoundingClientRect().right - card.getBoundingClientRect().right))).toBe(2);
  const backwardPeek = await casual.evaluate((card) => card.getBoundingClientRect().right - card.parentElement!.getBoundingClientRect().left);
  expect(backwardPeek).toBeGreaterThan(48);
  expect(Math.abs(backwardPeek - forwardPeek)).toBeLessThanOrEqual(2);
  await expect(rail.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Next video style" })).toBeDisabled();
  const finalScreenshot = testInfo.outputPath("final-option-peek.png");
  await page.screenshot({ path: finalScreenshot });
  await testInfo.attach("final-option-peek", { path: finalScreenshot, contentType: "image/png" });

  await aggressive.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(casual).toBeFocused();
  await expect(casual).toBeChecked();
  await page.keyboard.press("End");
  await expect(aggressive).toBeFocused();
  await expect(aggressive).toBeChecked();
  await expect.poll(() => aggressive.evaluate((card) => Math.round(card.parentElement!.getBoundingClientRect().right - card.getBoundingClientRect().right))).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Use this style", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/campaign-content\/personalized-video$/);
  await expect(aggressive).toBeChecked();
  await expect.poll(() => aggressive.evaluate((card) => Math.round(card.parentElement!.getBoundingClientRect().right - card.getBoundingClientRect().right))).toBe(2);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 1366, height: 900 }, { width: 1440, height: 900 }]) {
  test(`mobile carousel refinement preserves desktop cards at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview/campaign-content/personalized-video");
    const rail = page.getByRole("radiogroup", { name: "Personalized video style" });
    await expect(page.getByRole("button", { name: "Use this", exact: true })).toBeEnabled();
    await expect(rail).toHaveCSS("display", "grid");
    const cards = await rail.getByRole("radio").all();
    expect(cards).toHaveLength(3);
    const actions = await page.locator(".personalized-video-style-actions").boundingBox();
    for (const card of cards) {
      await expect(card).toBeInViewport({ ratio: 1 });
      const bounds = await card.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(actions!.y - 28);
    }
    expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight - innerHeight }))).toEqual({ width: 0, height: 0 });
  });
}

test("mobile audience navigation is immediate in both directions with a visible Back control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(
    "/onboarding-preview/how-leadreacher-works?capture=1",
  );
  await page.getByRole("button", { name: "Continue to prospects" }).click();
  await expect(
    page.getByRole("heading", { name: /Your prospects/ }),
  ).toBeVisible();
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(0);
  const back = page.getByRole("button", { name: "Back", exact: true });
  await expect(back).toBeVisible();
  await back.click();
  await expect(
    page.getByRole("heading", { name: /How LeadReacher works/ }),
  ).toBeVisible();
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(0);
});
