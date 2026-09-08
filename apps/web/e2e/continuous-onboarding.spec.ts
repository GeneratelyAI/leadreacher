import { expect, test } from "@playwright/test";

test("every onboarding scene keeps one stable campaign canvas on direct load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator(".onboarding-persistent-logo")).toHaveCount(1);
    await expect(page.locator(".onboarding-persistent-pill .campaign-pill")).toHaveCount(1);
    await expect(page.locator(".onboarding-step-presence")).toHaveCount(1);
    await expect(page.locator(".onboarding-step-presence")).toHaveAttribute("data-scene-phase", "idle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("Document content continues into its dedicated upload scene", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=campaign-content");

  await page.getByRole("radio", { name: /^Document/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.locator(".upload-document-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Add your document\s*\.$/ })).toBeVisible();
  await expect(page.getByText("PDF, PowerPoint, or Word. Up to 25 MB.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();

  await page.locator(".upload-document-page input[type=file]").setInputFiles({
    name: "campaign-brief.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("campaign brief"),
  });
  await expect(page.getByText("campaign-brief.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 640, height: 900 });
  await expect(page.locator(".upload-document-drop-zone")).toBeVisible();
  await expect(page.getByRole("button", { name: "Browse files", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("signup keeps its campaign entry composition stable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/signup");
  await expect(page.getByTestId("signup-campaign-auth")).toBeVisible();
  await expect(page.locator(".campaign-pill")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("content approval preserves the canvas, summary and browser history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=campaign-content");
  const pill = page.locator(".onboarding-persistent-pill .campaign-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("Business");
  await pill.evaluate((node) => node.setAttribute("data-instance", "persistent"));
  const bounds = await pill.boundingBox();
  await page.getByRole("button", { name: "Collapse your campaign" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".personalized-video-style-page")).toBeVisible();
  await expect(page.locator(".onboarding-step-presence")).toHaveAttribute("data-scene-phase", "idle");
  await expect(page.getByRole("button", { name: "Expand your campaign" })).toBeVisible();
  await expect(pill).toHaveAttribute("data-instance", "persistent");
  expect(await pill.boundingBox()).toEqual(bounds);
  await page.getByRole("button", { name: "Expand your campaign" }).click();
  const previousSummary = await pill.textContent();
  const casual = page.getByRole("radio", { name: /^Casual/ });
  await expect(casual).toBeEnabled();
  await casual.focus();
  await page.keyboard.press("Space");
  await expect(casual).toHaveAttribute("aria-checked", "true");
  expect(await pill.textContent()).toEqual(previousSummary);
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(page).toHaveURL(/step=checkout/);
  await expect(pill).toHaveAttribute("data-instance", "persistent");
  await expect(pill).toContainText("Personalized video · Casual");
  await page.goBack();
  await expect(page.locator(".personalized-video-style-page")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Casual/ })).toHaveAttribute("aria-checked", "true");
  expect(await page.locator(".campaign-pill").count()).toBe(1);
});

test("reduced motion keeps content ready and the canvas stationary", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/onboarding-preview?step=personalized-video-style");
  const card = page.getByRole("radio", { name: /^Professional/ });
  await expect(card).toBeEnabled();
  expect(await card.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".onboarding-step-presence__pane")).toHaveCount(1);
});

test("video-style preview keeps samples exclusive to the preview route", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=personalized-video-style");

  const arts = page.locator(".personalized-video-style-art");
  await expect(arts).toHaveCount(3);
  expect(await arts.evaluateAll((nodes) => nodes.every((node) => node.dataset.previewKind === "sample"))).toBe(true);
  await expect(arts.locator("img")).toHaveCount(3);
  await expect(arts.locator("video")).toHaveCount(0);
  await expect(page.locator(".personalized-video-style-art-placeholder")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("the Document card keeps its local PDF SVG crisp at desktop and narrow widths", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 640, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding-preview?step=campaign-content");

    const pdf = page.locator("img.campaign-content-option-illustration");
    await expect(pdf).toHaveAttribute("src", "/onboarding/campaign-content-pdf.svg");
    const rendering = await pdf.evaluate((node) => {
      const styles = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        filter: styles.filter,
        objectFit: styles.objectFit,
        transform: styles.transform,
      };
    });
    expect(rendering.width).toBe(96);
    expect(rendering.height).toBe(80);
    expect(rendering.objectFit).toBe("contain");
    expect(rendering.filter).toBe("none");
    expect(rendering.transform).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("live campaign pill completes only persisted approvals across the revised flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  const pill = page.locator(".onboarding-persistent-pill .campaign-pill");
  await expect(pill.locator(".campaign-pill-section")).toHaveCount(4);
  const prospects = pill.locator("[data-campaign-section-id='targeting']");
  await expect(prospects).toContainText("Prospects");
  await expect(prospects).toHaveClass(/campaign-pill-section-future/);
  await expect(pill.locator(".campaign-pill-pending-lines")).toHaveCount(0);
  const before = await pill.boundingBox();
  await pill.evaluate((node) => node.setAttribute("data-persistence-check", "retained"));
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await expect(prospects).toHaveClass(/campaign-pill-section-future/);
  await expect(page.getByRole("heading", { name: /Your prospects/, level: 1 })).toBeFocused();
  await page.waitForTimeout(600);
  expect(await pill.boundingBox()).toEqual(before);
  await expect(pill).toHaveAttribute("data-persistence-check", "retained");
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(0);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/step=campaign-content/);
  await expect(prospects).not.toHaveClass(/campaign-pill-section-future/);
  await expect(prospects).toContainText("Founder");
  const content = pill.locator("[data-campaign-section-id='content']");
  await expect(content).toHaveClass(/campaign-pill-section-future/);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/step=personalized-video-style/);
  await expect(content).toHaveClass(/campaign-pill-section-future/);
  await page.getByRole("button", { name: "Use this", exact: true }).click();
  await expect(page).toHaveURL(/step=checkout/);
  await expect(content).not.toHaveClass(/campaign-pill-section-future/);
  await expect(content).toContainText("Professional");
  await page.reload();
  await expect(content).toContainText("Professional");
  await expect(pill.locator(".campaign-pill-site-url")).toHaveText("acme.example");
});

test("reduced motion renders quiet unselected sections without fake loading", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  await expect(page.locator(".campaign-pill-pending-lines")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(0);
  await expect(page.locator(".onboarding-audience-formation")).toHaveCount(0);
});

test("How It Works tells its SVG story once while copy and circles stay still", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  const sequence = page.locator(".how-it-works-sequence");
  await expect.poll(() => sequence.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  const circles = await page.locator(".how-it-works-illustration").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  expect(await sequence.locator("p").evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).opacity === "1" && getComputedStyle(node).transform === "none"))).toBe(true);
  await expect(page.getByRole("button", { name: "Continue to prospects", exact: true })).toBeEnabled();
  await expect.poll(() => sequence.evaluate((node) => node.getAnimations({ subtree: true }).length), { timeout: 5000 }).toBe(0);
  expect(await page.locator(".how-it-works-illustration").evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))).toEqual(circles);
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await page.goBack();
  await expect(page).toHaveURL(/substep=how-it-works/);
  expect(await sequence.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
});

test("How It Works waits for mobile visibility and skips the story with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  const sequence = page.locator(".how-it-works-sequence");
  await page.mouse.move(180, 350);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => sequence.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => sequence.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.locator("[data-story-part]").evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).opacity === "1"))).toBe(true);
});

