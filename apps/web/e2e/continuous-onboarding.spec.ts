import { expect, test } from "@playwright/test";

test("content approval preserves the canvas, summary and browser history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=campaign-content");
  const pill = page.locator(".onboarding-persistent-pill .campaign-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("Business");
  await pill.evaluate((node) => node.setAttribute("data-instance", "persistent"));
  const bounds = await pill.boundingBox();
  const heading = await page.locator("h1").boundingBox();
  await page.getByRole("button", { name: "Collapse your campaign" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".personalized-video-style-page")).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand your campaign" })).toBeVisible();
  await expect(pill).toHaveAttribute("data-instance", "persistent");
  expect(await pill.boundingBox()).toEqual(bounds);
  const nextHeading = await page.locator("h1").boundingBox();
  expect(nextHeading).not.toBeNull();
  expect(heading).not.toBeNull();
  expect(nextHeading!.y).toBeCloseTo(heading!.y, 3);
  await page.getByRole("button", { name: "Expand your campaign" }).click();
  const previousSummary = await pill.textContent();
  const casual = page.getByRole("radio", { name: /^Casual/ });
  await expect(casual).toBeEnabled();
  await casual.focus();
  await page.keyboard.press("Space");
  await expect(casual).toHaveAttribute("aria-checked", "true");
  expect(await pill.textContent()).toEqual(previousSummary);
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(page).toHaveURL(/step=video-decision/);
  await expect(pill).toHaveAttribute("data-instance", "persistent");
  await expect(pill).toContainText("Personalized video · Casual");
  await page.goBack();
  await expect(page.locator(".personalized-video-style-page")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Casual/ })).toHaveAttribute("aria-checked", "true");
  expect(await page.locator(".campaign-pill").count()).toBe(1);
});

test("reduced motion keeps content ready and the canvas stationary", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding-preview?step=personalized-video-style");
  const card = page.getByRole("radio", { name: /^Professional/ });
  await expect(card).toBeEnabled();
  expect(await card.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".onboarding-step-presence__pane")).toHaveCount(1);
});
