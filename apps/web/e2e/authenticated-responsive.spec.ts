import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const prospectQuery = process.env.E2E_PROSPECT_QUERY;
const reviewCampaignId = process.env.E2E_REVIEW_CAMPAIGN_ID;
const assertVisualBaselines = process.env.VISUAL_REGRESSION === "true";
const routes = [
  "/onboarding",
  "/dashboard",
  "/dashboard/campaigns",
  "/dashboard/prospects",
  "/dashboard/messages",
  "/dashboard/activity",
  "/dashboard/channels",
  "/dashboard/analytics",
  "/dashboard/settings",
] as const;

const onboardingRoutes = [
  "/onboarding?step=discovery",
  "/onboarding?step=strategy&substep=how-it-works",
  "/onboarding?step=strategy&substep=targeting",
  "/onboarding?step=campaign-type",
  "/onboarding?step=video-decision",
  "/onboarding?step=checkout",
  "/onboarding?step=channels",
] as const;

const onboardingViewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const onboardingThemes = ["light", "dark"] as const;

async function login(page: Page) {
  // The auth form is server-rendered before React attaches its handlers.
  // WebKit can otherwise hydrate between the two fills and replace the
  // email input, leaving the visually completed form unable to submit.
  await page.goto("/login", { waitUntil: "networkidle" });
  const emailInput = page.locator('input[placeholder="Enter your work email"]:visible');
  const authForm = emailInput.locator("xpath=ancestor::form");
  await expect(authForm).toBeVisible();
  await emailInput.fill(email!);
  await authForm.getByPlaceholder("Enter your password").fill(password!);
  await authForm.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

test.describe("authenticated responsive staging", () => {
  test.beforeEach(() => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for the seeded staging organization");
  });

  test("keeps onboarding and every dashboard route reachable on a phone", async ({ page }) => {
    await login(page);

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} has page-level horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });

  test("keeps every onboarding step responsive in light and dark themes", async ({ page }) => {
    await login(page);

    for (const theme of onboardingThemes) {
      await page.evaluate((selectedTheme) => {
        window.localStorage.setItem("lr_theme", selectedTheme);
      }, theme);

      for (const viewport of onboardingViewports) {
        await page.setViewportSize(viewport);

        for (const route of onboardingRoutes) {
          await page.goto(route, { waitUntil: "domcontentloaded" });
          await expect(page.locator("main").first()).toBeVisible();
          await expect.poll(() => page.evaluate(
            () => document.documentElement.classList.contains("dark"),
          )).toBe(theme === "dark");

          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(
            overflow,
            `${theme} ${viewport.name} ${route} has page-level horizontal overflow`,
          ).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  test("captures the dashboard overview baseline", async ({ page }) => {
    await login(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const dashboard = page.locator("main").first();
    await expect(dashboard).toBeVisible();

    if (assertVisualBaselines) {
      await expect(dashboard).toHaveScreenshot("dashboard-overview-1440x900.png", {
        animations: "disabled",
      });
    } else {
      await dashboard.screenshot({
        path: test.info().outputPath("dashboard-overview-1440x900.png"),
        animations: "disabled",
      });
    }
  });

  test("exercises configured staging channel, prospect, and review paths without sending outreach", async ({ page }, testInfo) => {
    // The route-reachability test above retains the eight-device matrix. This
    // controlled integration path runs once so it does not repeatedly call a
    // real staging sender or prospect provider from every browser project.
    test.skip(testInfo.project.name !== "desktop-chromium", "Run the controlled provider path once per staging build");
    test.skip(
      !prospectQuery || !reviewCampaignId,
      "Set E2E_PROSPECT_QUERY and E2E_REVIEW_CAMPAIGN_ID for the controlled staging tenant",
    );

    await login(page);

    await page.goto("/dashboard/channels", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible();
    await page.getByRole("button", { name: "Sync accounts" }).click();
    await expect(page.getByText("Accounts synced.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("LinkedIn", { exact: true }).first()).toBeVisible();

    await page.goto("/dashboard/prospects", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add prospect" }).click();
    const dialog = page.getByRole("dialog");
    const search = dialog.getByLabel("Search LinkedIn prospects");
    await expect(search).toBeVisible();
    await search.fill(prospectQuery!);

    const emptyResults = dialog.getByText("No prospects found. Try a broader title, company, or keyword.");
    const resultList = dialog.locator("ul").filter({ has: dialog.getByRole("button", { name: "Add" }) });
    await expect(emptyResults.or(resultList)).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByRole("alert")).toHaveCount(0);

    await page.goto(`/dashboard/prospects?campaignId=${encodeURIComponent(reviewCampaignId!)}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Review campaign audience" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review campaign" }).first()).toBeVisible();
  });
});
