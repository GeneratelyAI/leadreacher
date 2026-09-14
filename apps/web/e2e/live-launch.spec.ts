import { expect, test, type Page } from "@playwright/test";

const desktopViewports = [
  { width: 1280, height: 800 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
];

async function expectLaunchScene(page: Page) {
  const heading = page.getByRole("heading", { name: /Your campaign is live/ });
  await expect(heading).toHaveText("Your campaign is live.");
  await expect(heading.locator(".signup-campaign-period")).toHaveText(".");
  await expect(page.getByText("We’re finding your ideal prospects now and getting everything ready for outreach.", { exact: true })).toBeVisible();
  await expect(page.getByText("Your content will start reaching them shortly.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View campaign", exact: true })).toBeVisible();
  await expect(page.locator(".onboarding-persistent-pill, .onboarding-campaign-action-row")).toHaveCount(0);
}

async function gotoLive(page: Page, campaignId?: string) {
  const query = campaignId ? `?reviewCampaignId=${campaignId}` : "";
  await page.goto(`/onboarding-preview/live${query}`, { waitUntil: "domcontentloaded" });
}

for (const viewport of desktopViewports) {
  test(`campaign live fits the desktop launch scene at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      if (!error.message.includes(".ingest.us.sentry.io/")) errors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes(".ingest.us.sentry.io/")) {
        errors.push(message.text());
      }
    });
    await gotoLive(page, "preview-campaign");
    await expectLaunchScene(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`campaign-live-${viewport.width}.png`) });
    expect(errors).toEqual([]);
  });
}

test("campaign live remains within the mobile document flow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoLive(page);
  await expectLaunchScene(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("campaign-live-mobile.png"), fullPage: true });
});

test("launch motion plays once on the WebM layer, settles, and keeps the campaign destination", async ({ page }) => {
  await gotoLive(page, "preview-campaign");
  const video = page.getByTestId("live-launch-plane");
  await expect(video).toHaveAttribute("src", "/animation/paper-plane.webm");
  await expect(video).not.toHaveAttribute("loop");
  await expect(page.locator("[class*='finalPoster']")).toHaveCount(0);
  await expect(page.locator("[data-playback='settled']")).toBeVisible({ timeout: 10_000 });
  const frame = await video.evaluate((element: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(element, 0, 0);
    const background = Array.from(context.getImageData(0, 0, 1, 1).data);
    const bounds = element.getBoundingClientRect();
    return { background, ratio: bounds.width / bounds.height, ended: element.ended };
  });
  expect(frame.background.slice(0, 3).every((channel) => channel > 245)).toBe(true);
  expect(frame.ratio).toBeCloseTo(16 / 9, 2);
  expect(frame.ended).toBe(true);
  await expect.poll(() => video.evaluate((element) => getComputedStyle(element).animationName.includes("campaign-plane-idle"))).toBe(true);
  await expect(page.getByRole("link", { name: "View campaign", exact: true })).toHaveAttribute("href", "/dashboard/campaigns?reviewCampaignId=preview-campaign");
});

test("reduced motion uses the final frame without starting playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoLive(page);
  await expect(page.locator("[data-playback='settled']")).toBeVisible();
  await expect(page.getByTestId("live-launch-plane")).toHaveJSProperty("paused", true);
});
