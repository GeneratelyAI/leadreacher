import { expect, test, type Page } from "@playwright/test";

const assertVisualBaselines = process.env.VISUAL_REGRESSION === "true";

const viewports = [
  { name: "phone-320", width: 320, height: 568 },
  { name: "phone-360", width: 360, height: 800 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-412", width: 412, height: 915 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "tablet-820", width: 820, height: 1180 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop-short", width: 1024, height: 600 },
  { name: "desktop-1280", width: 1280, height: 720 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1536", width: 1536, height: 1024 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-wide", width: 2560, height: 1440 },
] as const;

async function openLanding(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await expect(page.getByRole("heading", { name: "Drop your URL. Go back to business." })).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
}

test.describe("responsive production matrix", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The viewport matrix runs once in Chromium");
  });

  for (const viewport of viewports) {
    test(`${viewport.name} has no page overflow or clipped primary controls`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLanding(page);
      await expectNoPageOverflow(page);

      const analyzer = page.getByRole("button", { name: "Get Started", exact: true });
      const analyzerBox = await analyzer.boundingBox();
      expect(analyzerBox).not.toBeNull();
      expect(analyzerBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((analyzerBox?.x ?? 0) + (analyzerBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);

      if (viewport.width >= 1024 && viewport.height >= 600) {
        await expect(page.getByText("Setup in 60 seconds", { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("button", { name: "See how LeadReacher works" })).toBeVisible();
        const nextBox = await page.locator("#product").boundingBox();
        expect(nextBox).not.toBeNull();
        expect(nextBox?.y ?? viewport.height + 1).toBeLessThan(viewport.height);
      }
    });
  }
});

test.describe("mobile landing journey", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!["android-chrome", "iphone-webkit"].includes(testInfo.project.name), "Phone journey only");
  });

  test("keeps navigation, sections, controls, and legal links reachable", async ({ page }) => {
    await openLanding(page);
    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: "Product", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Get Started", exact: true })).toBeVisible();

    await page.locator("#how-it-works").scrollIntoViewIfNeeded();
    await expect(page.locator('[id^="mobile-story-"]')).toHaveCount(5);

    const whatsapp = page.locator('[data-orbital-node="2"]');
    await whatsapp.scrollIntoViewIfNeeded();
    await whatsapp.click();
    await expect(page.locator("#orbital-channel-2")).toContainText("Direct conversations");

    const outreachTab = page.getByRole("tab", { name: "WhatsApp", exact: true });
    await outreachTab.scrollIntoViewIfNeeded();
    await outreachTab.click();
    await expect(outreachTab).toHaveAttribute("aria-selected", "true");

    const faq = page.getByRole("button", { name: "How quickly can I get started?" });
    await faq.scrollIntoViewIfNeeded();
    await faq.click();
    await expect(page.getByText("Drop in your website to begin.", { exact: false })).toBeVisible();

    await expect(page.getByRole("link", { name: "Build your campaign" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expectNoPageOverflow(page);
  });
});

test.describe("mobile pricing", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "The compact pricing matrix runs once in Chromium");
  });

  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    test(`${viewport.width}px keeps pricing controls and comparisons in the viewport`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/pricing", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Pricing designed for effortless outreach." })).toBeVisible();
      await page.waitForTimeout(400);
      await expectNoPageOverflow(page);

      const billingControl = page.getByRole("group", { name: "Billing cycle" });
      await expect(billingControl).toBeVisible();
      const billingBox = await billingControl.boundingBox();
      expect(billingBox).not.toBeNull();
      expect(billingBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((billingBox?.x ?? 0) + (billingBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);

      await expect(page.getByTestId("pricing-comparison-mobile")).toBeVisible();
      await expect(page.getByTestId("pricing-comparison-scroll")).toBeHidden();
      await expect(page.getByTestId("pricing-comparison-mobile").getByRole("article")).toHaveCount(3);

      const cycleSwitch = page.getByRole("switch", { name: "Switch between monthly and yearly billing" });
      await cycleSwitch.click();
      await expect(cycleSwitch).toHaveAttribute("aria-checked", "true");
      await expectNoPageOverflow(page);
    });
  }
});

test.describe("visual baselines", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Stable visual baselines use bundled Chromium");
  });

  test("short desktop hero", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1024, height: 600 });
    await openLanding(page);
    if (assertVisualBaselines) {
      await expect(page).toHaveScreenshot("landing-hero-1024x600.png", { animations: "disabled" });
    } else {
      await page.screenshot({ path: test.info().outputPath("landing-hero-1024x600.png"), animations: "disabled" });
    }
  });

  test("complete phone landing page", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openLanding(page);
    if (assertVisualBaselines) {
      await expect(page).toHaveScreenshot("landing-mobile-390x844.png", { animations: "disabled", fullPage: true });
    } else {
      await page.screenshot({ path: test.info().outputPath("landing-mobile-390x844.png"), animations: "disabled", fullPage: true });
    }
  });

  test("major landing sections", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLanding(page);

    const sections = [
      ["product-story.png", page.locator("section").filter({ has: page.getByRole("heading", { name: "Customer acquisition that runs itself." }) })],
      ["differentiation.png", page.locator("section").filter({ has: page.getByRole("heading", { name: "Why LeadReacher is different." }) })],
      ["campaign-preview.png", page.locator("section").filter({ has: page.getByRole("heading", { name: "See the work before it reaches a prospect." }) })],
      ["approval.png", page.locator("section").filter({ has: page.getByRole("heading", { name: "Nothing goes live until you approve it." }) })],
      ["pricing-and-faq.png", page.locator("#pricing")],
    ] as const;

    for (const [name, section] of sections) {
      await section.scrollIntoViewIfNeeded();
      if (assertVisualBaselines) {
        await expect(section).toHaveScreenshot(name, { animations: "disabled", timeout: 15_000 });
      } else {
        await section.screenshot({ path: test.info().outputPath(name), animations: "disabled" });
      }
    }
  });
});
