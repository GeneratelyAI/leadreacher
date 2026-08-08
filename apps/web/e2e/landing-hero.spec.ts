import { expect, test, type Page } from "@playwright/test";

const completedStatus = {
  status: "completed", url: "https://generately.ai", market: "Marketing technology",
  offer: "Content operations platform", audience: "Growing businesses", value: "Unified content production",
  strategyStatus: "Preparing a targeted outreach strategy.", error: null,
};

async function mockCompletedAnalysis(page: Page) {
  await page.route("https://www.google.com/s2/favicons**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#58b947"/></svg>',
    }),
  );
  await page.route("**/discovery/scrape/anonymous", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...completedStatus, status: "running" }) }));
  await page.route("**/discovery/scrape/anonymous-status**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(completedStatus) }));
}

test("renders the desktop reference composition without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Drop your URL. Go back to business." })).toBeVisible();
  await expect(page.locator('nav a[href="/"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze my website" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("opens and dismisses the resources navigation menu accessibly", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Resources" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-slot="navigation-menu-content"] a[href="/terms"]')).toBeVisible();
  await expect(page.locator('[data-slot="navigation-menu-content"] a[href="/privacy"]')).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="navigation-menu-content"] a[href="/terms"]')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("validates the URL and starts a claimable anonymous analysis", async ({ page }) => {
  await mockCompletedAnalysis(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze my website" }).click();
  await expect(page.getByText("Enter a valid company website")).toBeVisible();
  await page.getByLabel("Company website").fill("generately.ai");
  await expect.poll(() => page.getByTestId("landing-website-favicon").evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  await page.getByRole("button", { name: "Analyze my website" }).click();
  await expect(page.getByText("LeadReacher is getting to work…")).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/, { timeout: 8_000 });
  const stored = await page.evaluate(() => ({ url: localStorage.getItem("lr_website_url"), anonId: localStorage.getItem("lr_anon_scrape_id") }));
  expect(stored.url).toBe("generately.ai");
  expect(stored.anonId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("keeps the previous compact mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const logo = page.locator('nav a[href="/"]');
  const getStarted = page.getByRole("navigation").getByRole("link", { name: "Get Started" });
  await expect(logo).toBeVisible();
  await expect(getStarted).toHaveAttribute("href", "/signup");

  const [logoBox, getStartedBox] = await Promise.all([logo.boundingBox(), getStarted.boundingBox()]);
  expect(logoBox).not.toBeNull();
  expect(getStartedBox).not.toBeNull();
  expect((logoBox?.x ?? 0) + (logoBox?.width ?? 0)).toBeLessThan(getStartedBox?.x ?? 0);
});

test("moves through the product story without layout overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");

  const urlBeforeScroll = new URL(page.url());
  await page.getByRole("button", { name: "See how LeadReacher works" }).click();
  await expect(page.getByRole("heading", { name: "Customer acquisition that runs itself." })).toBeVisible();
  await expect.poll(async () => {
    const box = await page.getByText("How LeadReacher works", { exact: true }).boundingBox();
    return box !== null && box.y >= 48 && box.y <= 128;
  }).toBe(true);
  const urlAfterScroll = new URL(page.url());
  expect(urlAfterScroll.pathname).toBe(urlBeforeScroll.pathname);
  expect(urlAfterScroll.search).toBe(urlBeforeScroll.search);
  expect(urlAfterScroll.hash).toBe(urlBeforeScroll.hash);
  await expect(page.getByText("Understand", { exact: true })).toBeVisible();
  await expect(page.getByText("Reach", { exact: true })).toBeVisible();
  await expect(page.getByText("Convert", { exact: true })).toBeVisible();

  const outreachTab = page.getByRole("tab", { name: /Outreach/ });
  await outreachTab.click();
  await expect(outreachTab).toHaveAttribute("aria-selected", "true");
  const storyFrame = page.getByTestId("container-scroll-frame");
  await expect(storyFrame.getByRole("img", { name: /campaigns dashboard/i })).toBeVisible();
  const frameBox = await storyFrame.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((frameBox?.y ?? 0) + (frameBox?.height ?? 0)).toBeLessThanOrEqual(1024);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("supports keyboard stage navigation and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/#how-it-works");

  const websiteTab = page.getByRole("tab", { name: /Website/ });
  await websiteTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Strategy/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("container-scroll-frame")).toHaveCSS("transform", "none");
});

test("uses natural workflow chapters on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#how-it-works");

  await expect(page.getByRole("heading", { name: "Customer acquisition that runs itself." })).toBeVisible();
  await expect(page.locator("#how-it-works").getByRole("article")).toHaveCount(5);
  await expect(page.getByRole("tablist", { name: "LeadReacher workflow stages" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("pauses the channel orbit for reliable node selection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const linkedInNode = page.locator('[aria-controls="orbital-channel-1"]');
  await linkedInNode.scrollIntoViewIfNeeded();
  await linkedInNode.click();
  await expect(linkedInNode).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#orbital-channel-1")).toContainText("Invites and follow-ups from your connected LinkedIn account.");

  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  await expect(page.locator('[aria-controls="orbital-channel-2"]')).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#orbital-channel-2")).toContainText("Direct conversations with campaign and reply context attached.");
});
