import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Continue responds immediately and commits once at ${viewport.width}`, async ({ page, browserName }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview/channels");
    await page.evaluate(() => {
      window.sessionStorage.setItem("navigation-feedback-save-count", "0");
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => (
        schedule(callback, delay === 80 ? 500 : delay, ...args)
      )) as typeof window.setTimeout;
      window.addEventListener("leadreacher:campaign-saved", () => {
        const key = "navigation-feedback-save-count";
        window.sessionStorage.setItem(key, String(Number(window.sessionStorage.getItem(key)) + 1));
      });
    });

    const continueButton = page.getByRole("button", { name: "Continue to checkout" });
    await continueButton.click();
    await expect(page.locator("html")).toHaveAttribute("data-onboarding-departure", "forward");
    await expect(page.locator(".onboarding-campaign-next")).toBeDisabled();
    await expect(page).toHaveURL(/\/onboarding-preview\/channels$/);
    await page.locator(".onboarding-campaign-next").evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page).toHaveURL(/\/onboarding-preview\/checkout$/);
    if (browserName === "chromium") {
      await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("navigation-feedback-save-count"))).toBe("1");
    }
    await expect(page.locator(".onboarding-step-presence")).toHaveAttribute("data-scene-phase", "idle");
  });
}

test("failed Continue restores the current scene and existing error treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await expect(page.getByRole("button", { name: "Continue to checkout" })).toBeEnabled();
  await page.evaluate(() => {
    window.structuredClone = () => { throw new Error("Simulated save failure"); };
  });

  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.locator(".onboarding-step-presence")).toHaveAttribute("data-scene-phase", "exiting");
  await expect(page.getByText("Simulated save failure", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding-preview\/channels$/);
  await expect(page.locator(".onboarding-step-presence")).toHaveAttribute("data-scene-phase", "idle");
  await expect(page.getByRole("button", { name: "Continue to checkout" })).toBeEnabled();
});

test("Back starts a reverse response", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await expect(page.getByRole("button", { name: "Continue to checkout" })).toBeEnabled();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  const response = await page.getByRole("button", { name: "Back", exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    const scene = document.querySelector<HTMLElement>(".onboarding-step-presence");
    return {
      direction: document.documentElement.dataset.onboardingDeparture ?? scene?.dataset.sceneDirection,
      responding: Boolean(document.documentElement.dataset.onboardingDeparture || document.documentElement.dataset.storyNative),
    };
  });
  expect(response.direction).toBe("backward");
  expect(response.responding).toBe(true);
  await expect(page).toHaveURL(/\/channels$/);
});

test("browser Back and Forward remain stable", async ({ page }) => {
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/channels$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("reduced motion keeps immediate non-spatial loading feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview/channels");
  const button = page.locator(".onboarding-campaign-next");
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toContainText("Saving...");
  await expect(page.locator(".onboarding-step-presence__pane")).toHaveCSS("opacity", "1");
  await expect(page).toHaveURL(/\/checkout$/);
});
