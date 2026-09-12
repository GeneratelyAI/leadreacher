import { expect, test } from "@playwright/test";

for (const width of [320, 390, 414]) {
  for (const [step, route] of [["personalized-video-style", "personalized-video"], ["ai-video-style", "ai-video"]] as const) {
    test(`${step} final card snaps without a previous-card sliver at ${width}px`, async ({
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
              card.getBoundingClientRect().left -
                rail.getBoundingClientRect().left,
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
      ).toBeLessThanOrEqual(0);
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
