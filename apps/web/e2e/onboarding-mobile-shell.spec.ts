import { expect, test } from "@playwright/test";

const phoneViewports = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 390, height: 500 },
  { width: 844, height: 390 },
];

const routes = [
  "/onboarding-preview?step=discovery",
  "/onboarding-preview?step=strategy&substep=how-it-works",
  "/onboarding-preview?step=campaign-content",
  "/onboarding-preview?step=personalized-video-style",
  "/onboarding-preview?step=ai-video-style",
  "/onboarding-preview?step=upload-video",
  "/onboarding-preview?step=upload-document",
  "/onboarding-preview?step=checkout",
  "/onboarding-preview?step=channels",
  "/onboarding-preview?step=strategy&substep=targeting",
  "/onboarding-preview?step=strategy&substep=channels",
];

test("mobile long-chip overflow supports touch removal and viewport-contained disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=discovery");
  await page.getByLabel("Did we miss anything?").fill("Chief Financial Officer; Chief Revenue Officer; Chief Operations Officer; Vice President of Marketing; Director of Sales; Head of Demand Generation");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const trigger = page.getByRole("button", { name: /Show \d+ more decision makers/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Decision makers selections" });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    return box ? box.y >= 0 && box.y + box.height <= 500 : false;
  }).toBe(true);
  const remove = dialog.getByRole("button", { name: "Remove Chief Financial Officer from Decision makers", exact: true });
  await expect(remove).toHaveCSS("width", "44px");
  await remove.click();
  await expect(remove).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "Close Decision makers" }).click();
  await expect(trigger).toBeFocused();
});

test("mobile onboarding shell keeps the shared campaign disclosure and every task route usable", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  // The route matrix itself is intentionally run once. The existing suite runs
  // the same behavior across browser engines and device projects.
  test.skip(testInfo.project.name !== "desktop-chromium", "Mobile route matrix runs in Chromium.");

  for (const viewport of phoneViewports) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await page.goto(route);
      const summary = page.locator(".onboarding-persistent-pill .campaign-pill");
      await expect(summary).toBeVisible();
      await expect(page.locator(".onboarding-persistent-logo")).toBeVisible();
      await expect(page.locator(".onboarding-viewport-fit")).toHaveCSS("overflow", "visible");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      for (let attempt = 0; attempt < 8; attempt++) {
        await page.mouse.wheel(0, viewport.height);
        await page.waitForTimeout(80);
      }
      const scrolled = await page.evaluate(() => ({
        y: scrollY,
        height: document.documentElement.scrollHeight,
        viewport: innerHeight,
      }));
      if (scrolled.height > scrolled.viewport + 2) {
        expect(scrolled.y).toBeGreaterThan(0);
        expect(scrolled.y + scrolled.viewport).toBeGreaterThanOrEqual(scrolled.height - 3);
      }
      const actions = page.locator('.onboarding-campaign-next, .onboarding-actions button, .checkout-mock button');
      expect(await actions.count()).toBeGreaterThan(0);
      for (const action of await actions.all()) {
        const rect = await action.boundingBox();
        expect(rect?.width).toBeGreaterThan(0);
        expect(rect!.y + rect!.height + scrolled.y).toBeLessThanOrEqual(scrolled.height + 1);
      }
    }
  }
});

test("mobile campaign summary is an accessible compact disclosure", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Mobile interaction runs in Chromium.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding-preview?step=campaign-content");

  const toggle = page.getByRole("button", { name: "Expand your campaign" });
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Collapse your campaign" })).toBeVisible();
  await expect(page.locator(".campaign-pill-field, .campaign-pill-section").first()).toBeVisible();
  const business = page.getByRole("button", { name: "Business", exact: true });
  await business.click();
  await expect(business).toHaveAttribute("aria-expanded", "true");
  const details = page.locator(`#${await business.getAttribute("aria-controls")}`);
  await expect(details).toHaveAttribute("aria-hidden", "false");
  await expect(details).toContainText("Automated personalized outreach");
  await page.getByRole("button", { name: "Collapse your campaign" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Expand your campaign" })).toBeVisible();
});

test("preview content choice survives Back and refresh without live API requests", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const liveRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/(social-accounts|billing|strategy)\//.test(request.url()) && request.resourceType() === "fetch") liveRequests.push(request.url());
  });
  await page.goto("/onboarding-preview?step=campaign-content");
  await page.getByRole("radio", { name: /^Document/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/step=upload-document/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/step=campaign-content/);
  await expect(page.getByRole("radio", { name: /^Document/ })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Document/ })).toHaveAttribute("aria-checked", "true");
  await page.goto("/onboarding-preview?step=channels");
  await expect(page.locator(".campaign-pill-site-url")).toHaveText("acme.example");
  await expect(page.getByText("Not authenticated", { exact: true })).toHaveCount(0);
  expect(liveRequests).toEqual([]);
});

test("reduced-motion direct loads have no hydration errors and rails remain keyboard reachable", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=ai-video-style");
  const next = page.getByRole("button", { name: "Next video style" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".video-style-rail-controls")).toContainText("2 of 3");
  await page.keyboard.press("Enter");
  await expect(page.locator(".video-style-rail-controls")).toContainText("3 of 3");
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile actions, content choices, uploads, and reduced motion remain reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Mobile interaction runs in Chromium.");
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto("/onboarding-preview?step=campaign-content");
  await page.getByRole("radio", { name: /^Document/ }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: /^Document/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeVisible();

  await page.goto("/onboarding-preview?step=upload-video");
  await expect(page.getByRole("button", { name: "Browse files", exact: true })).toBeVisible();
  const dropZone = page.locator(".upload-your-video-drop-zone");
  await expect(dropZone).toBeVisible();
  expect(await dropZone.evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(120);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=personalized-video-style");
  await expect(page.getByRole("radio", { name: /^Professional/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
