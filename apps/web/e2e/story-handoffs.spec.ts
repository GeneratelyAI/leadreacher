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

test("media handoff preserves its pixels and lands on the exact attachment frame", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  const source = page.locator('[data-story-object="media"]');
  await expect(source).toBeVisible();
  const sourceBox = await source.boundingBox();
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  const travelling = page.locator('[data-story-snapshot="media"]');
  await expect(travelling).toHaveAttribute("data-story-duration", "1400");

  await travelling.evaluate((node) => node.getAnimations().forEach((animation) => animation.pause()));
  for (const [label, progress] of [["00", 0], ["20", .2], ["50", .5], ["80", .8]] as const) {
    await travelling.evaluate((node, value) => node.getAnimations().forEach((animation) => { animation.currentTime = 1400 * value; }), progress);
    await page.screenshot({ path: testInfo.outputPath(`media-handoff-${label}.png`) });
    const frame = await travelling.boundingBox();
    const pixels = await travelling.locator("canvas").evaluate((node) => ({ width: (node as HTMLCanvasElement).width, height: (node as HTMLCanvasElement).height }));
    expect(Math.abs(pixels.width / pixels.height - sourceBox!.width / sourceBox!.height)).toBeLessThan(.01);
    expect(frame!.width).toBeGreaterThan(0);
    expect(frame!.height).toBeGreaterThan(0);
  }
  await travelling.evaluate((node) => node.getAnimations().forEach((animation) => animation.play()));

  const destination = page.locator('[data-story-object="media"]');
  const destinationBox = await destination.boundingBox();
  await expect(travelling).toHaveCount(0, { timeout: 2_500 });
  await page.screenshot({ path: testInfo.outputPath("media-handoff-100.png") });
  const visibleBox = await destination.boundingBox();
  expect(Math.abs(visibleBox!.x - destinationBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(visibleBox!.y - destinationBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(visibleBox!.width - destinationBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(visibleBox!.height - destinationBox!.height)).toBeLessThanOrEqual(1);
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
    await expect.poll(async () => await travelling.count() === 1 && await travelling.getAttribute("data-story-duration") === "1400").toBe(true);
    await expect(travelling).toHaveAttribute("data-story-asset", asset!);
    await expect(page).toHaveURL(/\/cta$/);
    await expect(page.locator('[data-story-object="media"]')).toHaveAttribute("data-story-asset", asset!);
    await expect(travelling).toHaveCount(0, { timeout: 2_500 });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(travelling).toHaveAttribute("data-story-duration", "1400");
    await expect(travelling).toHaveAttribute("data-story-asset", asset!);
    await expect(travelling).toHaveAttribute("data-story-direction", "backward");
    await expect(travelling).toHaveCount(0, { timeout: 2_500 });
  });

  test(`uploaded media carries its identity into the DM at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("https://preview.leadreacher.ai/uploads/**", (route) => route.fulfill({ path: video, contentType: "video/mp4" }));
    await page.goto("/onboarding-preview/campaign-content/your-video");
    await page.waitForFunction(() => Object.keys(document.querySelector("input[type=file]") ?? {}).some((key) => key.startsWith("__reactProps")));
    await page.locator("input[type=file]").setInputFiles(video);
    const source = page.locator('[data-story-object="media"]');
    await expect(source).toBeVisible({ timeout: 15000 });
    await expect.poll(() => source.locator("video").evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    const asset = await source.getAttribute("data-story-asset");
    const logo = await page.locator(".onboarding-persistent-logo").boundingBox();
    await page.evaluate(() => {
      const observer = new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.hasAttribute("data-story-snapshot")) {
            document.body.dataset.storyObserved = String(node.inert && node.getAttribute("aria-hidden") === "true" && !node.querySelector("video, button, [id]"));
          }
        }
      });
      observer.observe(document.body, { childList: true });
      new MutationObserver(() => {
        if (document.documentElement.dataset.storyNative === "carrying") {
          document.body.dataset.storyObserved = "true";
          document.body.dataset.storyDuration = document.documentElement.style.getPropertyValue("--onboarding-story-duration");
        }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-story-native"] });
    });
    await page.getByRole("button", { name: /^(Continue|Use this video)$/ }).click();
    const travellingMedia = page.locator('[data-story-snapshot="media"]');
    await expect.poll(async () => await travellingMedia.count() > 0 && await travellingMedia.first().getAttribute("data-story-duration") === "1400").toBe(true);
    await expect(page).toHaveURL(/\/cta$/);
    const destination = page.locator('[data-story-object="media"]');
    await expect(destination).toHaveAttribute("data-story-asset", asset!);
    await expect(page.locator("body")).toHaveAttribute("data-story-observed", "true");
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
    await expect(travellingMedia).toHaveAttribute("data-story-duration", "1400");
    await expect(travellingMedia).toHaveAttribute("data-story-asset", asset!);
    await expect(travellingMedia).toHaveCount(0, { timeout: 2_500 });
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

test("a delayed uploaded thumbnail keeps the captured frame until the attachment is painted", async ({ page }, testInfo) => {
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
  const snapshot = page.locator('[data-story-snapshot="media"]');
  await expect(snapshot).toHaveAttribute("data-story-duration", "1400");
  await expect(snapshot).toHaveAttribute("data-story-state", "holding", { timeout: 3_000 });
  await expect(snapshot).toBeVisible();
  const attachment = page.locator('[data-story-object="media"]');
  await expect(attachment).toHaveAttribute("data-story-ready", "false");
  await page.screenshot({ path: testInfo.outputPath("delayed-media-held-frame.png") });
  releaseMedia();
  await expect(attachment).toHaveAttribute("data-story-ready", "true", { timeout: 10_000 });
  await expect(snapshot).toHaveCount(0);
  await expect(attachment.locator("canvas[data-story-visual]")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("delayed-media-decoded.png") });
});

test("reverse media captures the visible poster instead of another decoded video frame", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/campaign-content/personalized-video");
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(page).toHaveURL(/\/cta$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  const attachment = page.locator('[data-story-object="media"]');
  await expect(attachment).toHaveAttribute("data-story-ready", "true");
  const poster = await attachment.locator("img[data-story-visual]").getAttribute("src");
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
      const source = args[0];
      if (source instanceof HTMLImageElement) document.body.dataset.capturedPoster = source.getAttribute("src") ?? "";
      return Reflect.apply(original, this, args);
    };
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-captured-poster", poster!);
  await expect(page.locator('[data-story-snapshot="media"]')).toHaveAttribute("data-story-direction", "backward");
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

test("channel handoff waits for delayed destination identities and restores all targets", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await page.evaluate(() => {
    const delayed = new WeakSet<Element>();
    new MutationObserver(() => {
      if (!location.pathname.endsWith("/checkout")) return;
      for (const node of document.querySelectorAll<HTMLElement>('[data-story-object^="channel:"]')) {
        if (delayed.has(node)) continue;
        delayed.add(node);
        const key = node.dataset.storyObject!;
        delete node.dataset.storyObject;
        setTimeout(() => { node.dataset.storyObject = key; }, 250);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  const travelling = page.locator('[data-story-snapshot^="channel:"]');
  await expect.poll(() => travelling.count()).toBeGreaterThan(0);
  await expect.poll(() => travelling.evaluateAll((nodes) => nodes.length > 0 && nodes.every((node) => (node as HTMLElement).dataset.storyDuration === "1400"))).toBe(true);
  await expect(travelling).toHaveCount(0, { timeout: 2_500 });
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
  expect(await page.locator('[data-story-object]').evaluateAll((nodes) => nodes.every((node) => !(node as HTMLElement).style.viewTransitionName))).toBe(true);
  await expect(page.locator('[data-story-snapshot]')).toHaveCount(0);
});

test("selected channel identities become billing rows and reverse cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  const selected = await page.locator('[data-selected="true"] [data-story-object]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-story-object")));
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  for (const key of selected) await expect(page.locator(`[data-story-object="${key}"]:visible`)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.locator("[data-story-snapshot]")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
});

test("confirmed checkout enters connection rows without channel-mark travel", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  const outlook = page.getByRole("checkbox", { name: "Outlook", exact: true });
  if (!await outlook.isChecked()) await outlook.check();
  const selected = await page.locator('[data-selected="true"] [data-story-object]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.storyObject!).sort());
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator('[data-story-snapshot]')).toHaveCount(0, { timeout: 2_500 });
  await page.getByRole("button", { name: /Subscribe/ }).click();
  const travelling = page.locator('[data-story-snapshot^="channel:"]');
  await expect(page).toHaveURL(/\/connect-channels$/);
  await expect(travelling).toHaveCount(0);
  for (const key of selected) await expect(page.locator(`[data-story-object="${key}"]`)).toBeVisible();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 1366, height: 900 }, { width: 1440, height: 900 }]) {
  test(`Checkout Back returns selected channel marks by identity at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview/channels");
    const gmail = page.getByRole("checkbox", { name: "Gmail", exact: true });
    await expect(gmail).toBeEnabled();
    if (!await gmail.isChecked()) await gmail.check();
    const outlook = page.getByRole("checkbox", { name: "Outlook", exact: true });
    if (!await outlook.isChecked()) await outlook.check();
    const instagram = page.getByRole("checkbox", { name: "Instagram", exact: true });
    if (!await instagram.isChecked()) await instagram.check();
    await page.getByRole("button", { name: "Continue to checkout" }).click();
    await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();

    const sourceMarks = page.locator('[data-story-object^="channel:"]:visible');
    await expect.poll(() => sourceMarks.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    const sourceKeys = await sourceMarks.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.storyObject!).sort());
    expect(sourceKeys).toContain("channel:linkedin");
    expect(sourceKeys).toContain("channel:gmail");
    expect(sourceKeys).toContain("channel:outlook");
    expect(sourceKeys).toContain("channel:instagram");
    expect(sourceKeys).not.toContain("channel:facebook");

    const historyLength = await page.evaluate(() => history.length);
    const back = page.getByRole("button", { name: "Back", exact: true });
    await Promise.allSettled([back.click(), back.click()]);
    await expect(page).toHaveURL(/\/channels$/);
    const travelling = page.locator('[data-story-direction="backward"]');
    await expect(travelling).toHaveCount(sourceKeys.length);
    expect(await travelling.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.storySnapshot).sort())).toEqual(sourceKeys);
    expect(await travelling.evaluateAll((nodes) => nodes.every((node) => (node as HTMLElement).dataset.storyDuration === "1400"))).toBe(true);
    for (const key of sourceKeys) {
      const channel = key.replace("channel:", "");
      await expect(page.locator(`[data-channel="${channel}"] input[type="checkbox"]`)).toBeChecked();
    }
    await expect(page.locator('[data-channel="facebook"] input[type="checkbox"]')).not.toBeChecked();
    expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
    await expect(travelling).toHaveCount(0, { timeout: 2_000 });
    await expect(page.locator('[data-story-snapshot]')).toHaveCount(0);
    expect(await page.locator('[style*="view-transition-name"]').count()).toBe(0);
  });
}

test("reduced motion returns from Checkout without channel clones", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator('[data-story-object="channel:outlook"]:visible')).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
  await expect(page.locator('[data-story-snapshot]')).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-story-native", /.+/);
});

test("Checkout reverse handoff remains stable through browser history", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/onboarding-preview/channels");
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeEnabled();
  await page.getByRole("checkbox", { name: "Outlook", exact: true }).check();
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.locator('[data-story-snapshot]')).toHaveCount(0, { timeout: 2_000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.getByRole("checkbox", { name: "Outlook", exact: true })).toBeChecked();
});

test("mobile channel navigation skips brand-mark travel and preserves selections", async ({ page }) => {
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
