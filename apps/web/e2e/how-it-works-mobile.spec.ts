import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`mobile illustration story remains readable and scroll reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview?screen=04", {
      waitUntil: "networkidle",
    });
    const rows = page.locator("[data-explanation-step]");
    await expect(rows).toHaveCount(4);
    const bounds = await rows.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left };
      }),
    );
    for (let index = 1; index < bounds.length; index += 1) {
      expect(bounds[index].top).toBeGreaterThanOrEqual(
        bounds[index - 1].bottom,
      );
      expect(bounds[index].left).toBe(bounds[0].left);
    }
    for (const title of [
      "Find the right prospects",
      "Create personalized content",
      "Reach them automatically",
      "They respond. You close.",
    ]) {
      await expect(
        rows.locator("strong").filter({ hasText: title }),
      ).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // Exercise scrolling rather than relying on locator auto-scroll to the CTA.
    for (let index = 0; index < 5; index += 1) {
      if (browserName === "webkit") await page.keyboard.press("PageDown");
      else await page.mouse.wheel(0, 220);
    }
    const continueButton = page.getByRole("button", {
      name: "Continue to prospects",
    });
    await expect
      .poll(() =>
        continueButton.evaluate((button) => {
          const bounds = button.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight;
        }),
      )
      .toBe(true);
  });
}

test("mobile reduced motion shows final art and keeps the forward/back journey usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?screen=04", {
    waitUntil: "networkidle",
  });
  const illustrations = page.locator(".how-it-works-illustration");
  await expect(illustrations).toHaveCount(4);
  expect(
    await illustrations.evaluateAll(
      (elements) =>
        elements
          .flatMap((element) => element.getAnimations({ subtree: true }))
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Continue to prospects" }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await expect(
    page.getByRole("heading", { name: /Your prospects/ }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: /How LeadReacher works/ }),
  ).toBeVisible();
  expect(await page.locator(".onboarding-audience-bridge").count()).toBe(0);
});
