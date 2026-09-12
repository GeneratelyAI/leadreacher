import { expect, test } from "@playwright/test";

const routes = [
  "discovery",
  "how-leadreacher-works",
  "campaign-content",
  "campaign-content/personalized-video",
  "campaign-content/ai-video",
  "campaign-content/your-video",
  "campaign-content/document",
  "cta",
  "channels",
  "checkout",
  "connect-channels",
] as const;

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`onboarding has no desktop scroll surface at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const route of routes) {
      await page.goto(`/onboarding-preview/${route}`);
      await expect(page.locator(".onboarding-viewport-fit")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBe(0);

      const scrollSurfaces = await page.evaluate(() => Array.from(document.querySelectorAll("*")).filter((element) => {
        const overflow = getComputedStyle(element).overflowY;
        return overflow === "auto" || overflow === "scroll";
      }).map((element) => element.className));
      expect(scrollSurfaces).toEqual([]);

      const actions = page.locator(".onboarding-campaign-action-row");
      const actionBounds = await actions.count() ? await actions.boundingBox() : null;
      for (const task of await page.locator(".onboarding-scene-task-scroll").all()) {
        expect(await task.evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
        await task.evaluate((element) => { element.scrollTop = 100; });
        expect(await task.evaluate((element) => element.scrollTop)).toBe(0);
        for (const child of await task.locator(":scope > *").all()) {
          const bounds = await child.boundingBox();
          if (bounds && actionBounds) {
            expect(bounds.y + bounds.height + 12).toBeLessThanOrEqual(actionBounds.y - 28);
          }
        }
      }

      const pill = page.locator(".campaign-pill-section-list");
      await expect(pill).toBeVisible();
      expect(await pill.evaluate((element) => ({
        overflow: getComputedStyle(element).overflowY,
        excess: element.scrollHeight - element.clientHeight,
      }))).toEqual({ overflow: "visible", excess: 0 });
    }
  });
}
