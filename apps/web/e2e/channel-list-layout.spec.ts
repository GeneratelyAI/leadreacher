import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1366, height: 900 }, { width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  test(`channel list fits both modes at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const geometries = [];
    for (const route of ["channels", "connect-channels"]) {
      await page.goto(`/onboarding-preview/${route}?capture=1`);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(page.getByRole("group", { name: "Campaign channels" })).toBeVisible();
      const task = page.locator(".onboarding-scene-task-scroll");
      expect(await task.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      const nav = await page.locator(".onboarding-campaign-action-row").boundingBox();
      const notice = page.getByText(route === "channels" ? "You will connect your accounts after checkout." : "Nothing is sent until you approve your campaign.", { exact: true });
      const end = await notice.boundingBox();
      expect(end!.y + end!.height).toBeLessThanOrEqual(nav!.y - 28);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      geometries.push(await page.evaluate(() => Object.fromEntries([".onboarding-persistent-logo", ".onboarding-persistent-pill", ".onboarding-campaign-action-row"].map((selector) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return [selector, { x: r.x, y: r.y, width: r.width }];
      }))));
      if (route === "channels") {
        const checkbox = page.getByRole("checkbox", { name: "LinkedIn", exact: true });
        const initial = await checkbox.isChecked();
        const bounds = await checkbox.boundingBox();
        await checkbox.focus();
        await page.keyboard.press("Space");
        expect(await checkbox.isChecked()).toBe(!initial);
        expect(await checkbox.boundingBox()).toEqual(bounds);
      }
    }
    expect(geometries[0]).toEqual(geometries[1]);
  });
}
