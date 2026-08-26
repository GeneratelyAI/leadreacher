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
  let startCount = 0;
  await page.route("https://www.google.com/s2/favicons**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#58b947"/></svg>',
    }),
  );
  await page.route("**/discovery/scrape/anonymous", (route) => {
    startCount += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...completedStatus, status: "running" }) });
  });
  await page.route("**/discovery/scrape/anonymous-status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        startCount > 0
          ? completedStatus
          : { ...completedStatus, status: "idle", url: null },
      ),
    }),
  );

  return { getStartCount: () => startCount };
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

test("defers below-fold video bytes and pauses the hero canvas outside its viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop lifecycle behavior only");
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openLanding(page);

  const fiberFlow = page.locator("#top [data-animation-active]");
  await expect(fiberFlow).toHaveAttribute("data-animation-active", "true");

  await expect(page.locator('[data-testid="scroll-expand-video-source"] video source')).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await expect(fiberFlow).toHaveAttribute("data-animation-active", "false");

  const videoFrame = page.getByTestId("scroll-expand-video-source");
  await videoFrame.scrollIntoViewIfNeeded();
  await expect(videoFrame.locator("video source")).toHaveCount(1);
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
  const analysis = await mockCompletedAnalysis(page);
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
  expect(analysis.getStartCount()).toBe(1);
});

test("shows an actionable message when website analysis cannot start", async ({ page }) => {
  await page.route("**/discovery/scrape/anonymous-status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...completedStatus, status: "idle", url: null }),
    }),
  );
  await page.route("**/discovery/scrape/anonymous", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ message: "Too many website analyses. Please try again shortly." }),
    }),
  );
  await openLanding(page);

  const heroWebsiteInput = page.locator("#top").getByLabel("Company website");
  await heroWebsiteInput.fill("mrsub.ca");
  await page.locator("#top").getByRole("button", { name: "Get Started", exact: true }).click();

  await expect(page.locator("#landing-website-url-error")).toHaveText(
    "Too many website analyses. Please try again shortly.",
  );
  await expect(heroWebsiteInput).toHaveAttribute("aria-invalid", "true");
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
  await expect(storyFrame).toHaveCSS("transform", "none");
  await expect(storyFrame.getByText("01 · Strategy", { exact: true })).toBeVisible();

  const outreachTab = page.getByRole("tab", { name: /Outreach/ });
  await outreachTab.click();
  await expect(outreachTab).toHaveAttribute("aria-selected", "true");
  const dashboardDemo = storyFrame.getByTestId("interactive-dashboard-demo");
  await expect(dashboardDemo).toHaveAttribute("data-demo-stage", "outreach");
  const instagramChannel = dashboardDemo.locator('button[aria-label*="Instagram"]');
  await instagramChannel.click();
  await expect(instagramChannel).toHaveAttribute("aria-pressed", "true");
  await dashboardDemo.getByRole("button", { name: "Send automatically", exact: true }).click();
  await expect(dashboardDemo.getByRole("button", { name: "Sent automatically", exact: true })).toBeVisible();
  await expect.poll(async () => {
    const box = await storyFrame.boundingBox();
    return box ? Math.abs(box.y + box.height / 2 - 512) : Number.POSITIVE_INFINITY;
  }).toBeLessThanOrEqual(1);
  const frameBox = await storyFrame.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((frameBox?.y ?? 0) + (frameBox?.height ?? 0)).toBeLessThanOrEqual(1025);
  expect(Math.abs((frameBox?.y ?? 0) + (frameBox?.height ?? 0) / 2 - 512)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1536, height: 1024 },
]) {
  test(`keeps the product story canvas pixel-stable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop story sizing only");
    await page.setViewportSize(viewport);
    await openLanding(page);
    await page.locator("#how-it-works").scrollIntoViewIfNeeded();

    const tabs = page.getByRole("tablist", { name: "LeadReacher workflow stages" }).getByRole("tab");
    const reference = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : null;
      };
      return {
        frame: bounds('[data-testid="container-scroll-frame"]'),
        tablet: bounds("#product-story-panel")?.width,
        tabletHeight: bounds("#product-story-panel")?.height,
      };
    });

    expect(reference.frame).not.toBeNull();
    expect(reference.tablet).toBeGreaterThan(0);
    expect(reference.tabletHeight).toBeGreaterThan(0);

    for (let index = 0; index < await tabs.count(); index += 1) {
      await tabs.nth(index).click();
      const samples = [];
      for (let sampleIndex = 0; sampleIndex < 12; sampleIndex += 1) {
        if (sampleIndex > 0) await page.waitForTimeout(20);
        samples.push(await page.evaluate(() => {
          const frame = document.querySelector<HTMLElement>('[data-testid="container-scroll-frame"]')?.getBoundingClientRect();
          const panel = document.querySelector<HTMLElement>("#product-story-panel")?.getBoundingClientRect();
          const demo = document.querySelector<HTMLElement>('[data-testid="interactive-dashboard-demo"]')?.getBoundingClientRect();
          return {
            frame: frame ? { width: frame.width, height: frame.height } : null,
            panel: panel ? { width: panel.width, height: panel.height } : null,
            demo: demo ? { width: demo.width, height: demo.height } : null,
          };
        }));
      }

      for (const sample of samples) {
        expect(sample.frame?.width).toBe(reference.frame?.width);
        expect(sample.frame?.height).toBe(reference.frame?.height);
        expect(sample.panel?.width).toBe(reference.tablet);
        expect(sample.panel?.height).toBe(reference.tabletHeight);
        expect(sample.demo?.width).toBe(reference.tablet);
        expect(sample.demo?.height).toBe(reference.tabletHeight);
      }
    }
  });
}

for (const viewport of [
  { width: 1366, height: 650 },
  { width: 1024, height: 600 },
]) {
  test(`keeps the product story readable on a short Windows desktop viewport at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop-"), "Desktop story sizing only");
    await page.setViewportSize(viewport);
    await openLanding(page);
    await page.locator("#product-story-scroll").scrollIntoViewIfNeeded();
    await page
      .getByRole("tablist", { name: "LeadReacher workflow stages" })
      .getByRole("tab", { name: /Prospects/ })
      .click();

    const layout = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } : null;
      };
      return {
        frame: bounds('[data-testid="container-scroll-frame"]'),
        stepper: bounds(".workflow-stepper"),
        workflow: bounds(".product-story-workflow"),
        panel: bounds("#product-story-panel"),
        copy: bounds(".product-story-side-copy"),
        pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    expect(layout.frame).not.toBeNull();
    expect(layout.stepper).not.toBeNull();
    expect(layout.workflow).not.toBeNull();
    expect(layout.panel).not.toBeNull();
    expect(layout.copy).not.toBeNull();
    expect(layout.frame?.width ?? 0).toBeGreaterThanOrEqual(Math.min(viewport.width - 80, 1240));
    expect(layout.panel?.width ?? 0).toBeGreaterThan((layout.frame?.width ?? 0) * 0.65);
    expect(layout.workflow?.y ?? 0).toBeGreaterThanOrEqual(layout.stepper?.bottom ?? Number.POSITIVE_INFINITY);
    expect(layout.copy?.y ?? -1).toBeGreaterThanOrEqual(layout.frame?.y ?? 0);
    expect(layout.copy?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(layout.frame?.bottom ?? 0);
    expect(layout.pageOverflows).toBe(false);
  });
}

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
