import { expect, test, type Locator, type Page } from "@playwright/test";

const longRoles = [
  "Digital marketing managers",
  "International partnerships directors",
  "Operations Manager",
  "Customer experience directors",
  "Enterprise revenue leaders",
  "Regional marketing managers",
];
const selected = (page: Page) =>
  page.locator('[aria-label="Decision makers selected values"]');
const edit = (page: Page) =>
  page.getByRole("button", { name: "Edit Decision makers", exact: true });
const sheet = (page: Page) =>
  page.getByRole("dialog", { name: "Decision makers", exact: true });

async function userScrollTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bounds = await target.boundingBox();
    const viewport = page.viewportSize()!;
    if (
      bounds &&
      bounds.y >= 0 &&
      bounds.y + bounds.height <= viewport.height - 4
    )
      return;
    const direction = bounds && bounds.y < 0 ? -1 : 1;
    if (page.context().browser()?.browserType().name() === "webkit") {
      // WebKit's protocol does not expose native swipe gestures. PageDown checks
      // user-driven scroll reachability, not Playwright locator auto-scrolling.
      await page.keyboard.press(direction < 0 ? "PageUp" : "PageDown");
    } else {
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, direction * 260);
    }
    await page.waitForTimeout(70);
  }
  const bounds = await target.boundingBox();
  expect(
    bounds?.y,
    "user scrolling reaches the target without locator auto-scroll",
  ).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? Infinity) + (bounds?.height ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
}