test("leaving during the story transfers the current SVG frame to Prospects", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  await expect.poll(() => page.locator(".how-it-works-sequence").evaluate((node) => node.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(4);
  await expect(page.locator(".onboarding-audience-bridge [data-story-part='reply']")).toHaveAttribute("style", /opacity:/);
  await expect(page.locator(".onboarding-audience-bridge, .onboarding-audience-formation")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Your prospects/ })).toBeFocused();
});

test("audience formation reaches all categories and cleans up on interruption", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  const pill = page.locator(".campaign-pill");
  const bounds = await pill.boundingBox();
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  const layers = page.locator(".onboarding-audience-formation");
  await expect(layers).toHaveCount(4);
  const explanation = page.locator(".onboarding-explanation-snapshot");
  expect(await explanation.evaluate((node) => node.getAnimations().length)).toBe(0);
  expect(await explanation.locator("[data-explanation-step] > p").evaluateAll((nodes) => nodes.map((node) => node.getAnimations()[0].effect?.getTiming().delay))).toEqual([40, 85, 130, 175]);
  const sources = page.locator(".onboarding-audience-bridge");
  await expect(sources).toHaveCount(4);
  expect(await sources.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.formationCategory))).toEqual(["decisionMakers", "companyTypes", "industries", "locations"]);
  expect(await sources.evaluateAll((nodes) => nodes.map((node) => node.getAnimations()[0].effect?.getTiming().delay))).toEqual([0, 75, 150, 225]);
  // Formation overlaps the landing, rather than starting after a dead hold.
  expect(await sources.evaluateAll((nodes) => nodes.every((node) => node.getAnimations()[0].effect?.getTiming().duration === 1120))).toBe(true);
  expect(await layers.evaluateAll((nodes) => nodes.map((node) => node.getAnimations()[0].effect?.getTiming().delay))).toEqual([820, 895, 970, 1045]);
  expect(await layers.evaluateAll((nodes) => nodes.every((node) => {
    const frames = (node.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    return frames.every((frame) => !frame.transform) && frames.some((frame) => String(frame.clipPath).includes("inset("));
  }))).toBe(true);
  expect(await layers.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.formationCategory))).toEqual(["decisionMakers", "companyTypes", "industries", "locations"]);
  expect(await layers.evaluateAll((nodes) => nodes.every((node) => node.getAttribute("aria-hidden") === "true" && (node as HTMLElement).inert && getComputedStyle(node).pointerEvents === "none"))).toBe(true);
  // Use browser history while the artwork is still forming, without waiting
  // for decorative animation to make the live task usable.
  await page.goBack();
  await expect(page).toHaveURL(/substep=how-it-works/);
  await expect(page.locator(".onboarding-audience-formation, .onboarding-audience-bridge, .onboarding-explanation-snapshot")).toHaveCount(0);
  expect(await pill.boundingBox()).toEqual(bounds);
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(layers).toHaveCount(4);
  await expect(layers).toHaveCount(0);
  expect(await pill.boundingBox()).toEqual(bounds);
});

