import { expect, test } from "@playwright/test";

const forbiddenApiPath = /(\/auth\/bootstrap|\/discovery\/scrape|\/social-accounts|\/billing\/checkout-session|\/onboarding\/complete|\/campaigns\/.*launch|\/upload)/i;

function isForbiddenRequest(rawUrl: string): boolean {
  const url = new URL(rawUrl);
  return /(^|\.)(supabase\.co|stripe\.com|stripe\.network|unipile\.com)$/i.test(url.hostname) ||
    forbiddenApiPath.test(url.pathname);
}

test("completes the demo without production side effects", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "One browser covers the functional demo journey");
  const forbidden: string[] = [];
  page.on("request", (request) => {
    if (isForbiddenRequest(request.url())) forbidden.push(request.url());
  });

  await page.goto("/demo/onboarding?step=signup");
  const signup = page.getByTestId("desktop-auth-view");
  await expect(signup.getByRole("heading", { name: "Welcome to leadreacher" })).toBeVisible();
  await signup.getByLabel("Full name").fill("Alex Morgan");
  await signup.getByLabel("Work email").fill("alex@example.com");
  await signup.getByLabel("Password", { exact: true }).fill("Demo-password-2026!");
  await signup.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Why do customers choose you?" })).toBeVisible({ timeout: 5_000 });
  await page.getByPlaceholder("What do you do better, faster, or differently?").fill("We coordinate personalized outreach without manual prospecting.");
  await page.getByRole("button", { name: "Submit competitive advantage" }).click();

  await expect(page.getByRole("heading", { name: "How LeadReacher works" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to next step" }).click();
  await expect(page.getByRole("heading", { name: "Your target audience" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to next step" }).click();
  await expect(page.getByRole("heading", { name: "Choose your channels" })).toBeVisible();
  await page.getByRole("button", { name: /Continue with \d+ channels?/ }).click();

  await expect(page.getByRole("heading", { name: "Choose your campaign type" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to next step" }).click();
  await expect(page.getByRole("heading", { name: "Choose your video tone" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to checkout" }).click();

  const subscribe = page.getByRole("button", { name: "Subscribe to LeadReacher Pro" });
  await expect(subscribe).toBeVisible({ timeout: 10_000 });
  await subscribe.click();
  await expect(page.getByRole("heading", { name: "Connect your channels" })).toBeVisible();
  const whatsapp = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "WhatsApp" }) });
  await whatsapp.getByRole("button", { name: "Connect" }).click();
  await expect(whatsapp.getByText("Demo WhatsApp account")).toBeVisible();
  await expect(whatsapp.getByText("Connected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish setup and review" }).click();

  await expect(page).toHaveURL(/\/demo\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your sample campaign workspace" })).toBeVisible();
  expect(forbidden).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("restores a demo session after refresh", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "One browser covers persistence");
  await page.goto("/demo/onboarding?step=signup");
  const signup = page.getByTestId("desktop-auth-view");
  await signup.getByLabel("Full name").fill("Sam Demo");
  await signup.getByLabel("Work email").fill("sam@example.com");
  await signup.getByLabel("Password", { exact: true }).fill("Demo-password-2026!");
  await signup.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Why do customers choose you?" })).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Why do customers choose you?" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("lr_demo_onboarding_v1") ?? "null"));
  expect(stored.signup).toEqual({ name: "Sam Demo", email: "sam@example.com", complete: true });
});

test("starts the demo from the landing website field", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "One browser covers the landing branch");
  const productionRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/discovery\/scrape/.test(request.url())) productionRequests.push(request.url());
  });
  await page.goto("/");
  await page.locator("#top[data-hydrated='true']").waitFor();
  const website = page.locator("#top").getByLabel("Company website");
  await website.fill("leadreacher.ai/pricing");
  await page.locator("#top").getByRole("button", { name: "Get Started", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/onboarding\?step=signup$/);
  await expect(page.getByText("https://leadreacher.ai", { exact: true })).toBeVisible();
  expect(productionRequests).toEqual([]);
});
