import { expect, test } from "@playwright/test";

test("mobile landing footer remains sticky without hiding its final CTA", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The focused mobile footer check runs in Chromium.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const footer = page.locator("footer").last();
  const reveal = footer.locator("xpath=..");
  await expect(reveal).toHaveCSS("position", "sticky");
  await expect(reveal).toHaveCSS("bottom", "0px");

  await footer.scrollIntoViewIfNeeded();
  const websiteInput = page.locator("#footer-website-url");
  await websiteInput.focus();
  await expect(websiteInput).toBeFocused();
  await expect(websiteInput).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
