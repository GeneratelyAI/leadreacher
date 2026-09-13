import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const desktopViewports = [
  { width: 1280, height: 800 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
] as const;
const viewports = [...desktopViewports, { width: 390, height: 844 }] as const;
const paragraphMessage = "Hi {{FirstName}},\n\nWe help {{Company}} start useful conversations.\n\nWould a short introduction be helpful?";
const longMessage = "Hi {{FirstName}}, we help {{Company}} connect with the right buyers through thoughtful, relevant outreach. ".repeat(10).slice(0, 1000);

function reviewCard(page: Page) {
  return page.getByRole("region", { name: "Message and call to action", exact: true });
}

async function openReview(page: Page) {
  await page.goto("/onboarding-preview/cta");
  await expect(reviewCard(page)).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("button", { name: "Edit message", exact: true })).toBeEnabled();
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: "Edit message", exact: true }).click();
  const message = page.getByRole("textbox", { name: /Campaign message/ });
  await expect(message).toBeFocused();
  await expect(reviewCard(page)).toHaveAttribute("aria-busy", "false");
  return message;
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function expectNaturalCanvas(page: Page, mobile: boolean) {
  const dimensions = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    verticalOverflow: document.documentElement.scrollHeight - innerHeight,
    nestedScroll: [...document.querySelectorAll<HTMLElement>('[aria-label="Message review content"], [aria-label="Message preview"], [aria-label="Live message preview"]')]
      .filter((element) => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1)
      .map((element) => element.getAttribute("aria-label")),
  }));
  expect(dimensions.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(dimensions.nestedScroll).toEqual([]);
  if (mobile) {
    expect(dimensions.verticalOverflow).toBeGreaterThanOrEqual(0);
    const actions = page.locator(".onboarding-campaign-action-row");
    expect(await actions.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");
    const cardBounds = await reviewCard(page).boundingBox();
    const actionBounds = await actions.boundingBox();
    expect(actionBounds!.y).toBeGreaterThanOrEqual(cardBounds!.y + cardBounds!.height);
    await actions.scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Approve and continue", exact: true })).toBeInViewport();
  } else {
    expect(dimensions.verticalOverflow).toBeLessThanOrEqual(1);
    const card = await reviewCard(page).boundingBox();
    const actions = await page.locator(".onboarding-campaign-action-row").boundingBox();
    expect(card).not.toBeNull();
    expect(actions).not.toBeNull();
    expect(card!.y + card!.height).toBeLessThanOrEqual(actions!.y - 28 + 1);
  }
}

async function expectUnclippedMessage(preview: Locator) {
  const measurement = await preview.locator('[class*="outgoingMessage"] > p').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()].filter((rect) => rect.width && rect.height);
    const box = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const ancestors: { name: string; bounds: ReturnType<typeof box> }[] = [{ name: "message bubble", bounds: box(element) }];
    let ancestor = element.parentElement;
    while (ancestor && !ancestor.matches("main")) {
      const style = getComputedStyle(ancestor);
      if (ancestor.getAttribute("role") === "region" || /hidden|clip|auto|scroll/.test(`${style.overflowX} ${style.overflowY}`)) {
        ancestors.push({ name: ancestor.getAttribute("aria-label") ?? ancestor.className, bounds: box(ancestor) });
      }
      ancestor = ancestor.parentElement;
    }
    return {
      lines: lines.map((line) => ({ left: line.left, top: line.top, right: line.right, bottom: line.bottom })),
      ancestors,
    };
  });
  expect(measurement.lines.length).toBeGreaterThan(0);
  for (const { name, bounds } of measurement.ancestors) {
    for (const line of measurement.lines) {
      expect(line.top, `message line above ${name}`).toBeGreaterThanOrEqual(bounds.top - 1);
      expect(line.bottom, `message line below ${name}`).toBeLessThanOrEqual(bounds.bottom + 1);
      expect(line.left, `message line left of ${name}`).toBeGreaterThanOrEqual(bounds.left - 1);
      expect(line.right, `message line right of ${name}`).toBeLessThanOrEqual(bounds.right + 1);
    }
  }
}

