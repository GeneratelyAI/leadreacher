import { expect, test } from "@playwright/test";

for (const screen of ["09", "10"]) {
  test(`numbered style ${screen} shows the saved website from its first visible frame`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      const observedWindow = window as typeof window & {
        campaignSiteFrames: string[];
      };
      observedWindow.campaignSiteFrames = [];
      const sample = () => {
        for (const trigger of document.querySelectorAll(
          '[aria-label^="Open campaign summary for "]',
        )) {
          const bounds = trigger.getBoundingClientRect();
          const style = getComputedStyle(trigger);
          if (
            bounds.width > 0 &&
            bounds.height > 0 &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0
          ) {
            observedWindow.campaignSiteFrames.push(
              trigger.getAttribute("aria-label") ?? "",
            );
          }
        }
        if (observedWindow.campaignSiteFrames.length < 300)
          requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.goto(
      `/onboarding-preview?screen=${screen}&media=placeholder&capture=1`,
    );
    await expect(
      page.getByRole("button", {
        name: "Open campaign summary for acme.example",
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { campaignSiteFrames: string[] })
              .campaignSiteFrames.length,
        ),
      )
      .toBeGreaterThan(2);
    const frames = await page.evaluate(
      () =>
        (window as typeof window & { campaignSiteFrames: string[] })
          .campaignSiteFrames,
    );
    expect([...new Set(frames)]).toEqual([
      "Open campaign summary for acme.example",
    ]);
  });
}

test("numbered content preview preserves an approved Document choice through Back, refresh, and Forward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/auth\/v1\/|\/auth\/bootstrap|\/strategy\/|\/billing\/checkout-session|\/social-accounts\/connect/.test(
        request.url(),
      )
    ) {
      externalRequests.push(request.url());
    }
  });
  await page.goto(
    "/onboarding-preview?screen=08&capture=1",
  );
  await page.getByRole("radio", { name: /^Document/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding-preview\/campaign-content\/document/);
  await expect(page.locator("#upload-document-title")).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("radio", { name: /^Document/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Document/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.goForward();
  await expect(page).toHaveURL(/\/onboarding-preview\/campaign-content\/document/);
  await page.reload();
  await expect(page.locator("#upload-document-title")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open campaign summary for acme.example",
    }),
  ).toContainText("acme.example");
  expect(externalRequests).toEqual([]);
});

test("ordinary preview keeps sample thumbnails while numbered style reference uses neutral panels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/onboarding-preview/campaign-content/personalized-video?capture=1",
  );
  const samplePanels = page.locator('[data-preview-kind="sample"]');
  await expect(samplePanels).toHaveCount(3);
  await expect
    .poll(() =>
      samplePanels
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.goto(
    "/onboarding-preview?screen=09&media=placeholder&capture=1",
  );
  await expect(page.locator('[data-preview-kind="placeholder"]')).toHaveCount(
    3,
  );
  await expect(
    page.locator('[data-preview-kind="placeholder"] img'),
  ).toHaveCount(0);
});