test("Discovery Back returns row surfaces to the explanation without moving the pill", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=strategy&substep=how-it-works");
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await expect(page.locator(".onboarding-audience-bridge")).toHaveCount(0);
  const pill = await page.locator(".campaign-pill").boundingBox();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/substep=how-it-works/);
  await expect(page.locator("[data-returning-category]")).toHaveCount(4);
  expect(await page.locator(".how-it-works-illustration").evaluateAll((nodes) => nodes.map((node) => node.getAnimations()[0].effect?.getTiming().delay))).toEqual([385, 310, 235, 160]);
  expect(await page.locator(".how-it-works-illustration").evaluateAll((nodes) => nodes.every((node) => node.getAnimations()[0].effect?.getTiming().duration === 1120))).toBe(true);
  await expect(page.getByRole("button", { name: "Continue to prospects", exact: true })).toBeEnabled();
  await expect(page.locator("[data-returning-category]")).toHaveCount(0);
  expect(await page.locator(".campaign-pill").boundingBox()).toEqual(pill);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/substep=how-it-works/);
  await expect(page.locator("[data-returning-category]")).toHaveCount(0);
  expect(await page.locator(".how-it-works-illustration").evaluateAll((nodes) => nodes.every((node) => node.getAnimations().length === 0))).toBe(true);
});

test("audience drafts survive introduction, history, and refresh without approval", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding-preview?step=discovery");
  await page.getByLabel("Did we miss anything?").fill("CEO");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("CEO added to Decision makers.", { exact: true })).toBeAttached();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Continue to prospects", exact: true }).click();
  await expect(page).toHaveURL(/step=discovery/);
  await page.goBack();
  await expect(page).toHaveURL(/substep=how-it-works/);
  await page.goForward();
  await expect(page).toHaveURL(/step=discovery/);
  await page.reload();
  const overflow = page.getByRole("button", { name: /Show \d+ more decision makers/ });
  await expect(overflow).toBeVisible();
  await overflow.click();
  const restoredChip = page.getByRole("button", { name: "Remove CEO from Decision makers", exact: true });
  await restoredChip.focus();
  await expect(restoredChip).toBeVisible();
  await expect(page.locator("[data-campaign-section-id='targeting']")).toHaveClass(/campaign-pill-section-future/);
  await expect(page.locator(".onboarding-audience-bridge, .onboarding-explanation-snapshot")).toHaveCount(0);
});