test.describe("CTA UI regressions in isolated onboarding fixtures", () => {
  for (const viewport of viewports) {
    test(`paragraphs survive editing, save, and refresh at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openReview(page);
      await (await openEditor(page)).fill(paragraphMessage);
      const bubble = page.getByRole("region", { name: "Live message preview", exact: true }).locator('[class*="outgoingMessage"] > p');
      await expect(bubble).toHaveText(paragraphMessage, { useInnerText: false });
      await expect(bubble).toHaveCSS("white-space", /pre-wrap|pre-line|break-spaces/);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.getByRole("button", { name: "Edit message", exact: true })).toBeFocused();
      const savedBubble = page.getByRole("region", { name: "Message preview", exact: true }).locator('[class*="outgoingMessage"] > p');
      await expect(savedBubble).toHaveText(paragraphMessage, { useInnerText: false });
      await expect(savedBubble).toHaveCSS("white-space", /pre-wrap|pre-line|break-spaces/);
      await page.reload();
      await expect(reviewCard(page)).toHaveAttribute("aria-busy", "false");
      await expect(savedBubble).toHaveText(paragraphMessage, { useInnerText: false });
      await expectUnclippedMessage(page.getByRole("region", { name: "Message preview", exact: true }));
      await expectNaturalCanvas(page, viewport.width === 390);
      await screenshot(page, testInfo, "paragraphs-restored");
    });

    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      test(`Cancel clears validation and restores keyboard focus at ${viewport.width}x${viewport.height}, ${reducedMotion}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion });
        const focusWarnings: string[] = [];
        const runtimeErrors: string[] = [];
        page.on("console", (message) => {
          if (/aria-hidden|retained focus|focused descendant/i.test(message.text())) focusWarnings.push(message.text());
        });
        page.on("pageerror", (error) => {
          // Next's development telemetry can be rejected by WebKit's local
          // access-control policy. Keep this assertion focused on application
          // runtime errors rather than an external reporting endpoint.
          if (!error.message.includes("sentry.io")) runtimeErrors.push(error.message);
        });
        await openReview(page);
        await openEditor(page);
        const alert = page.getByRole("region", { name: "Message review content", exact: true }).getByRole("alert");
        const destination = page.getByRole("textbox", { name: "CTA destination", exact: true });
        const original = await destination.inputValue();
        await destination.fill("not a valid URL");
        await page.getByRole("button", { name: "Save changes", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(alert).toHaveText("Enter a valid CTA destination URL.");
        await page.getByRole("button", { name: "Cancel", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("button", { name: "Edit message", exact: true })).toBeFocused();
        await expect(alert).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Approve and continue", exact: true })).toBeEnabled();
        await openEditor(page);
        await expect(destination).toHaveValue(original);
        await expect(alert).toHaveCount(0);
        expect(focusWarnings).toEqual([]);
        expect(runtimeErrors).toEqual([]);
        await screenshot(page, testInfo, "editor-reopened-without-stale-error");
      });
    }
  }

  test("mobile editor uses readable 16px inputs and natural flow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReview(page);
    const message = await openEditor(page);
    for (const field of [message, page.getByRole("textbox", { name: "CTA label", exact: true }), page.getByRole("textbox", { name: "CTA destination", exact: true })]) {
      expect(await field.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
    await message.fill(paragraphMessage);
    await expectNaturalCanvas(page, true);
    await screenshot(page, testInfo, "mobile-readable-editor");
  });

  for (const viewport of desktopViewports) {
    test(`standard campaign message preserves desktop review and editor geometry at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await openReview(page);
      const review = page.getByRole("region", { name: "Message preview", exact: true });
      const savedMessage = await review.locator('[class*="outgoingMessage"] > p').textContent();
      expect(savedMessage?.length).toBeGreaterThan(200);
      await expectUnclippedMessage(review);
      await expectNaturalCanvas(page, false);
      const originalBounds = await reviewCard(page).boundingBox();
      const message = await openEditor(page);
      await expect(message).toHaveValue(savedMessage!);
      const preview = page.getByRole("region", { name: "Live message preview", exact: true });
      await expect(preview.locator('[class*="outgoingMessage"] > p')).toHaveText(savedMessage!);
      await expectUnclippedMessage(preview);
      await expectNaturalCanvas(page, false);
      expect(await reviewCard(page).boundingBox()).toEqual(originalBounds);
      await screenshot(page, testInfo, "desktop-editor-regression");
    });
  }

  test("mobile live preview preserves all 1000 characters in natural document flow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openReview(page);
    const message = await openEditor(page);
    await message.fill(longMessage);
    await expect(message).toHaveValue(longMessage);
    await expect(reviewCard(page)).toContainText("1000 / 1000");
    const preview = page.getByRole("region", { name: "Live message preview", exact: true });
    await expect(preview.locator('[class*="outgoingMessage"] > p')).toHaveText(longMessage);
    await expectUnclippedMessage(preview);
    await expectNaturalCanvas(page, true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(0);
    await screenshot(page, testInfo, "mobile-complete-long-message");
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`Document does not become demo video and keeps metadata on Back at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto("/onboarding-preview/campaign-content");
      await page.getByRole("radio", { name: /Document/ }).click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page).toHaveURL(/\/campaign-content\/document$/);
      const filename = "cta-regression-document.pdf";
      const file = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
      await page.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: "application/pdf", buffer: file });
      const upload = page.getByRole("region", { name: "Campaign document upload", exact: true });
      await expect(upload.getByText(filename, { exact: true })).toBeVisible();
      await expect(upload.getByText("PDF · 1 KB", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: viewport.width === 390 ? "Use this document" : "Continue", exact: true }).click();
      await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
      await expect(reviewCard(page)).toHaveAttribute("aria-busy", "false");
      const preview = page.getByRole("region", { name: "Message preview", exact: true });
      await expect(preview.locator("video")).toHaveCount(0);
      await expect(preview.getByRole("button", { name: "Play campaign video", exact: true })).toHaveCount(0);
      await expect(preview.locator('img[src*="product-story"], [data-story-asset*="product-story"]')).toHaveCount(0);
      const attachment = preview.locator('[data-story-object="media"]');
      await expect(attachment).toHaveCount(1);
      const documentLink = preview.getByRole("link", { name: `Open ${filename}`, exact: true });
      if (await documentLink.count()) {
        await expect(documentLink).toHaveAttribute("href", /^(https?:|blob:|\/)/);
      } else {
        await expect(attachment).toHaveAttribute("role", "status");
        await expect(attachment).toContainText(/document|media/i);
        await expect(attachment).toContainText(/not available|processing|pending/i);
      }
      await expectNaturalCanvas(page, viewport.width === 390);
      await screenshot(page, testInfo, "document-attachment-state");
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page).toHaveURL(/\/campaign-content\/document$/);
      await expect(upload.getByText(filename, { exact: true })).toBeVisible();
      await expect(upload.getByText("PDF · 1 KB", { exact: true })).toBeVisible();
      await screenshot(page, testInfo, "document-metadata-restored");
    });
  }
});
