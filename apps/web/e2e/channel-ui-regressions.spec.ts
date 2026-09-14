import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
];

async function expectNoOverflow(page: Page, desktop: boolean) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const scrollableRegions = await page.locator('.onboarding-scene-task-scroll, .onboarding-persistent-pill').evaluateAll((regions) => regions.filter((region) => {
    const style = getComputedStyle(region);
    return region.getClientRects().length && /auto|scroll/.test(style.overflowY) && region.scrollHeight > region.clientHeight + 1;
  }).length);
  expect(scrollableRegions).toBe(0);
  if (desktop) expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(page.viewportSize()!.height);
}

async function expectCenteredBack(page: Page) {
  const back = page.getByRole("button", { name: "Back", exact: true });
  await expect(back).toBeEnabled();
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
  await back.scrollIntoViewIfNeeded();
  const bounds = await back.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(bounds!.x + bounds!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(1);
  expect(await back.evaluate((button) => {
    const r = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

for (const viewport of viewports) {
  test(`provider selections, mobile marks and final review stay consistent at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/onboarding-preview/channels");
    await expect(page.getByRole("checkbox", { name: "LinkedIn", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Gmail", exact: true })).toBeChecked();
    const mobile = viewport.width <= 1008;
    if (mobile) await page.getByRole("button", { name: /Open campaign summary/ }).click();
    const summary = mobile ? page.getByRole("dialog") : page.locator(".onboarding-persistent-pill");
    await expect(summary.getByRole("listitem", { name: "LinkedIn", exact: true })).toBeVisible();
    await expect(summary.getByRole("listitem", { name: "Gmail", exact: true })).toBeVisible();
    if (mobile) await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
    await page.screenshot({ path: testInfo.outputPath(`channels-${viewport.width}.png`), fullPage: true });
    await expectNoOverflow(page, !mobile);
    if (mobile) {
      await page.waitForTimeout(1_200);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expectCenteredBack(page);
    }
    await page.getByRole("button", { name: "Continue to checkout", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    const subscribe = page.getByRole("button", { name: mobile ? "Subscribe (preview)" : "Subscribe to LeadReacher Pro", exact: true });
    await expect(subscribe).toBeEnabled();
    if (mobile) {
      const plan = page.getByRole("region", { name: "Your subscription plan" });
      await expect(plan.getByText("Gmail", { exact: true })).toHaveCount(1);
      await expect(plan.getByText("Outlook", { exact: true })).toHaveCount(1);
      await expect(plan.getByText("Included", { exact: true })).toHaveCount(1);
      await expect(plan.getByText("gmail channel", { exact: true })).toHaveCount(0);
      await expectCenteredBack(page);
    }
    await page.screenshot({ path: testInfo.outputPath(`checkout-${viewport.width}.png`), fullPage: true });
    await expectNoOverflow(page, !mobile);
    await subscribe.click();
    await expect(page).toHaveURL(/\/connect-channels$/);
    for (const channel of ["gmail", "outlook"]) {
      await page.locator(`[data-channel="${channel}"]`).getByRole("button", { name: "Connect", exact: true }).click();
      await expect(page.locator(`[data-channel="${channel}"] button[data-connected="true"]`)).toBeEnabled();
    }
    await expect(page.getByText("3 of 3 required channels connected", { exact: true })).toBeVisible();
    if (mobile) {
      await page.waitForTimeout(1_200);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expectCenteredBack(page);
    }
    await page.getByRole("button", { name: "Review campaign", exact: true }).click();
    if (mobile) {
      await expect(page.getByRole("region", { name: "Campaign review content" })).toContainText("LinkedIn · Gmail · Outlook");
      await page.getByRole("button", { name: "Open campaign draft", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/live\?reviewCampaignId=preview-campaign/);
    await expect(page.getByRole("heading", { name: /Your campaign is live/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`campaign-live-${viewport.width}.png`), fullPage: true });
    await expectNoOverflow(page, !mobile);
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`mobile Back stays centered below the primary across steps at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["cta", "channels", "checkout", "connect-channels", "connect-channels?review=true", "campaign-content", "campaign-content/your-video", "campaign-content/document"]) {
      await page.goto(`/onboarding-preview/${route}`);
      await expectCenteredBack(page);
      const actions = page.locator('.onboarding-campaign-action-row, .campaign-content-actions, .upload-your-video-actions, .upload-document-actions').filter({ visible: true }).last();
      const back = actions.getByRole("button", { name: "Back", exact: true });
      const primary = actions.getByRole("button").filter({ hasNotText: /^Back$/ }).filter({ visible: true }).last();
      if (await primary.count()) {
        const primaryBox = await primary.boundingBox();
        const backBox = await back.boundingBox();
        expect(backBox!.y).toBeGreaterThanOrEqual(primaryBox!.y + primaryBox!.height);
      }
      await expectNoOverflow(page, false);
    }
  });
}