test("reduced motion updates the Discovery selector and action row immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=discovery");

  const action = page.locator(".onboarding-campaign-actions");
  const pill = page.locator(".signup-campaign-pill");
  await expect(action).toBeVisible();
  await expect(pill).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const actionRow = document.querySelector<HTMLElement>(".onboarding-campaign-actions");
    const pill = document.querySelector<HTMLElement>(".signup-campaign-pill");
    if (!actionRow || !pill) throw new Error("Discovery action layout is incomplete");
    return actionRow.getBoundingClientRect().bottom - pill.getBoundingClientRect().bottom;
  })).toBeCloseTo(0, 1);
  const actionTop = await action.evaluate((node) => node.getBoundingClientRect().top);
  const input = page.getByLabel("Did we miss anything?");
  await input.fill("Aurora");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const selector = page.locator(".discovery-detail-selector");
  await expect(selector).toHaveAttribute("data-ready", "true");
  const motion = await page.evaluate((initialActionTop) => {
    const fallback = document.querySelector<HTMLElement>(".discovery-detail-fallback");
    const actionRow = document.querySelector<HTMLElement>(".onboarding-campaign-actions");
    const selectorNode = document.querySelector<HTMLElement>(".discovery-detail-selector");
    if (!fallback || !actionRow || !selectorNode) throw new Error("Discovery selector motion is incomplete");
    return {
      actionShift: actionRow.getBoundingClientRect().top - initialActionTop,
      actionTransition: getComputedStyle(actionRow).transitionDuration,
      fallbackTransition: getComputedStyle(fallback).transitionDuration,
      selectorHeight: selectorNode.getBoundingClientRect().height,
    };
  }, actionTop);
  expect(motion.actionShift).toBeCloseTo(motion.selectorHeight, 1);
  expect(motion.actionTransition).toBe("0s");
  expect(motion.fallbackTransition).toBe("0s");

  await selector.getByRole("button", { name: "Location" }).click();
  expect(await action.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(actionTop, 1);
});

test("campaign pill collapse reverses the completed-section reveal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding-preview?step=campaign-content");

  const pill = page.locator(".onboarding-persistent-pill .campaign-pill");
  const body = pill.locator(".campaign-pill-body");
  const sections = pill.locator(".campaign-pill-section");
  const toggle = pill.locator(".campaign-pill-toggle");
  await expect(sections).toHaveCount(4);
  await page.waitForTimeout(500);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(180);

  const closing = await body.evaluate((node) => ({
    transitionDuration: getComputedStyle(node).transitionDuration,
    transitionTiming: getComputedStyle(node).transitionTimingFunction,
  }));
  expect(closing.transitionDuration).toContain("0.46s");
  expect(closing.transitionTiming).toContain("cubic-bezier(0.16, 1, 0.3, 1)");

  const reverseDelays = await sections.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transitionDelay));
  expect(reverseDelays[0]).toBe("0.144s");
  expect(reverseDelays[1]).toBe("0.096s");
  expect(reverseDelays[2]).toBe("0.048s");
  expect(reverseDelays[3]).toMatch(/^0s/);

  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Expand your campaign" })).toBeVisible();
});

