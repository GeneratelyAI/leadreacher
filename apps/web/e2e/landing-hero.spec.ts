import { expect, test, type Page } from "@playwright/test";

const completedStatus = {
  status: "completed", url: "https://generately.ai", market: "Marketing technology",
  offer: "Content operations platform", audience: "Growing businesses", value: "Unified content production",
  strategyStatus: "Preparing a targeted outreach strategy.", error: null,
};

const phoneProjects = new Set(["android-chrome", "iphone-webkit"]);
const heroHeadingName =
  "Drop your URL. Go back to your business, store, startup, brokerage, product, or agency.";
const workflowHeadingName = "Fully automates new customer acquisition.";

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

async function openLanding(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page.locator("#top")).toHaveAttribute("data-hydrated", "true", {
    timeout: 10_000,
  });
}

test("renders the desktop reference composition without overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop composition only");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openLanding(page);
  await expect(page.getByRole("heading", { name: heroHeadingName })).toBeVisible();
  await expect(page.locator('header a[href="/"]').filter({ has: page.locator('img[alt="leadreacher"]') })).toBeVisible();
  await expect(page.locator("#top").getByRole("button", { name: "Get Started", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("opens and dismisses the resources navigation menu accessibly", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop navigation only");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openLanding(page);

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
  await openLanding(page);
  await page.locator("#top").getByRole("button", { name: "Get Started", exact: true }).click();
  const heroWebsiteInput = page.locator("#top").getByLabel("Company website");
  await expect(heroWebsiteInput).toHaveAttribute("aria-invalid", "true");
  await heroWebsiteInput.fill("generately.ai");
  await page.locator("#top").getByRole("button", { name: "Get Started", exact: true }).click();
  await expect(page.locator("#top").getByRole("button", { name: "Analyzing website" })).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/, { timeout: 8_000 });
  const stored = await page.evaluate(() => ({ url: localStorage.getItem("lr_website_url"), anonId: localStorage.getItem("lr_anon_scrape_id") }));
  expect(stored.url).toBe("generately.ai");
  expect(stored.anonId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("shows the compact mobile navigation with the icon-only logo", async ({ page }, testInfo) => {
  test.skip(!phoneProjects.has(testInfo.project.name), "Phone navigation only");
  await page.setViewportSize({ width: 320, height: 568 });
  await openLanding(page);
  const nav = page.locator("header nav");
  await expect(nav.getByRole("link", { name: "LeadReacher home" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Get Started", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Product", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("moves through the product story without layout overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop story interaction only");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openLanding(page);

  const urlBeforeScroll = new URL(page.url());
  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: workflowHeadingName })).toBeVisible();
  const urlAfterScroll = new URL(page.url());
  expect(urlAfterScroll.pathname).toBe(urlBeforeScroll.pathname);
  expect(urlAfterScroll.search).toBe(urlBeforeScroll.search);
  expect(urlAfterScroll.hash).toBe(urlBeforeScroll.hash);
  const storyFrame = page.getByTestId("container-scroll-frame");
  await expect(storyFrame.getByText("01 · Understand", { exact: true })).toBeVisible();

  const outreachTab = page.getByRole("tab", { name: /Outreach/ });
  await outreachTab.click();
  await expect(outreachTab).toHaveAttribute("aria-selected", "true");
  const dashboardDemo = storyFrame.getByTestId("interactive-dashboard-demo");
  await expect(dashboardDemo).toHaveAttribute("data-demo-stage", "outreach");
  await dashboardDemo.getByRole("button", { name: "Launch demo" }).click();
  await expect(dashboardDemo.getByRole("button", { name: "Campaign running" })).toBeVisible();
  const frameBox = await storyFrame.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((frameBox?.y ?? 0) + (frameBox?.height ?? 0)).toBeLessThanOrEqual(1025);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("supports keyboard stage navigation and reduced motion", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop tab interaction only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openLanding(page, "/#how-it-works");

  const websiteTab = page.getByRole("tab", { name: /Website/ });
  await websiteTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Strategy/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("container-scroll-frame")).toHaveCSS("transform", "none");
});

test("uses natural workflow chapters on mobile", async ({ page }, testInfo) => {
  test.skip(!phoneProjects.has(testInfo.project.name), "Phone workflow only");
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page, "/#how-it-works");

  await expect(page.getByRole("heading", { name: workflowHeadingName })).toBeVisible();
  await expect(page.locator('[id^="mobile-story-"]')).toHaveCount(5);
  await expect(page.getByRole("tablist", { name: "LeadReacher workflow stages" })).toBeHidden();
  const progress = page.getByRole("navigation", { name: "Workflow progress" });
  await progress.getByRole("link", { name: "2, Strategy" }).click();
  await expect(progress.getByRole("link", { name: "2, Strategy" })).toHaveAttribute("aria-current", "step");
  await expect(page.locator("#mobile-story-strategy")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keeps rounded section transitions above adjacent blocks and reveals the footer after a fast scroll", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop sticky footer only");
  await page.setViewportSize({ width: 1366, height: 768 });
  await openLanding(page);

  const faqSection = page
    .getByRole("heading", { name: "Know what happens before you start." })
    .locator("xpath=ancestor::section[1]");
  await faqSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const absoluteTop = await faqSection.evaluate((section) => section.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top - 120), absoluteTop);

  await expect.poll(() => faqSection.evaluate((section) => {
    const bounds = section.getBoundingClientRect();
    const paintedElement = document.elementFromPoint(window.innerWidth / 2, bounds.top + 2);
    return paintedElement ? section.contains(paintedElement) : false;
  })).toBe(true);
  await expect(faqSection).toHaveCSS("border-top-left-radius", "40px");

  for (let index = 0; index < 4; index += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(50);
  }

  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  await expect.poll(() => footer.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.abs(bounds.bottom - window.innerHeight);
  })).toBeLessThan(2);
});

