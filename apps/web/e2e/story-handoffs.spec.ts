import { expect, test } from "@playwright/test";
import path from "node:path";

const video = path.resolve("public/landing/product-story/personalized-video-outreach.mp4");

for (const viewport of [{ width: 1280, height: 800 }, { width: 1366, height: 900 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`editor keeps the preview identity and stable canvas at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview/cta");
    const edit = page.getByRole("button", { name: "Edit message" });
    await page.waitForFunction(() => Object.keys([...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Edit message")) ?? {}).some((key) => key.startsWith("__reactProps")));
    const card = page.getByRole("region", { name: "Message and call to action", exact: true });
    const before = await card.boundingBox();
    const preview = page.locator('[class*="composerPreview"]');
    await preview.evaluate((node) => node.setAttribute("data-instance", "retained"));
    await edit.click();
    await expect(page.getByRole("textbox", { name: "Campaign message" })).toBeFocused();
    await expect(preview).toHaveAttribute("data-instance", "retained");
    if (viewport.width > 1008) {
      expect(await card.boundingBox()).toEqual(before);
      const regions = page.locator('[aria-label="Message review content"], [class*="compactConversation"]');
      for (const region of await regions.all()) expect(await region.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
      const actions = await page.locator(".onboarding-campaign-action-row").boundingBox();
      expect(before!.y + before!.height + 12).toBeLessThanOrEqual(actions!.y - 28);
    }
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(edit).toBeFocused();
    await expect(preview).toHaveAttribute("data-instance", "retained");
    if (viewport.width > 1008) expect(await card.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test("campaign content reaches the CTA attachment without a shared-media flight", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  const source = page.locator('[data-story-object="media"]');
  await expect(source).toBeVisible();
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  const travelling = page.locator('[data-story-snapshot="media"]');
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator('[data-story-object="media"]')).toBeVisible();
  await expect(travelling).toHaveCount(0);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 1366, height: 900 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`selected style thumbnail becomes the matching CTA attachment at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview/campaign-content/personalized-video");
    const useStyle = page.getByRole("button", { name: viewport.width === 390 ? "Use this style" : "Use this", exact: true });
    await expect(useStyle).toBeEnabled({ timeout: 15_000 });
    const source = page.locator('[data-story-object="media"]');
    await expect(source).toBeVisible();
    const asset = await source.getAttribute("data-story-asset");
    await useStyle.click();
    const travelling = page.locator('[data-story-snapshot="media"]');
    await expect(page).toHaveURL(/\/cta$/);
    await expect(page.locator('[data-story-object="media"]')).toHaveAttribute("data-story-asset", asset!);
    await expect(travelling).toHaveCount(0);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/personalized-video$/);
    await expect(travelling).toHaveCount(0);
  });

  test(`uploaded media carries its identity into the DM at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("https://preview.leadreacher.ai/uploads/**", (route) => route.fulfill({ path: video, contentType: "video/mp4" }));
    await page.goto("/onboarding-preview/campaign-content/your-video");
    await page.waitForFunction(() => Object.keys(document.querySelector("input[type=file]") ?? {}).some((key) => key.startsWith("__reactProps")));
    await page.locator("input[type=file]").setInputFiles(video);
    const source = page.locator('[data-story-object="media"]');
    await expect(source).toBeVisible({ timeout: 15000 });
    await expect(source).toHaveAttribute("data-story-source", "uploaded-video");
    await expect.poll(() => source.locator("video").evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    const asset = await source.getAttribute("data-story-asset");
    const logo = await page.locator(".onboarding-persistent-logo").boundingBox();
    await page.getByRole("button", { name: /^(Continue|Use this video)$/ }).click();
    const travellingMedia = page.locator('[data-story-snapshot="media"]');
    await expect(page).toHaveURL(/\/cta$/);
    const destination = page.locator('[data-story-object="media"]');
    await expect(destination).toHaveAttribute("data-story-asset", asset!);
    await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
    await expect(destination).toBeVisible();
    await expect.poll(() => destination.locator("video").evaluate((node) => (node as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(1);
    await expect(destination.locator("canvas[data-story-visual]"), "uploaded media paints a real first-frame thumbnail").toBeVisible();
    expect(await destination.locator("canvas").evaluate((node) => (node as HTMLCanvasElement).width)).toBeGreaterThan(0);
    if (viewport.width === 1366) await page.screenshot({ path: testInfo.outputPath("uploaded-media-settled.png") });
    expect(await page.locator(".onboarding-persistent-logo").boundingBox()).toEqual(logo);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    if (viewport.width > 1008) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBe(0);
      const media = await destination.boundingBox();
      const actions = await page.locator(".onboarding-campaign-action-row").boundingBox();
      expect(media!.y + media!.height).toBeLessThanOrEqual(actions!.y - 28);
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/your-video$/);
    await expect(travellingMedia).toHaveCount(0);
  });
}

test("reduced motion bypasses visual clones and delayed access", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview/campaign-content/your-video");
  await page.waitForFunction(() => Object.keys(document.querySelector("input[type=file]") ?? {}).some((key) => key.startsWith("__reactProps")));
  await page.locator("input[type=file]").setInputFiles(video);
  await page.getByRole("button", { name: /^(Continue|Use this video)$/ }).click();
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
  expect(await page.locator('[style*="view-transition-name"]').count()).toBe(0);
  await expect(page.getByRole("button", { name: "Edit message" })).toBeEnabled();
});

test("a delayed uploaded thumbnail never creates a shared-media flight", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let releaseMedia!: () => void;
  const mediaAvailable = new Promise<void>((resolve) => { releaseMedia = resolve; });
  await page.route("https://preview.leadreacher.ai/uploads/**", async (route) => {
    await mediaAvailable;
    await route.fulfill({ path: video, contentType: "video/mp4" });
  });
  await page.goto("/onboarding-preview/campaign-content/your-video");
  await page.waitForFunction(() => Object.keys(document.querySelector("input[type=file]") ?? {}).some((key) => key.startsWith("__reactProps")));
  await page.locator("input[type=file]").setInputFiles(video);
  const source = page.locator('[data-story-object="media"]');
  await expect.poll(() => source.locator("video").evaluate((node) => (node as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: /^(Continue|Use this video)$/ }).click();
  const attachment = page.locator('[data-story-object="media"]');
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator('[data-story-snapshot="media"]')).toHaveCount(0);
  await expect(attachment).toHaveAttribute("data-story-ready", "false");
  await page.screenshot({ path: testInfo.outputPath("delayed-media-cta-arrival.png") });
  releaseMedia();
  await expect(attachment).toHaveAttribute("data-story-ready", "true", { timeout: 10_000 });
  await expect(attachment.locator("canvas[data-story-visual]")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("delayed-media-decoded.png") });
});

test("CTA Back returns to campaign content without a shared-media flight", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/personalized-video$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
});

test("same-scene query navigation leaves no snapshots or hidden provider marks", async ({ page }) => {
  await page.goto("/onboarding-preview/connect-channels");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("leadreacher:onboarding-navigate", { cancelable: true, detail: { href: "/onboarding-preview/connect-channels?selected=linkedin,gmail", replace: false } }));
  });
  await expect(page).toHaveURL(/selected=linkedin,gmail$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  expect(await page.locator('[data-story-object]').evaluateAll((nodes) => nodes.every((node) => !(node as HTMLElement).style.visibility))).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/connect-channels$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
});


test("channel marks remain static through checkout and browser history", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator('[data-story-object^="channel:"]')).toHaveCount(0);
  await expect(page.locator('[data-story-snapshot^="channel:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
  await expect(page.locator('[data-story-snapshot^="channel:"]')).toHaveCount(0);
});

test("mobile channel navigation preserves selections without brand-mark travel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding-preview/channels");
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeEnabled();
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("region", { name: "Your subscription plan" })).toBeVisible();
  const marks = page.locator('[data-story-snapshot^="channel:"]');
  await expect(marks).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(marks).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute("data-story-native", /.+/);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);

  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("region", { name: "Your subscription plan" })).toBeVisible();
  await page.getByRole("button", { name: "Subscribe (preview)", exact: true }).click();
  await expect(page).toHaveURL(/\/connect-channels$/);
  await expect(marks).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute("data-story-native", /.+/);
});

test("different destination artwork does not wait out the handoff timeout", async ({ page }) => {
  await page.goto("/onboarding-preview/campaign-content");
  test.skip(!await page.evaluate(() => "startViewTransition" in document), "Uses the supported native transition path");
  const asset = await page.locator('[data-story-object="media"]').first().getAttribute("data-story-asset");
  await page.evaluate((sourceAsset) => {
    let mismatchAt = 0;
    new MutationObserver(() => {
      if (!location.pathname.endsWith("/personalized-video")) return;
      const target = document.querySelector<HTMLElement>('[data-story-object="media"]');
      if (!mismatchAt && target && target.dataset.storyAsset !== sourceAsset) mismatchAt = performance.now();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-story-asset"] });
    new MutationObserver(() => {
      if (mismatchAt && !document.documentElement.dataset.storyNative) document.body.dataset.noMatchExitGap = String(performance.now() - mismatchAt);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-story-native"] });
  }, asset);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/personalized-video$/);
  await expect(page.locator("body")).toHaveAttribute("data-no-match-exit-gap", /\d/);
  expect(Number(await page.locator("body").getAttribute("data-no-match-exit-gap"))).toBeLessThan(200);
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
});

test("interrupted carries clean up on resize and final navigation", async ({ page }) => {
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("leadreacher:onboarding-navigate", { cancelable: true, detail: { href: "/onboarding-preview/channels", replace: false } }));
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new CustomEvent("leadreacher:onboarding-navigate", { cancelable: true, detail: { href: "/onboarding-preview/cta", replace: false } }));
  });
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
  expect(await page.locator('[style*="view-transition-name"]').count()).toBe(0);
  await expect(page.getByRole("button", { name: "Edit message" })).toBeEnabled();
});

test("resize before snapshot capture preserves the intended navigation", async ({ page }) => {
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("leadreacher:onboarding-navigate", { cancelable: true, detail: { href: "/onboarding-preview/checkout", replace: false } }));
    window.dispatchEvent(new Event("resize"));
  });
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
  await expect(page.locator('[data-story-snapshot]')).toHaveCount(0);
});

test("editor and bounded media restore focus and keep playback muted", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding-preview/cta");
  const edit = page.getByRole("button", { name: "Edit message" });
  await edit.click();
  await expect(page.getByRole("textbox", { name: "Campaign message" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(edit).toBeFocused();
  const thumbnail = page.getByRole("button", { name: "Play campaign video" });
  await thumbnail.click();
  const dialog = page.getByRole("dialog", { name: "Video preview" });
  await expect(dialog.getByRole("button", { name: "Minimize" })).toBeFocused();
  expect(await dialog.locator("video").evaluate((node) => (node as HTMLVideoElement).muted)).toBe(true);
  const bounds = await dialog.boundingBox();
  const actions = await page.locator(".onboarding-campaign-action-row").boundingBox();
  expect(bounds!.y + bounds!.height + 6).toBeLessThanOrEqual(actions!.y - 28);
  await page.keyboard.press("Escape");
  await expect(thumbnail).toBeFocused();
  await expect(thumbnail.locator("..").locator("[data-story-visual]")).toBeVisible();
});

test("changing motion preference during edit never strands controls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding-preview/cta");
  await page.waitForFunction(() => Object.keys([...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Edit message")) ?? {}).some((key) => key.startsWith("__reactProps")));
  await page.getByRole("button", { name: "Edit message" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit message" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Edit message" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Approve and continue" })).toBeEnabled();
});

test("Cancel fades inert editor controls without resizing the review card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding-preview/cta");
  await page.getByRole("button", { name: "Edit message" }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  const samples = await page.evaluate(async () => {
    const panel = document.querySelector<HTMLElement>('[class*="editorPanel"]')!;
    const card = document.querySelector<HTMLElement>('[aria-label="Message and call to action"]')!;
    const button = Array.from(panel.querySelectorAll("button")).find((node) => node.textContent === "Cancel")!;
    await Promise.allSettled(panel.getAnimations().map((animation) => animation.finished));
    button.click();
    const result: Array<{ opacity: number; inert: boolean; height: number }> = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const sample = () => {
        result.push({ opacity: Number(getComputedStyle(panel).opacity), inert: panel.inert, height: card.getBoundingClientRect().height });
        if (performance.now() - start < 350) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return result;
  });
  expect(samples.some((sample) => sample.opacity > 0 && sample.opacity < 1)).toBe(true);
  expect(samples.every((sample) => sample.inert)).toBe(true);
  expect(Math.max(...samples.map((sample) => sample.height)) - Math.min(...samples.map((sample) => sample.height))).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Edit message" })).toBeFocused();
});
