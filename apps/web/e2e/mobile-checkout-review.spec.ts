import { expect, test, type Page } from "@playwright/test";

async function scrollToAction(page: Page, name: string) {
  const action = page.getByRole("button", { name, exact: true });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bounds = await action.boundingBox();
    const viewport = page.viewportSize();
    if (
      bounds &&
      viewport &&
      bounds.y >= 0 &&
      bounds.y + bounds.height < viewport.height - 8
    )
      return action;
    // Mobile WebKit cannot dispatch wheel or swipe input through Playwright.
    // PageDown still verifies user-driven document scrolling, not locator scrolling.
    if (page.context().browser()?.browserType().name() === "webkit") {
      await page.keyboard.press("PageDown");
    } else {
      await page.mouse.wheel(0, 350);
    }
    await page.waitForTimeout(60);
  }
  const bounds = await action.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? Infinity) + (bounds?.height ?? 0)).toBeLessThan(
    page.viewportSize()!.height,
  );
  return action;
}

test.describe("mobile checkout and final saved review", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("uses clearly identified sample checkout and verifies before continuing", async ({
    page,
  }) => {
    const productionRequests: string[] = [];
    page.on("request", (request) => {
      if (
        /stripe\.com|\/api\/billing|\/billing\/checkout-session/.test(
          request.url(),
        )
      )
        productionRequests.push(request.url());
    });
    await page.goto("/onboarding-preview?screen=13&step=checkout");
    await expect(
      page.getByRole("heading", { name: "Your campaign starts here." }),
    ).toBeVisible();
    await expect(
      page.getByText("Illustrative pricing", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Sample card number, preview only" }),
    ).toHaveAttribute("readonly", "");
    const subscribe = await scrollToAction(page, "Subscribe (preview)");
    await subscribe.click();
    await expect(
      page.getByRole("heading", { name: "Connect your channels." }),
    ).toBeVisible();
    expect(productionRequests).toEqual([]);
  });

  test("keeps channel restrictions, saved connections, review history and completion safe", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=14&step=channels");
    await expect(page.locator("[data-channel]")).toHaveCount(6);
    const whatsapp = page.locator('[data-channel="whatsapp"]');
    await expect(
      whatsapp.getByText("Not in plan", { exact: true }),
    ).toBeVisible();
    await expect(
      whatsapp.getByRole("button", { name: "Connect", exact: true }),
    ).toHaveCount(0);
    await page
      .locator('[data-channel="gmail"]')
      .getByRole("button", { name: "Connect", exact: true })
      .click();
    await expect(
      page
        .locator('[data-channel="gmail"]')
        .getByRole("button", { name: "Gmail connected. Add another account" }),
    ).toBeVisible();

    const review = await scrollToAction(page, "Review campaign");
    await review.click();
    await expect(page).toHaveURL(/review=true/);
    await expect(
      page.getByRole("heading", { name: "Ready for your review." }),
    ).toBeFocused();
    await expect(
      page.getByText("LinkedIn · Email", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Your campaign is saved.", { exact: true }),
    ).toHaveCount(0);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Connect your channels." }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: "Ready for your review." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("LinkedIn · Email", { exact: true }),
    ).toBeVisible();

    const complete = await scrollToAction(page, "Open campaign draft");
    await complete.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(page).toHaveURL(/completed=preview-campaign/);
    await expect(
      page.getByRole("heading", { name: "Your draft is ready." }),
    ).toBeVisible();
    await expect(page.getByText(/No campaign was launched/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open campaign draft", exact: true }),
    ).toHaveCount(0);
  });

  test("review Edit links return to the real saved decision steps", async ({
    page,
  }) => {
    for (const [label, destination] of [
      ["Edit audience", "discovery"],
      ["Edit content", "campaign-content"],
      ["Edit style", "personalized-video-style"],
      ["Edit channel", "channels"],
    ]) {
      await page.goto(
        "/onboarding-preview?screen=16&step=channels&review=true",
      );
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`step=${destination}(?:&|$)`));
      await expect
        .poll(() => new URL(page.url()).searchParams.get("review"))
        .toBeNull();
    }
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 375, height: 667 },
    { width: 414, height: 896 },
    { width: 390, height: 500 },
    { width: 844, height: 390 },
    { width: 834, height: 1194 },
  ]) {
    test(`keeps actions reachable through document scrolling at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      for (const [query, actionName] of [
        ["screen=13&step=checkout", "Subscribe (preview)"],
        ["screen=14&step=channels", "Review campaign"],
        ["screen=16&step=channels&review=true", "Open campaign draft"],
      ]) {
        await page.goto(`/onboarding-preview?${query}`);
        await expect(
          page.getByRole("button", { name: actionName, exact: true }),
        ).toBeEnabled();
        const initialScroll = await page.evaluate(() => window.scrollY);
        expect(initialScroll).toBe(0);
        await scrollToAction(page, actionName);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);
        expect(
          await page.evaluate(
            () =>
              document.querySelector(".onboarding-viewport-fit")?.scrollTop ??
              0,
          ),
        ).toBe(0);
      }
    });
  }

  test("preserves the existing desktop checkout and channel composition", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/onboarding-preview?step=checkout");
    await expect(
      page.getByRole("heading", {
        name: "Complete your subscription",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Your campaign starts here.",
        exact: true,
      }),
    ).toHaveCount(0);
    const payment = await page
      .locator('section[aria-labelledby="payment-heading"]')
      .boundingBox();
    const summary = await page
      .locator('aside[aria-labelledby="summary-heading"]')
      .boundingBox();
    expect(
      payment && summary && summary.x >= payment.x + payment.width,
    ).toBeTruthy();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(1440);
    await page.goto("/onboarding-preview?step=channels");
    await expect(
      page.getByRole("heading", { name: "Connect your channels", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Finish setup and review",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review campaign", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(1440);
  });
});
