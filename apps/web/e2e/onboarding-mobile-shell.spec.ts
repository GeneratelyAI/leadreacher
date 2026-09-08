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
  const dialog = page.getByRole("dialog", { name: "Decision makers", exact: true });
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
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("mobile onboarding shell keeps the shared campaign disclosure and every task route usable", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  // The route matrix itself is intentionally run once. The existing suite runs
  // the same behavior across browser engines and device projects.
  test.skip(testInfo.project.name !== "desktop-chromium", "Mobile route matrix runs in Chromium.");

  for (const viewport of phoneViewports) {
    await page.setViewportSize(viewport);

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator(".onboarding-persistent-pill .campaign-pill")).toHaveCount(1);
      if (route.includes("step=checkout")) {
        // The approved payment screen replaces the disclosure with its plan
        // summary, while retaining the shared campaign instance offscreen.
        await expect(page.locator(".onboarding-persistent-pill")).toBeHidden();
        await expect(page.getByRole("region", { name: "Your subscription plan" })).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: /^Open campaign summary for / })).toBeVisible();
      }
      await expect(page.getByRole("link", { name: "LeadReacher home", exact: true }).filter({ visible: true })).toHaveCount(1);
      await expect(page.locator(".onboarding-viewport-fit")).toHaveCSS("overflow", "visible");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const actions = page.locator('.onboarding-campaign-next, .onboarding-actions button, .checkout-mock button').filter({ visible: true });
      await expect(actions.first()).toBeVisible();
      expect(await actions.count()).toBeGreaterThan(0);
      const reached = new Set<number>();
      const recordReachableActions = async () => {
        for (const [index, action] of (await actions.all()).entries()) {
          const rect = await action.boundingBox();
          if (rect && rect.width > 0 && rect.y >= 0 && rect.y + rect.height <= viewport.height) reached.add(index);
        }
      };
      await recordReachableActions();
      // Use the document gutter, outside interactive rails and disclosures.
      // Record actual onscreen visibility, not locator auto-scrolling.
      await page.mouse.move(viewport.width - 4, viewport.height - 40);
      for (let attempt = 0; attempt < 16; attempt++) {
        await page.mouse.wheel(0, viewport.height * .45);
        await page.waitForTimeout(80);
        await recordReachableActions();
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
      expect(reached.size, `${route} at ${viewport.width}x${viewport.height}: every action is fully reachable through user scrolling`).toBe(await actions.count());
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

  // The modal correctly hides its background from the accessibility tree.
  // Keep the trigger addressable only to inspect its synchronized ARIA state.
  const toggle = page.getByRole("button", { name: "Open campaign summary for acme.example", includeHidden: true });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog", { name: "Your campaign", exact: true })).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Your campaign", exact: true });
  await expect(dialog).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const business = dialog.locator("section[data-business] > button");
  await expect(business).toHaveAttribute("aria-expanded", "true");
  const details = page.locator(`#${await business.getAttribute("aria-controls")}`);
  await expect(details).toBeVisible();
  await expect(details).toContainText("Automated personalized outreach");
  await business.focus();
  await page.keyboard.press("Space");
  await expect(business).toHaveAttribute("aria-expanded", "false");
  await expect(details).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(business).toHaveAttribute("aria-expanded", "true");
  await expect(details).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
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

test("numbered AI style preview preserves an approved style through Back and refresh", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const deadline = performance.now() + 4000;
    const sample = () => {
      const rail = document.querySelector<HTMLElement>(".personalized-video-style-grid");
      const selected = rail?.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!rail || !selected || !rail.offsetWidth) {
        if (performance.now() < deadline) requestAnimationFrame(sample);
        return;
      }
      document.documentElement.dataset.firstStylePresented = JSON.stringify({
        label: selected.querySelector(".personalized-video-style-card-title")?.textContent,
        position: document.querySelector(".video-style-rail-controls > span")?.textContent,
        left: selected.getBoundingClientRect().left - rail.getBoundingClientRect().left,
      });
    };
    requestAnimationFrame(sample);
  });
  await page.goto("/onboarding-preview?screen=10&step=ai-video-style&media=placeholder");
  await expect(page.getByRole("radio", { name: /^Casual/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-first-style-presented", /Casual/);
  const first = JSON.parse((await page.locator("html").getAttribute("data-first-style-presented"))!);
  expect(first.position).toBe("2 of 3");
  expect(first.left).toBeGreaterThanOrEqual(0);
  expect(first.left).toBeLessThanOrEqual(4);
  await page.getByRole("button", { name: "Aggressive", exact: true }).click();
  await expect(page.getByRole("radio", { name: /^Aggressive/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Use this style", exact: true }).click();
  await expect(page).toHaveURL(/step=checkout/);
  await page.goBack();
  await expect(page).toHaveURL(/screen=10/);
  await expect(page.getByRole("radio", { name: /^Aggressive/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".video-style-rail-controls")).toContainText("3 of 3");
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Aggressive/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".video-style-rail-controls")).toContainText("3 of 3");
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
