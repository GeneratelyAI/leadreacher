import { expect, test } from "@playwright/test";

test("campaign content previews the current choice in the pill before Continue", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/campaign-content");
  const content = page.locator('[data-campaign-section-id="content"]');
  await expect(content).toContainText("Choosing content");
  await expect(content.locator(".campaign-pill-pending-lines i").first()).toHaveCSS("animation-name", "campaign-pill-pending-shimmer");

  await page.getByRole("radio", { name: /AI Video/ }).click();
  await expect(content).toContainText("AI Video");

  await page.getByRole("radio", { name: /Your Video/ }).click();
  await expect(content).toContainText("Your Video");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding-preview\/campaign-content\/your-video$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test("pill loading stripes stop moving with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview/campaign-content");
  await expect(page.locator(".campaign-pill-pending-lines i").first()).toHaveCSS("animation-name", "none");
});