test("discovery keeps crowded prospect chips on one line and exposes overflow in a popover", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=discovery");

  const input = page.getByLabel("Did we miss anything?");
  await input.fill("Chief Financial Officer; Chief Revenue Officer; Chief Operations Officer; Vice President of Marketing; Director of Sales; Head of Demand Generation; Sales Manager; Chief Strategy Officer");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const overflow = page.getByRole("button", { name: /Show \d+ more decision makers/ });
  await expect(overflow).toBeVisible();

  const layout = await page.evaluate(() => {
    const values = document.querySelector<HTMLElement>("[data-prospect-row='decisionMakers'] .onboarding-campaign-profile-values");
    const action = document.querySelector<HTMLElement>(".onboarding-campaign-actions");
    const entry = document.querySelector<HTMLElement>(".discovery-detail-entry");
    const pill = document.querySelector<HTMLElement>(".signup-campaign-pill");
    if (!values || !action || !entry || !pill) throw new Error("Discovery layout is incomplete");
    return {
      action: action.getBoundingClientRect(),
      entry: entry.getBoundingClientRect(),
      pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth,
      pill: pill.getBoundingClientRect(),
      row: values.closest("[data-prospect-row]")?.getBoundingClientRect(),
      valueHeight: values.getBoundingClientRect().height,
    };
  });
  expect(layout.row?.height).toBeGreaterThanOrEqual(layout.valueHeight);
  expect(layout.row?.height).toBeLessThanOrEqual(72);
  expect(layout.action.left).toBeCloseTo(layout.entry.left, 1);
  expect(layout.action.width).toBeCloseTo(layout.entry.width, 1);
  expect(layout.action.top - layout.entry.bottom).toBeCloseTo(24, 1);
  expect(layout.action.bottom).toBeCloseTo(layout.pill.bottom, 1);
  expect(layout.pageHeight).toBeLessThanOrEqual(720);
  expect(layout.pageWidth).toBeLessThanOrEqual(1280);

  const overflowCount = Number((await overflow.textContent())?.match(/\d+/)?.[0]);
  const rail = page.locator("[data-prospect-row='decisionMakers'] .onboarding-campaign-profile-rail");
  const visibleChip = rail.locator(".onboarding-campaign-chip").first();
  const beforeHover = await rail.evaluate((node) => node.getBoundingClientRect());
  await visibleChip.hover();
  await expect(visibleChip.locator(".onboarding-campaign-chip-remove")).toBeVisible();
  await expect.poll(async () => Number((await overflow.textContent())?.match(/\d+/)?.[0])).toBe(overflowCount);
  const afterHover = await rail.evaluate((node) => node.getBoundingClientRect());
  expect(afterHover.height).toBeCloseTo(beforeHover.height, 1);

  await input.fill("Digital marketing manager");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".discovery-detail-traveler", { hasText: "Digital marketing manager" })).toBeVisible();
  await expect.poll(async () => Number((await overflow.textContent())?.match(/\d+/)?.[0])).toBeGreaterThan(overflowCount);

  await overflow.focus();
  const popover = page.getByRole("dialog", { name: "Decision makers selections" });
  await expect(popover).toBeVisible();
  await expect(popover.getByText(/selected/)).toBeVisible();
  const hiddenChip = popover.locator(".onboarding-campaign-chip", { hasText: "Chief Strategy Officer" });
  await hiddenChip.locator(".onboarding-campaign-chip-remove").focus();
  await expect(hiddenChip.locator(".onboarding-campaign-chip-remove")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);

  await input.fill("Love");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const selector = page.locator(".discovery-detail-selector");
  await expect(selector).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const selectorBoundary = document.querySelector<HTMLElement>(".discovery-detail-selector");
    const action = document.querySelector<HTMLElement>(".onboarding-campaign-actions");
    if (!selectorBoundary || !action) throw new Error("Discovery selector layout is incomplete");
    return action.getBoundingClientRect().top - selectorBoundary.getBoundingClientRect().bottom;
  })).toBeCloseTo(24, 1);
  const selectorLayout = await page.evaluate((actionTopBeforeSelector) => {
    const selectorBoundary = document.querySelector<HTMLElement>(".discovery-detail-selector");
    const action = document.querySelector<HTMLElement>(".onboarding-campaign-actions");
    if (!selectorBoundary || !action) throw new Error("Discovery selector layout is incomplete");
    return {
      actionShift: action.getBoundingClientRect().top - actionTopBeforeSelector,
      selectorHeight: selectorBoundary.getBoundingClientRect().height,
    };
  }, layout.action.top);
  expect(selectorLayout.actionShift).toBeCloseTo(selectorLayout.selectorHeight, 1);

  await selector.getByRole("button", { name: "Location" }).click();
  await expect.poll(async () => page.locator(".onboarding-campaign-actions").evaluate(
    (node, actionTop) => Math.abs(node.getBoundingClientRect().top - actionTop),
    layout.action.top,
  )).toBeLessThan(1);
});

