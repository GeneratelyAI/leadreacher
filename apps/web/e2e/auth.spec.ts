import { expect, test, type Page } from "@playwright/test";

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

test.beforeEach(async ({ isMobile }) => {
  test.skip(!isMobile, "Mobile authentication reference coverage");
});

test.describe("signup mobile", () => {
  test("uses the existing two-field form with readable labels and secure autofill", async ({ page }) => {
    await gotoReady(page, "/signup");
    const form = page.getByTestId("signup-campaign-auth");
    await expect(form.getByRole("heading", { name: /^Launch your first campaign\s*\.$/ })).toBeVisible();
    await expect(form.getByLabel("Email address", { exact: true })).toHaveAttribute("autocomplete", "email");
    await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    await expect(form.locator("input")).toHaveCount(2);
    for (const name of ["Email address", "Password"]) {
      expect(await form.getByLabel(name, { exact: true }).evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
      const label = form.locator("label").filter({ hasText: name });
      expect((await label.boundingBox())?.height).toBeGreaterThan(12);
    }
    await expect(form.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    await expect(form.getByRole("link", { name: "Privacy Policy." })).toHaveAttribute("href", "/privacy");
  });

  test("preserves password policy validation without sending credentials", async ({ page }) => {
    const authRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/auth\/v1\/(signup|token)/.test(request.url())) authRequests.push(request.url());
    });
    await gotoReady(page, "/signup");
    const form = page.getByTestId("signup-campaign-auth");
    await form.getByLabel("Email address", { exact: true }).fill("alex@example.test");
    await form.getByLabel("Password", { exact: true }).fill("alllowercasepassword");
    await form.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("including uppercase, lowercase, a number, and a symbol");
    expect(authRequests).toEqual([]);
  });

  test("password reveal is a real 44px target and the action is user-scroll reachable", async ({ page, browserName }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoReady(page, "/signup");
    const form = page.getByTestId("signup-campaign-auth");
    const reveal = form.getByRole("button", { name: "Show password" });
    const box = await reveal.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await form.getByLabel("Password", { exact: true }).fill("PreviewPassword123!");
    await reveal.click();
    await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await form.getByRole("button", { name: "Hide password" }).click();
    await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    await page.evaluate(() => window.scrollTo(0, 0));
    if (browserName === "webkit") {
      // Mobile WebKit's protocol cannot send wheel gestures. Keyboard paging
      // checks its document scroll owner; native touch remains a manual coverage gap.
      await page.locator("body").click({ position: { x: 4, y: 4 } });
      await page.keyboard.press("PageDown");
    } else {
      await page.mouse.wheel(0, 550);
    }
    await expect.poll(async () => form.getByRole("button", { name: "Create account", exact: true }).evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("login mobile", () => {
  test("does not invent campaign context and preserves recovery controls", async ({ page }) => {
    await gotoReady(page, "/login");
    const form = page.getByTestId("login-campaign-auth");
    await expect(form.getByRole("heading", { name: /^Welcome back\s*\.$/ })).toBeVisible();
    await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
    await expect(form.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(form.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    await expect(form.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
    await expect(form.getByRole("complementary", { name: "Live campaign summary" })).toHaveCount(0);
  });
});

test.describe("isolated authentication previews", () => {
  test("renders deterministic sample values and never starts OAuth", async ({ page }) => {
    const externalAuthRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/auth\/v1\/|\/auth\/google|\/auth\/microsoft|challenges\.cloudflare\.com/.test(request.url())) {
        externalAuthRequests.push(request.url());
      }
    });
    await gotoReady(page, "/onboarding-preview?screen=01");
    const form = page.getByTestId("signup-campaign-auth");
    await expect(form.getByLabel("Email address", { exact: true })).toHaveValue("alex@acme.example");
    await expect(form.getByLabel("Password", { exact: true })).toHaveValue("Campaign2026!");
    await form.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/screen=03/);
    expect(externalAuthRequests).toEqual([]);
  });

  test("login preview and signup preview link to each other without production auth", async ({ page }) => {
    await gotoReady(page, "/onboarding-preview?screen=02");
    const form = page.getByTestId("login-campaign-auth");
    await expect(form.getByLabel("Email address", { exact: true })).toHaveValue("alex@acme.example");
    await form.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/screen=01/);
    await page.getByTestId("signup-campaign-auth").getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/screen=02/);
  });
});