test("pauses the channel orbit for reliable node selection", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLanding(page);

  const linkedInNode = page.locator('[data-orbital-node="1"]');
  await linkedInNode.scrollIntoViewIfNeeded();
  if (!phoneProjects.has(testInfo.project.name)) {
    await linkedInNode.hover();
    await page.waitForTimeout(1_050);
  }
  await linkedInNode.click();
  await expect(linkedInNode).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#orbital-channel-1")).toContainText("Invites and follow-ups from your connected LinkedIn account.");

  const orbit = linkedInNode.locator("xpath=ancestor::div[contains(@class, 'overflow-hidden')][1]");
  const orbitBox = await orbit.boundingBox();
  const selectedNodeBox = await linkedInNode.boundingBox();
  expect(orbitBox).not.toBeNull();
  expect(selectedNodeBox).not.toBeNull();
  expect(selectedNodeBox!.y).toBeGreaterThanOrEqual(orbitBox!.y);
  expect(selectedNodeBox!.y + selectedNodeBox!.height).toBeLessThanOrEqual(orbitBox!.y + orbitBox!.height);

  const gmailNode = page.getByRole("button", { name: "View Gmail details" });
  await expect(gmailNode).not.toHaveAttribute("aria-controls");

  await page.getByRole("button", { name: /WhatsApp/ }).last().click();
  const whatsappNode = page.locator('[data-orbital-node="2"]');
  await expect(whatsappNode).toHaveAttribute("aria-expanded", "true");
  await expect(whatsappNode).toHaveAttribute("aria-controls", "orbital-channel-2");
  await expect(whatsappNode).toBeFocused();
  await expect(page.locator("#orbital-channel-2")).toContainText("Direct conversations with campaign and reply context attached.");

  await orbit.click({ position: { x: 16, y: 16 } });
  await expect(whatsappNode).toHaveAttribute("aria-expanded", "false");
  await expect(whatsappNode).not.toHaveAttribute("aria-controls");
  await expect(page.locator("#orbital-channel-2")).toHaveCount(0);
});
