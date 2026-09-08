import { expect, test, type Page } from "@playwright/test";

async function openWebsitePreview(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const appRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      /\/auth\/v1\/|\/auth\/bootstrap|\/discovery\/scrape|\/strategy\//.test(
        request.url(),
      )
    ) {
      appRequests.push(request.url());
      await route.abort();
    } else if (request.url().includes("sentry.io")) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await page.goto(
    "/onboarding-preview?screen=03&step=discovery&view=website&capture=1",
  );
  await expect(
    page.getByRole("heading", { name: "Tell us about your business." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Understand my business", exact: true }),
  ).toBeEnabled();
  return appRequests;
}

test("website preview accepts a bare domain without native URL validation blocking it", async ({
  page,
}) => {
  const requests = await openWebsitePreview(page);
  await page
    .getByRole("textbox", { name: "Website", exact: true })
    .fill("acme.example");
  await page
    .getByRole("button", { name: "Understand my business", exact: true })
    .click();
  await expect(page).toHaveURL(/step=strategy.*substep=how-it-works/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "How LeadReacher works",
  );
  expect(requests).toEqual([]);
});

for (const value of ["", "not a website"]) {
  test(`website preview rejects ${value ? "an invalid domain" : "an empty URL"} locally`, async ({
    page,
  }) => {
    const requests = await openWebsitePreview(page);
    const input = page.getByRole("textbox", { name: "Website", exact: true });
    await input.fill(value);
    await page
      .getByRole("button", { name: "Understand my business", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Enter a valid website URL." }),
    ).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/view=website/);
    expect(requests).toEqual([]);
  });
}

test("all website insight dialogs and Help open, dismiss, and return focus", async ({
  page,
}) => {
  const requests = await openWebsitePreview(page);
  for (const title of ["Your offer", "Your customers", "Your market"]) {
    const trigger = page.getByRole("button", { name: new RegExp(`^${title}`) });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Got it", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  const help = page.getByRole("button", { name: "Help", exact: true });
  await help.click();
  const dialog = page.getByRole("dialog", {
    name: "Building your first campaign",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Nothing is sent during setup.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(help).toBeFocused();
  expect(requests).toEqual([]);
});
