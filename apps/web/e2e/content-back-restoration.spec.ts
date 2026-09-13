import { expect, test } from "@playwright/test";

test.describe("CTA content Back restoration", () => {
  test("returns to the saved personalized video configuration", async ({ page }) => {
    await page.goto("/onboarding-preview/campaign-content/personalized-video?screen=09");
    await page.getByRole("button", { name: "Use this" }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/campaign-content\/personalized-video$/);
    await expect(page.getByRole("radio", { name: /Professional/i })).toBeChecked();
  });

  test("returns to the persisted uploaded video review without uploading again", async ({ page }) => {
    let uploadRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/video-upload")) uploadRequests += 1;
    });
    await page.goto("/onboarding-preview/campaign-content/your-video?screen=11");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/campaign-content\/your-video$/);
    await expect(page.getByRole("region", { name: "Campaign video upload" }).getByText("Acme-product-introduction.mp4", { exact: true })).toBeVisible();
    expect(uploadRequests).toBe(0);
  });

  test("returns to the persisted document review", async ({ page }) => {
    await page.goto("/onboarding-preview/campaign-content/document?screen=12");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/onboarding-preview\/cta$/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/campaign-content\/document$/);
    await expect(page.getByRole("region", { name: "Campaign document upload" }).getByText("Acme-growth-services-overview.pdf", { exact: true })).toBeVisible();
  });
});