async function populateLongRoles(page: Page) {
  await userScrollTo(page, edit(page));
  await edit(page).click();
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  while (
    await dialog
      .getByRole("button", { name: /^Remove .* from Decision makers$/ })
      .count()
  ) {
    const name = await dialog
      .getByRole("button", { name: /^Remove .* from Decision makers$/ })
      .first()
      .getAttribute("aria-label");
    const remove = dialog.getByRole("button", { name: name!, exact: true });
    await remove.click();
    await expect(remove).toHaveCount(0);
  }
  const input = dialog.getByRole("textbox", {
    name: "Add to Decision makers",
    exact: true,
  });
  for (const value of longRoles) {
    await input.fill(value);
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
  }
  await expect(dialog.getByText("6 selected", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(edit(page)).toBeFocused();
}

async function verifyTwoRows(page: Page) {
  const geometry = await selected(page).evaluate((element) => {
    const children = Array.from(element.children) as HTMLElement[];
    return {
      rows: [...new Set(children.map((child) => child.offsetTop))].length,
      width: element.clientWidth,
      fits: children.every(
        (child) =>
          child.offsetLeft >= 0 &&
          child.offsetLeft + child.offsetWidth <= element.clientWidth + 1,
      ),
    };
  });
  expect(geometry.rows).toBeLessThanOrEqual(2);
  expect(geometry.fits).toBe(true);
  if ((await selected(page).locator("span").count()) < longRoles.length) {
    await expect(
      selected(page).getByRole("button", {
        name: /^Show \d+ more decision makers$/,
      }),
    ).toBeVisible();
  } else {
    await expect(selected(page).getByRole("button")).toHaveCount(0);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test.describe("mobile Discovery audience editing", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // WebKit keepalive telemetry can bypass request routing. Keep only that
    // external transport local without masking application errors or API calls.
    await page.addInitScript(() => {
      const isTelemetry = (value: string) => {
        try {
          return new URL(value, location.href).hostname.endsWith(".sentry.io");
        } catch {
          return false;
        }
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) =>
        isTelemetry(input instanceof Request ? input.url : String(input))
          ? Promise.resolve(new Response("{}", { status: 200 }))
          : originalFetch(input, init);
      const originalBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) =>
        isTelemetry(String(url)) ? true : originalBeacon(url, data);
    });
  });

  test("adds real values, deduplicates, promotes hidden chips and restores focus", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=05&step=discovery");
    await expect(
      page.getByRole("heading", { name: /Your prospects/ }),
    ).toBeVisible();
    await populateLongRoles(page);
    await verifyTwoRows(page);
    const visibleBefore = await selected(page)
      .locator("span")
      .allTextContents();
    const trigger = selected(page).getByRole("button");
    await trigger.press("Enter");
    await expect(sheet(page)).toBeVisible();
    await expect(
      sheet(page).getByRole("heading", {
        name: "Decision makers",
        exact: true,
      }),
    ).toBeFocused();
    await sheet(page)
      .getByRole("textbox", { name: "Add to Decision makers" })
      .fill("digital marketing managers");
    await sheet(page).getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      sheet(page).getByText("6 selected", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Those details are already in your audience." }),
    ).toHaveCount(1);

    await sheet(page)
      .getByRole("button", {
        name: `Remove ${visibleBefore[0]} from Decision makers`,
        exact: true,
      })
      .press("Space");
    await expect(
      sheet(page).getByText("5 selected", { exact: true }),
    ).toBeVisible();
    await sheet(page)
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(trigger).toBeFocused();
    const visibleAfter = await selected(page).locator("span").allTextContents();
    expect(visibleAfter).not.toContain(visibleBefore[0]);
    expect(visibleAfter.some((value) => !visibleBefore.includes(value))).toBe(
      true,
    );
    await verifyTwoRows(page);
  });

  test("supports every sheet dismissal and falls back to Edit after the final hidden value is removed", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=06&step=discovery");
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(edit(page)).toBeFocused();
    await populateLongRoles(page);
    const trigger = selected(page).getByRole("button");
    for (const dismissal of ["Escape", "Close", "outside", "Done"]) {
      await trigger.press("Space");
      await expect(sheet(page)).toBeVisible();
      if (dismissal === "Escape") await page.keyboard.press("Escape");
      else if (dismissal === "outside") await page.mouse.click(10, 10);
      else
        await sheet(page)
          .getByRole("button", { name: dismissal, exact: true })
          .click();
      await expect(sheet(page)).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    await trigger.click();
    while (
      await sheet(page)
        .getByRole("button", { name: /^Remove .* from Decision makers$/ })
        .count()
    ) {
      const name = await sheet(page)
        .getByRole("button", { name: /^Remove .* from Decision makers$/ })
        .last()
        .getAttribute("aria-label");
      const remove = sheet(page).getByRole("button", {
        name: name!,
        exact: true,
      });
      await remove.click();
      await expect(remove).toHaveCount(0);
    }
    await expect(
      sheet(page).getByText("No suggestion yet", { exact: true }),
    ).toBeVisible();
    await expect(
      sheet(page).getByText("0 selected", { exact: true }),
    ).toBeVisible();
    await sheet(page)
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(edit(page)).toBeFocused();
    await expect(selected(page).getByRole("button")).toHaveCount(0);
    await expect(
      selected(page).getByText("No suggestion yet", { exact: true }),
    ).toBeVisible();
  });

  test("requires an explicit mobile category approval and supports keyboard Cancel", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=07&step=discovery");
    const choices = page.getByRole("group", {
      name: "Choose a category for Healthcare",
    });
    await expect(choices).toBeVisible();
    const companyTypes = choices.getByRole("button", {
      name: "Company types",
      exact: true,
    });
    await userScrollTo(page, companyTypes);
    await companyTypes.press("Space");
    await expect(companyTypes).toHaveAttribute("aria-pressed", "true");
    await expect(
      page
        .locator('[aria-label="Company types selected values"]')
        .getByText("Healthcare", { exact: true }),
    ).toHaveCount(0);
    const approve = page.getByRole("button", {
      name: "Add to Company types",
      exact: true,
    });
    await userScrollTo(page, approve);
    await approve.press("Enter");
    await expect(choices).toHaveCount(0);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Healthcare added to Company types." }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("textbox", { name: "Did we miss anything?", exact: true }),
    ).toBeFocused();

    const input = page.getByRole("textbox", {
      name: "Did we miss anything?",
      exact: true,
    });
    await input.fill("Love");
    await input.press("Enter");
    await expect(
      page.getByRole("group", { name: "Choose a category for Love" }),
    ).toBeVisible();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    await userScrollTo(page, cancel);
    await cancel.press("Space");
    await expect(
      page.getByRole("group", { name: "Choose a category for Love" }),
    ).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Placement cancelled." }),
    ).toHaveCount(1);
  });

  test("commits motion-mode removal once even when the sheet closes during exit", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/onboarding-preview?screen=06&step=discovery");
    const remove = sheet(page).getByRole("button", {
      name: "Remove Operations Manager from Decision makers",
      exact: true,
    });
    await remove.click();
    await sheet(page)
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await expect(sheet(page)).toHaveCount(0);
    await edit(page).click();
    await expect(
      sheet(page).getByText("5 selected", { exact: true }),
    ).toBeVisible();
    await expect(remove).toHaveCount(0);
    await expect(
      sheet(page).getByRole("button", {
        name: /^Remove .* from Decision makers$/,
      }),
    ).toHaveCount(5);
  });

  test("keeps an uncommitted category choice usable after crossing the desktop breakpoint", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=05&step=discovery");
    const input = page.getByRole("textbox", {
      name: "Did we miss anything?",
      exact: true,
    });
    await input.fill("Love");
    await input.press("Enter");
    const choices = page.getByRole("group", {
      name: "Choose a category for Love",
    });
    await choices
      .getByRole("button", { name: "Industries", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add to Industries", exact: true }),
    ).toBeEnabled();
    await page.setViewportSize({ width: 1194, height: 834 });
    const companyTypes = choices.getByRole("button", {
      name: "Company types",
      exact: true,
    });
    await expect(companyTypes).toBeEnabled();
    await companyTypes.press("Enter");
    await expect(choices).toHaveCount(0);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Love added to Company types." }),
    ).toHaveCount(1);
  });

  test("closes the mobile editor on desktop handoff without losing a queued removal", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/onboarding-preview?screen=06&step=discovery");
    await expect(
      sheet(page).getByRole("heading", {
        name: "Decision makers",
        exact: true,
      }),
    ).toBeFocused();
    await sheet(page)
      .getByRole("button", {
        name: "Remove Founder from Decision makers",
        exact: true,
      })
      .press("Enter");
    await page.setViewportSize({ width: 1194, height: 834 });
    await expect(sheet(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Remove Founder from Decision makers",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Did we miss anything?", exact: true }),
    ).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sheet(page)).toHaveCount(0);
    await edit(page).click();
    await expect(
      sheet(page).getByText("5 selected", { exact: true }),
    ).toBeVisible();
  });

  for (const alreadyCommitted of [false, true]) {
    test(`reconciles desktop approval ${alreadyCommitted ? "after" : "before"} commitment when switching to mobile`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1194, height: 834 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.clock.install();
      await page.goto("/onboarding-preview?screen=05&step=discovery");
      const input = page.getByRole("textbox", {
        name: "Did we miss anything?",
        exact: true,
      });
      await input.fill("Platinum");
      await input.press("Enter");
      const choices = page.getByRole("group", {
        name: "Choose a category for Platinum",
      });
      await expect(
        page.locator('.discovery-detail-selector[data-ready="true"]'),
      ).toBeVisible();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      await choices
        .getByRole("button", { name: "Industries", exact: true })
        .press("Enter");
      if (alreadyCommitted) await page.clock.runFor(200);
      await page.setViewportSize({ width: 390, height: 844 });
      if (alreadyCommitted) {
        await expect(choices).toHaveCount(0);
      } else {
        const location = choices.getByRole("button", {
          name: "Location",
          exact: true,
        });
        await expect(location).toBeEnabled();
        await location.press("Enter");
        await page
          .getByRole("button", { name: "Add to Location", exact: true })
          .press("Enter");
      }
      await page.clock.runFor(1000);
      const profile = await page.evaluate(
        () =>
          JSON.parse(
            sessionStorage.getItem(
              "lr_prospect_review:onboarding-preview-org:https://acme.example",
            )!,
          ).profile as Record<string, string[]>,
      );
      expect(profile.industries.includes("Platinum")).toBe(alreadyCommitted);
      expect(profile.locations.includes("Platinum")).toBe(!alreadyCommitted);
      await expect(choices).toHaveCount(0);
    });
  }

  test("exposes the real saved campaign summary and synchronizes reduced-motion disclosure state", async ({
    page,
  }) => {
    await page.goto("/onboarding-preview?screen=05&step=discovery");
    const trigger = page.getByRole("button", {
      name: "Open campaign summary for acme.example",
      exact: true,
      includeHidden: true,
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.press("Enter");
    const summary = page.getByRole("dialog", {
      name: "Your campaign",
      exact: true,
    });
    await expect(
      summary.getByRole("heading", { name: "Your campaign", exact: true }),
    ).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      summary.getByText("B2B software", { exact: true }),
    ).toBeVisible();
    await expect(summary.getByText("Founders", { exact: true })).toBeVisible();
    await expect(
      summary.getByText("sales teams", { exact: true }),
    ).toBeVisible();
    const business = summary.locator(
      'button[aria-controls$="-mobile-business"]',
    );
    await expect(business).toHaveAttribute("aria-expanded", "true");
    await business.press("Space");
    await expect(business).toHaveAttribute("aria-expanded", "false");
    await expect(
      summary.getByText("B2B software", { exact: true }),
    ).toHaveCount(0);
    await business.press("Enter");
    await expect(
      summary.getByText("B2B software", { exact: true }),
    ).toBeVisible();
    expect(
      await summary.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await summary.getByRole("button", { name: "Done", exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(summary).toHaveCount(0);
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 844, height: 390 },
  ]) {
    test(`keeps two rows, overflow editing and document-scrolled actions usable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize(viewport);
      await page.goto("/onboarding-preview?screen=05&step=discovery");
      await populateLongRoles(page);
      await verifyTwoRows(page);
      const next = page.getByRole("button", { name: "Continue", exact: true });
      const initialBounds = await next.boundingBox();
      const requiresScroll = Boolean(
        initialBounds &&
          initialBounds.y + initialBounds.height > viewport.height,
      );
      await userScrollTo(page, next);
      if (requiresScroll)
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () =>
            document.querySelector(".onboarding-viewport-fit")?.scrollTop ?? 0,
        ),
      ).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      expect(errors).toEqual([]);
    });
  }
});
