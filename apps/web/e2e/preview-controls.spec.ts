import { expect, test, type Page } from "@playwright/test";

const toolbar = "aside[aria-label='Onboarding preview controls']";
async function openToolbar(page: Page) {
  const toggle = page.locator(toolbar).getByRole("button", { name: "Preview controls" });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

test("preview controls use named routes and browser history", async ({ page }) => {
  await page.goto("/onboarding-preview/how-leadreacher-works");
  await openToolbar(page);
  await expect(page.getByLabel("Onboarding step")).toHaveValue("how-leadreacher-works");
  await page.getByLabel("Onboarding step").selectOption("cta");
  await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/onboarding-preview\/how-leadreacher-works$/);
});

test("numbered fixtures remain isolated and copyable", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/auth\/v1\/|\/auth\/bootstrap|\/billing\/checkout-session|\/social-accounts\/connect/.test(request.url())) requests.push(request.url());
  });
  await page.goto("/onboarding-preview/discovery");
  await openToolbar(page);
  await page.getByLabel("Mobile reference state").selectOption("08");
  await expect(page).toHaveURL(/screen=08/);
  await expect(page.getByRole("heading", { name: /^Campaign Content/ })).toBeVisible();
  await openToolbar(page);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedLink = value; } } }));
  await page.getByRole("button", { name: "Copy preview link" }).click();
  expect(await page.locator("html").getAttribute("data-copied-link")).toBe(page.url());
  expect(requests).toEqual([]);
});

test("toolbar stays clear of the desktop pill and flows on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview/connect-channels");
  await openToolbar(page);
  const desktop = await page.locator(toolbar).boundingBox();
  const pill = await page.locator(".onboarding-persistent-pill").boundingBox();
  expect(desktop && pill && (desktop.x >= pill.x + pill.width || desktop.y + desktop.height <= pill.y)).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding-preview/channels");
  await expect(page.locator(toolbar)).toHaveCSS("position", "relative");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("capture mode hides developer controls", async ({ page }) => {
  await page.goto("/onboarding-preview/cta?capture=1");
  await expect(page.locator(toolbar)).toHaveCount(0);
});
