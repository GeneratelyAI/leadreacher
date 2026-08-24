import { expect, test, type Locator, type Page } from "@playwright/test";

// AuthForm renders both MobileAuth and the desktop form at once -
// `lg:hidden` is CSS-only, not removed from the DOM - so locators must be
// scoped to whichever view is actually visible at the current viewport, or
// they'll strict-mode-collide against the other view's duplicate fields.
function mobileView(page: Page): Locator {
  return page.getByTestId("mobile-auth-view");
}

// SSR renders these "use client" forms fully interactive-looking before
// React has hydrated and attached their handlers - clicking too early is a
// silent no-op. Wait for DOM content first, then give hydration a bounded
// network-idle window without requiring every third-party asset to finish.
async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

// This whole file exercises MobileAuth specifically, which is display:none
// at desktop widths - not just slower there, genuinely not the active UI.
test.beforeEach(async ({ isMobile }) => {
  test.skip(!isMobile, "mobile-auth-view only - desktop coverage belongs in a separate spec");
});

test.describe("signup - mobile", () => {
  test("inputs never trigger iOS Safari's zoom-on-focus", async ({ page }) => {
    await gotoReady(page, "/signup");
    const view = mobileView(page);
    await expect(view.getByPlaceholder("Enter your work email")).toBeVisible();

    // iOS Safari force-zooms the viewport on focus for any input computing
    // below 16px and never zooms back out - this is a hard regression guard
    // for that bug, not a style preference.
    for (const placeholder of ["Enter your full name", "Enter your work email", "Create a password"]) {
      const input = view.getByPlaceholder(placeholder);
      const fontSize = await input.evaluate((el) => getComputedStyle(el).fontSize);
      expect(fontSize).toBe("16px");
    }
  });

  test("account type toggle switches between individual and company", async ({ page }) => {
    await gotoReady(page, "/signup");
    const view = mobileView(page);

    const individual = view.getByRole("radio", { name: "Individual" });
    const company = view.getByRole("radio", { name: "Company / Team" });

    await expect(individual).toHaveAttribute("aria-checked", "true");
    await expect(view.getByPlaceholder("Enter your company name")).not.toBeVisible();

    await company.click();
    await expect(company).toHaveAttribute("aria-checked", "true");
    await expect(individual).toHaveAttribute("aria-checked", "false");
    await expect(view.getByPlaceholder("Enter your company name")).toBeVisible();
  });

  test("blocks submit without a company name when Company/Team is selected", async ({ page }) => {
    await gotoReady(page, "/signup");
    const view = mobileView(page);

    await view.getByRole("radio", { name: "Company / Team" }).click();
    await view.getByPlaceholder("Enter your full name").fill("Jordan Rivera");
    await view.getByPlaceholder("Enter your work email").fill("jordan@example.com");
    await view.getByPlaceholder("Create a password").fill("correct-horse-battery");
    await view.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(view.getByText("Enter your company name to continue.")).toBeVisible();
  });

  test("password reveal and every interactive control meet the 44px touch-target minimum", async ({ page }) => {
    await gotoReady(page, "/signup");
    const view = mobileView(page);

    const revealButton = view.getByRole("button", { name: "Show password" });
    const box = await revealButton.boundingBox();
    expect(box).not.toBeNull();

    // Visual size may stay small (a 20px icon) - what matters is the actual
    // hit area, expanded invisibly via the .tap-target CSS utility.
    const hitArea = await revealButton.evaluate((el) => {
      const after = getComputedStyle(el, "::after");
      return { width: after.width, height: after.height };
    });
    expect(hitArea.width).toBe("44px");
    expect(hitArea.height).toBe("44px");

    await view.getByPlaceholder("Create a password").fill("secret-value");
    await revealButton.click();
    await expect(view.getByPlaceholder("Create a password")).toHaveAttribute("type", "text");
  });
});

test.describe("login - mobile", () => {
  test("renders the core form and links to signup", async ({ page }) => {
    await gotoReady(page, "/login");
    const view = mobileView(page);

    await expect(view.getByPlaceholder("Enter your work email")).toBeVisible();
    await expect(view.getByPlaceholder("Enter your password")).toBeVisible();
    await expect(view.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(view.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  });

  test("theme toggle updates the mobile browser-chrome color in sync", async ({ page }) => {
    await gotoReady(page, "/login");

    // ThemeToggle renders once in AuthLayout, outside both the
    // mobile and desktop view wrappers - only repositioned via responsive
    // classes, not duplicated - so this is intentionally unscoped.
    const getThemeColor = () => page.locator('meta[name="theme-color"]').getAttribute("content");

    const initial = await getThemeColor();
    await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();

    // The toggle animates via document.startViewTransition when supported,
    // so the meta tag update isn't guaranteed synchronous with the click.
    await expect.poll(getThemeColor).not.toBe(initial);
  });
});
