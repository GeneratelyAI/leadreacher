import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
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

test.describe("authenticated responsive staging", () => {
  test.beforeEach(() => {
    test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD for the seeded staging organization");
  });

  test("keeps onboarding and every dashboard route reachable on a phone", async ({ page }) => {
    // The auth form is server-rendered before React attaches its handlers.
    // WebKit can otherwise hydrate between the two fills and replace the
    // email input, leaving the visually completed form unable to submit.
    await page.goto("/login", { waitUntil: "networkidle" });
    const authView = page.getByTestId("mobile-auth-view");
    await authView.getByPlaceholder("Enter your work email").fill(email!);
    await authView.getByPlaceholder("Enter your password").fill(password!);
    await authView.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/(dashboard|onboarding)/);

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} has page-level horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });
});
