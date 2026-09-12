import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1366, height: 900 }, { width: 1440, height: 900 }, { width: 1280, height: 800 },
  { width: 1512, height: 858 }, { width: 1440, height: 798 }, { width: 1920, height: 990 },
]) {
  test(`checkout fits without scrolling at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding-preview/checkout?capture=1");
    const task = page.getByRole("region", { name: "Checkout content", exact: true });
    const pill = page.getByRole("region", { name: "Campaign summary sections", exact: true });
    await expect(page.getByRole("button", { name: "Subscribe to LeadReacher Pro", exact: true })).toBeEnabled();
    const heading = page.getByRole("heading", { level: 1 }).first();
    const initialHeading = await heading.boundingBox();
    const actions = page.locator(".onboarding-campaign-action-row");
    const initialActions = await actions.boundingBox();
    const paymentBounds = await page.locator('section[aria-labelledby="payment-heading"]').boundingBox();
    const orderBounds = await page.locator('aside[aria-labelledby="summary-heading"]').boundingBox();
    const summary = page.locator('aside[aria-labelledby="summary-heading"]');
    await expect(summary.getByRole("heading", { name: "Campaign setup" })).toHaveCount(0);
    await expect(summary.locator("#campaign-setup-heading")).toHaveCount(0);
    await expect(summary.getByRole("heading", { name: "Channel billing" })).toBeVisible();
    const tax = summary.getByText("Taxes calculated by Stripe at checkout.");
    const taxBounds = await tax.boundingBox();
    expect(orderBounds!.y + orderBounds!.height - taxBounds!.y - taxBounds!.height).toBeLessThanOrEqual(16);
    expect(paymentBounds!.y).toBeCloseTo(orderBounds!.y, 1);
    for (const card of [page.locator('section[aria-labelledby="payment-heading"]'), page.locator('aside[aria-labelledby="summary-heading"]')]) {
      expect(await card.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      const bounds = await card.boundingBox();
      expect(bounds!.y + bounds!.height + 12).toBeLessThanOrEqual(initialActions!.y - 28);
      await expect(card).toBeInViewport({ ratio: 0.999 });
      for (const control of await card.locator("input:visible, button:visible").all()) {
        const controlBounds = await control.boundingBox();
        expect(controlBounds!.y).toBeGreaterThanOrEqual(bounds!.y);
        expect(controlBounds!.y + controlBounds!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
        await expect(control).toBeInViewport({ ratio: 0.999 });
      }
    }
    const summaryBounds = await summary.boundingBox();
    expect(summaryBounds!.y + summaryBounds!.height + 12).toBeLessThanOrEqual(initialActions!.y - 28);
    expect(await summary.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await expect(task).toBeVisible();
    expect(await task.evaluate((element) => ({
      overflow: getComputedStyle(element).overflowY,
      gutter: (element as HTMLElement).offsetWidth - element.clientWidth,
      horizontalOverflow: element.scrollWidth > element.clientWidth,
    }))).toEqual({ overflow: "visible", gutter: 0, horizontalOverflow: false });
    await task.focus();
    await expect(task).toBeFocused();
    expect(await task.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await task.evaluate((element) => { element.scrollTop = 100; });
    expect(await task.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(pill).toBeVisible();
    expect(await pill.evaluate((element) => ({
      overflow: getComputedStyle(element).overflowY,
      gutter: (element as HTMLElement).offsetWidth - element.clientWidth,
      horizontalOverflow: element.scrollWidth > element.clientWidth,
    }))).toEqual({ overflow: "visible", gutter: 0, horizontalOverflow: false });
    await pill.focus();
    await expect(pill).toBeFocused();
    const sections = pill.locator("[data-campaign-section-id]");
    expect(await pill.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await expect(sections).toHaveCount(6);
    await expect(page.locator('.onboarding-persistent-pill [data-campaign-section-id="connections"], .onboarding-persistent-pill [data-campaign-section-id="review"], .onboarding-persistent-pill [data-campaign-section-id="live"]')).toHaveCount(0);
    await expect(sections.last()).toBeInViewport();
    const subscribe = page.getByRole("button", { name: "Subscribe to LeadReacher Pro", exact: true });
    await subscribe.focus();
    await expect(subscribe).toBeFocused();
    await expect(subscribe).toBeInViewport();
    const taskBounds = await task.boundingBox();
    expect(taskBounds!.y + taskBounds!.height).toBeLessThanOrEqual(initialActions!.y - 28);
    await page.getByRole("button", { name: "Back", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeInViewport();
    expect(await heading.boundingBox()).toEqual(initialHeading);
    expect(await actions.boundingBox()).toEqual(initialActions);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test("available onboarding scenes retain shared geometry during navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  const geometry = () => page.evaluate(() => {
    const box = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const heading = Array.from(document.querySelectorAll("h1")).find((node) => node.getBoundingClientRect().height > 0)!;
    const bounds = heading.getBoundingClientRect();
    const style = getComputedStyle(heading);
    return {
      logo: box(".onboarding-persistent-logo"),
      pill: box(".onboarding-persistent-pill"),
      actions: box(".personalized-video-style-actions, .onboarding-campaign-action-row"),
      heading: { x: bounds.x, y: bounds.y, fontSize: style.fontSize, lineHeight: style.lineHeight },
    };
  });
  await expect(page.locator(".personalized-video-style-actions")).toBeVisible();
  const initial = await geometry();
  for (const route of ["cta", "channels", "checkout", "connect-channels"]) {
    const toggle = page.getByRole("button", { name: "Preview controls" });
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await page.getByLabel("Onboarding step", { exact: true }).selectOption(route);
    await expect(page).toHaveURL(new RegExp(`/onboarding-preview/${route}`));
    if (route === "checkout") {
      await expect.poll(async () => {
        const current = await geometry();
        return { ...current, heading: { ...current.heading, fontSize: initial.heading.fontSize, lineHeight: initial.heading.lineHeight } };
      }).toEqual(initial);
      const compact = await page.locator("#payment-heading").evaluate((node) => {
        const style = getComputedStyle(node);
        return { height: node.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight), fontSize: parseFloat(style.fontSize) };
      });
      expect(compact.fontSize).toBeLessThan(parseFloat(initial.heading.fontSize));
      expect(compact.height).toBeCloseTo(compact.lineHeight, 0);
    } else {
      await expect.poll(geometry).toEqual(initial);
    }
  }
});