test("discovery pops removed prospect chips out while wrapped rows reflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=discovery");

  const chip = (value: string) => page.locator(".onboarding-campaign-chip", { hasText: value });
  const removeChip = async (value: string) => {
    await chip(value).hover();
    await chip(value).locator(".onboarding-campaign-chip-remove").click();
  };

  await removeChip("VP of Sales");
  await page.waitForTimeout(40);
  await expect(chip("VP of Sales")).toHaveCount(1);
  expect(await chip("VP of Sales").locator("xpath=..").evaluate((node) => getComputedStyle(node).position)).toBe("absolute");
  await expect(chip("VP of Sales")).toHaveCount(0);

  const input = page.getByLabel("Did we miss anything?");
  await input.fill("Chief Financial Officer; Chief Revenue Officer; Chief Operations Officer; Vice President of Marketing; Director of Sales; Head of Demand Generation; Sales Manager; Chief Strategy Officer");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const overflow = page.getByRole("button", { name: /Show \d+ more decision makers/ });
  await overflow.click();
  const popover = page.getByRole("dialog", { name: "Decision makers selections" });
  const hiddenRemove = popover.locator(".onboarding-campaign-chip", { hasText: "Chief Strategy Officer" }).locator(".onboarding-campaign-chip-remove");
  await hiddenRemove.focus();
  await page.keyboard.press("Enter");
  await expect(popover.locator(".onboarding-campaign-chip", { hasText: "Chief Strategy Officer" })).toHaveCount(0);

  await removeChip("Canada");
  await expect(chip("Canada")).toHaveCount(0);
  await removeChip("United States");
  await expect(chip("United States")).toHaveCount(0);
  await expect(page.locator("[data-prospect-row='locations']")).toContainText("No suggestion yet");
});

test("discovery removes a prospect chip immediately with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=discovery");

  const chip = page.locator(".onboarding-campaign-chip", { hasText: "Founder" });
  const remove = chip.locator(".onboarding-campaign-chip-remove");
  await chip.hover();
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveCount(0);
});

test("discovery expands a visible prospect chip only while it is active", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/onboarding-preview?step=discovery");

  for (const value of ["Founder", "VP of Sales", "Head of Growth"]) {
    const chip = page.locator(".onboarding-campaign-chip", { hasText: value });
    await chip.locator(".onboarding-campaign-chip-label").click();
    await expect(chip).toHaveCount(1);
    await chip.locator(".onboarding-campaign-chip-remove").focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveCount(0);
  }

  const input = page.getByLabel("Did we miss anything?");
  await input.fill("Digital marketing managers");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const chip = page.locator(".onboarding-campaign-chip", { hasText: "Digital marketing managers" });
  const remove = chip.locator(".onboarding-campaign-chip-remove");
  await expect(chip).toBeVisible();

  const resting = await page.evaluate(() => {
    const chip = document.querySelector<HTMLElement>(".onboarding-campaign-chip");
    const row = document.querySelector<HTMLElement>("[data-prospect-row='decisionMakers']");
    const remove = chip?.querySelector<HTMLElement>(".onboarding-campaign-chip-remove");
    if (!chip || !row || !remove) throw new Error("Discovery chip is missing");
    return { chipWidth: chip.getBoundingClientRect().width, removeWidth: remove.getBoundingClientRect().width, row: row.getBoundingClientRect() };
  });
  expect(resting.removeWidth).toBe(0);

  await chip.hover();
  await expect.poll(async () => remove.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(20);
  const active = await page.evaluate(() => {
    const chip = document.querySelector<HTMLElement>(".onboarding-campaign-chip");
    const row = document.querySelector<HTMLElement>("[data-prospect-row='decisionMakers']");
    if (!chip || !row) throw new Error("Discovery chip is missing");
    return { chipWidth: chip.getBoundingClientRect().width, row: row.getBoundingClientRect() };
  });
  expect(active.chipWidth).toBeGreaterThan(resting.chipWidth);
  expect(active.row.height).toBeCloseTo(resting.row.height, 1);

  await chip.locator(".onboarding-campaign-chip-label").focus();
  await expect(remove).toBeVisible();
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveCount(0);
});
