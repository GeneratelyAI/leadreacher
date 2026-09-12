import { expect, test } from "@playwright/test";

const routes = [
  ["cta", "Your message is ready"],
  ["channels", "Choose your channels"],
  ["checkout", "Complete your subscription"],
  ["connect-channels", "Connect your channels"],
] as const;

const removedEyebrows = ["Message Review", "Choose Channels", "Checkout", "Connect Channels", "Campaign Review"];

test.describe("production-ready onboarding continuation", () => {
  test("headline periods reuse the Prospect blink and respect reduced motion", async ({ page }) => {
    for (const route of ["cta", "channels", "checkout", "connect-channels"]) {
      await page.goto(`/onboarding-preview/${route}?capture=1`);
      const period = page.getByRole("heading", { level: 1 }).first().locator(".signup-campaign-period");
      await expect(period).toHaveText(".");
      await expect(period).toHaveCSS("animation-name", "signup-campaign-period-blink");
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding-preview/cta?capture=1");
    await expect(page.getByRole("heading", { level: 1 }).first().locator(".signup-campaign-period")).toHaveCSS("animation-name", "none");
  });

  test("personalized video and CTA keep the same desktop canvas geometry", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/onboarding-preview/campaign-content/personalized-video?capture=1");
    await page.waitForTimeout(1_000);
    const before = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        if (!rect) throw new Error(`Missing ${selector}`);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
      };
      const heading = document.querySelector(".personalized-video-style-header h1");
      if (!heading) throw new Error("Missing personalized video heading");
      const computed = getComputedStyle(heading);
      return {
        logo: box(".onboarding-persistent-logo"),
        pill: box(".onboarding-persistent-pill"),
        main: box(".personalized-video-style-main"),
        heading: box(".personalized-video-style-header h1"),
        actions: box(".personalized-video-style-actions"),
        type: { fontSize: computed.fontSize, fontWeight: computed.fontWeight, lineHeight: computed.lineHeight, color: computed.color },
      };
    });

    await page.getByRole("button", { name: "Use this" }).click();
    await expect(page.getByRole("heading", { name: /Your message is ready/i })).toBeVisible();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        if (!rect) throw new Error(`Missing ${selector}`);
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
      };
      const heading = document.querySelector("[id='message-review-title']");
      if (!heading) throw new Error("Missing CTA heading");
      const computed = getComputedStyle(heading);
      return {
        logo: box(".onboarding-persistent-logo"),
        pill: box(".onboarding-persistent-pill"),
        main: box(".continuation-main"),
        heading: box("[id='message-review-title']"),
        actions: box(".onboarding-campaign-action-row"),
        type: { fontSize: computed.fontSize, fontWeight: computed.fontWeight, lineHeight: computed.lineHeight, color: computed.color },
      };
    });

    for (const key of ["logo", "pill", "main"] as const) {
      expect(Math.abs(before[key].x - after[key].x), `${key} x`).toBeLessThanOrEqual(1);
      expect(Math.abs(before[key].y - after[key].y), `${key} y`).toBeLessThanOrEqual(1);
      expect(Math.abs(before[key].width - after[key].width), `${key} width`).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(before.heading.x - after.heading.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.heading.y - after.heading.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(before.actions.bottom - after.actions.bottom)).toBeLessThanOrEqual(1);
    expect(after.type).toEqual(before.type);
  });

  for (const [route, heading] of routes) {
    for (const viewport of [{ width: 1366, height: 900 }, { width: 1280, height: 800 }]) {
      test(`${route} reserves the action safe zone at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/onboarding-preview/${route}?capture=1`);
        await expect(page.getByRole("heading", { name: new RegExp(heading, "i") }).first()).toBeVisible();
        const main = page.locator(".onboarding-scene-main");
        const actions = page.locator(".onboarding-campaign-action-row");
        await expect(main).toBeVisible();
        await expect(actions).toBeVisible();
        const bounds = await main.boundingBox();
        const actionBounds = await actions.boundingBox();
        expect(bounds).not.toBeNull();
        expect(actionBounds).not.toBeNull();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(actionBounds!.y - 28);
        const content = page.locator(".onboarding-scene-task-scroll");
        expect(await content.evaluate((element) => getComputedStyle(element).overflowY)).toBe("visible");
        const headingBeforeScroll = await page.getByRole("heading", { level: 1 }).first().boundingBox();
        await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        expect(await content.evaluate((element) => element.scrollTop)).toBe(0);
        expect(await page.getByRole("heading", { level: 1 }).first().boundingBox()).toEqual(headingBeforeScroll);
        await expect(page.locator(".onboarding-persistent-logo")).toHaveCount(1);
        await expect(page.locator(".onboarding-persistent-pill")).toHaveCount(1);
      });
    }
    test(`${route} renders in the shared campaign canvas`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/onboarding-preview/${route}?capture=1`);
      await expect(page.locator(".onboarding-persistent-logo")).toBeVisible();
      await expect(page.locator(".onboarding-persistent-pill")).toBeVisible();
      for (const eyebrow of removedEyebrows) await expect(page.getByText(eyebrow, { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: new RegExp(heading, "i") }).first()).toBeVisible();
    });
  }

  test("approved content continues to the named CTA route", async ({ page }) => {
    await page.goto("/onboarding-preview/campaign-content/personalized-video?capture=1");
    await expect(page.locator(".personalized-video-style-page")).toBeVisible();
    await page.getByRole("button", { name: "Use this" }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/cta/);
    await expect(page.getByRole("heading", { name: /Your message is ready/i })).toBeVisible();
  });

  test("channel selections update the persistent pill immediately", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/onboarding-preview/channels?capture=1");
    const channels = page.locator('.onboarding-persistent-pill [data-campaign-section-id="channels"]');
    const whatsappMarks = page.locator('.onboarding-persistent-pill [data-campaign-section-id="channels"] [role="listitem"][aria-label="WhatsApp"]');
    await expect(channels).toBeVisible();
    const whatsapp = page.getByRole("checkbox", { name: "WhatsApp", exact: true });
    await expect(whatsapp).not.toBeChecked();
    await expect(whatsappMarks).toHaveCount(0);
    await whatsapp.check();
    await expect(whatsapp).toBeChecked();
    await expect.poll(() => whatsappMarks.count()).toBeGreaterThan(0);
    await whatsapp.uncheck();
    await expect(whatsapp).not.toBeChecked();
    await expect(whatsappMarks).toHaveCount(0);
  });

  test("desktop review preserves the canvas, six summary stages, and navigation clearance", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding-preview?screen=16&review=true");
    await expect(page.getByRole("heading", { name: /^Ready for your review\s*\.$/ })).toBeFocused();
    const pill = page.locator(".onboarding-persistent-pill");
    await expect(pill).toHaveCount(1);
    const rows = pill.locator("[data-campaign-section-id]");
    await expect(rows).toHaveCount(6);
    await expect(page.locator('.onboarding-persistent-pill [data-campaign-section-id="connections"], .onboarding-persistent-pill [data-campaign-section-id="review"], .onboarding-persistent-pill [data-campaign-section-id="live"]')).toHaveCount(0);
    const pillBounds = await pill.boundingBox();
    const lastSectionBounds = await rows.last().boundingBox();
    expect(lastSectionBounds!.y + lastSectionBounds!.height).toBeLessThan(pillBounds!.y + pillBounds!.height);
    const content = page.getByRole("region", { name: "Campaign review content" });
    const actions = page.locator(".onboarding-campaign-action-row");
    const contentBounds = await content.boundingBox();
    const actionBounds = await actions.boundingBox();
    expect(contentBounds!.y + contentBounds!.height).toBeLessThanOrEqual(actionBounds!.y - 28);
    await content.focus();
    await page.keyboard.press("End");
    await expect(page.getByRole("heading", { name: /^Ready for your review\s*\.$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open campaign draft" })).toBeEnabled();
  });

  test("message editing restores keyboard focus and preserves the review card", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding-preview/cta?capture=1");
    const edit = page.getByRole("button", { name: "Edit message" });
    const approve = page.getByRole("button", { name: "Approve and continue" });
    const card = page.getByRole("region", { name: "Message and call to action", exact: true });
    await expect(card).toHaveAttribute("aria-busy", "false");
    const originalMessage = await card.locator("p").first().textContent();
    await edit.click();
    await expect(page.getByRole("textbox", { name: "Campaign message" })).toBeFocused();
    await expect(approve).toBeDisabled();
    await page.getByRole("textbox", { name: "Campaign message" }).fill("Unsaved changes");
    await expect(page.getByRole("region", { name: "Live message preview", exact: true })).toContainText("Unsaved changes");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(edit).toBeFocused();
    await expect(card).toContainText(originalMessage!);
    await expect(card).not.toContainText("Unsaved changes");
    await expect(approve).toBeEnabled();
    const content = page.getByRole("region", { name: "Message review content", exact: true });
    await content.focus();
    await page.keyboard.press("End");
    const footer = card.locator("footer");
    await expect(footer).toContainText("Personalization: {{FirstName}} · {{Company}}");
    await expect(footer).toBeInViewport();
    const footerBounds = await footer.boundingBox();
    const actionBounds = await page.locator(".onboarding-campaign-action-row").boundingBox();
    expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(actionBounds!.y - 28);
  });

  test("CTA review and live editor stay inside the desktop canvas", async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1366, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/onboarding-preview/cta?capture=1");
      const card = page.getByRole("region", { name: "Message and call to action", exact: true });
      const conversation = page.getByRole("region", { name: "Message preview", exact: true });
      const actions = page.locator(".onboarding-campaign-action-row");
      await expect(conversation).toContainText("Direct message preview");
      await expect(conversation.locator('[class*="outgoingMessage"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBe(0);

      await page.getByRole("button", { name: "Edit message" }).click();
      const message = page.getByRole("textbox", { name: "Campaign message" });
      const editor = page.getByTestId("message-editor-workspace");
      await expect(message).toBeFocused();
      await message.fill("A live direct message update for {{Company}}.");
      await page.getByRole("textbox", { name: "CTA label" }).fill("Book a quick call");
      await page.getByRole("textbox", { name: "CTA destination" }).fill("https://example.com/demo");
      const livePreview = page.getByRole("region", { name: "Live message preview", exact: true });
      await expect(livePreview).toContainText("A live direct message update for {{Company}}.");
      await expect(livePreview.getByRole("link", { name: /Book a quick call/ })).toBeVisible();
      await expect(card).toContainText("45 / 1000");
      const duration = await editor.evaluate((element) => parseFloat(getComputedStyle(element).animationDuration) * 1000);
      expect(duration).toBeGreaterThanOrEqual(180);
      expect(duration).toBeLessThanOrEqual(280);
      const cardBounds = await card.boundingBox();
      const actionBounds = await actions.boundingBox();
      expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(actionBounds!.y - 28);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBe(0);
    }
  });

  test("CTA editor removes movement for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/onboarding-preview/cta?capture=1");
    await page.getByRole("button", { name: "Edit message" }).click();
    await expect(page.getByTestId("message-editor-workspace")).toHaveCSS("animation-name", "none");
    await expect(page.getByRole("textbox", { name: "Campaign message" })).toBeFocused();
  });

  test("CTA editor stacks naturally on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding-preview/cta?capture=1");
    await page.getByRole("button", { name: "Edit message" }).click();
    const editor = page.getByTestId("message-editor-workspace");
    const panels = editor.locator(":scope > div");
    const editorPanel = await panels.nth(0).boundingBox();
    const previewPanel = await panels.nth(1).boundingBox();
    expect(previewPanel!.y).toBeGreaterThan(editorPanel!.y + editorPanel!.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("CTA and channel selection use named route navigation", async ({ page }) => {
    await page.goto("/onboarding-preview/cta?capture=1");
    await page.getByRole("button", { name: "Approve and continue" }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/channels/);
    await page.getByRole("button", { name: /Continue to checkout/ }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/checkout/);
  });

  test("mobile continuation stays usable at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["cta", "channels", "checkout", "connect-channels"]) {
      await page.goto(`/onboarding-preview/${route}?capture=1`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
  });

  test("preview exposes no retired live or dashboard continuation", async ({ page, request }) => {
    const response = await request.get("/onboarding-preview/live");
    expect(response.status()).toBe(404);
    await page.goto("/onboarding-preview");
    await expect(page.getByRole("option", { name: /Live|Dashboard/ })).toHaveCount(0);
  });
});
