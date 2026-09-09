import { expect, test, type Page } from "@playwright/test";

const toolbar = "details[aria-label='Onboarding preview controls']";

async function openToolbar(page: Page) {
  await page.locator(toolbar).locator("summary").click();
}

test("preview controls keep step and Strategy state URL-addressable through history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  await openToolbar(page);
  await expect(page.getByLabel("Onboarding step")).toHaveValue("strategy");
  await expect(page.getByRole("button", { name: "how it works" })).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Onboarding step").selectOption("discovery");
  await expect(page).toHaveURL(/step=discovery/);
  await expect(page.getByLabel("Strategy substep")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/step=strategy&substep=how-it-works/);
  await expect(page.getByLabel("Onboarding step")).toHaveValue("strategy");
  await page.getByRole("button", { name: "targeting" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/step=strategy&substep=targeting/);
  await page.goBack();
  await page.goForward();
  await expect(page).toHaveURL(/step=strategy&substep=targeting/);
});

test("mobile reference selection uses only the preview fixture and copies its URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/onboarding-preview?step=discovery");
  await openToolbar(page);
  await page.getByLabel("Mobile reference state").selectOption("08");
  await expect(page).toHaveURL(/screen=08&step=campaign-content/);
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("lr_fixture_strategy:/onboarding-preview"))).not.toBeNull();
  await expect(page.getByRole("heading", { name: "Choose your campaign content." })).toBeVisible();

  await openToolbar(page);
  await page.getByRole("button", { name: "Copy preview link" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("screen=08&step=campaign-content");
});

test("preview toolbar stays clear of the desktop pill and flows on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?screen=16&step=channels&review=true");
  const desktop = await page.locator(toolbar).boundingBox();
  const pill = await page.locator(".onboarding-persistent-pill").boundingBox();
  expect(desktop && pill && (desktop.x >= pill.x + pill.width || desktop.y + desktop.height <= pill.y)).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding-preview?step=campaign-content");
  await expect(page.locator(toolbar)).toHaveCSS("position", "relative");
  await expect(page.locator(toolbar)).toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("preview toolbar hides for capture and opens without motion when reduced", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=discovery");
  await openToolbar(page);
  expect(await page.locator(toolbar).locator("[class*='panel']").evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");

  await page.goto("/onboarding-preview?step=discovery&capture=1");
  await expect(page.locator(toolbar)).toHaveCount(0);
});
