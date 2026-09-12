import { expect, test } from "@playwright/test";

const routes = [
  "/signup",
  "/login",
  "/onboarding-preview/discovery",
  "/onboarding-preview/campaign-content",
];

test.describe("light auth and onboarding browser surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() =>
      window.localStorage.setItem("lr_theme", "dark"),
    );
  });

  for (const route of routes) {
    test(`${route} keeps home navigation without speculative landing requests`, async ({ page }) => {
      const landingPrefetches: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/" && request.headers()["next-router-prefetch"] === "1") {
          landingPrefetches.push(request.url());
        }
      });
      await page.goto(route);
      const home = page.getByRole("link", { name: /leadreacher home/i }).filter({ visible: true });
      await expect(home).toBeVisible();
      await home.hover();
      // Allow the production intersection and hover prefetch schedulers to run.
      await page.waitForTimeout(500);
      expect(landingPrefetches).toEqual([]);
      await home.click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("main").first()).toBeVisible();
    });
  }

  for (const route of routes) {
    test(`${route} stays white when the system prefers dark`, async ({
      page,
    }) => {
      const runtimeErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") runtimeErrors.push(message.text());
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));

      await page.goto(route);
      await expect(page.locator("[data-light-campaign-route]")).toBeVisible();

      const surface = await page.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        darkClass: document.documentElement.classList.contains("dark"),
        root: getComputedStyle(document.documentElement).backgroundColor,
        schemeMeta: document
          .querySelector('meta[name="color-scheme"]')
          ?.getAttribute("content"),
        themeColors: Array.from(
          document.querySelectorAll<HTMLMetaElement>(
            'meta[name="theme-color"]',
          ),
        ).map((meta) => ({
          color: meta.content,
          media: meta.media,
        })),
      }));

      expect(surface).toMatchObject({
        body: "rgb(255, 255, 255)",
        colorScheme: "light",
        darkClass: false,
        root: "rgb(255, 255, 255)",
        schemeMeta: "light",
      });
      expect(surface.themeColors).toEqual(
        expect.arrayContaining([
          { color: "#ffffff", media: "(prefers-color-scheme: light)" },
          { color: "#ffffff", media: "(prefers-color-scheme: dark)" },
        ]),
      );

      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      expect(
        await page.evaluate(() => ({
          body: getComputedStyle(document.body).backgroundColor,
          root: getComputedStyle(document.documentElement).backgroundColor,
        })),
      ).toEqual({ body: "rgb(255, 255, 255)", root: "rgb(255, 255, 255)" });

      await page.reload();
      expect(
        await page.evaluate(() =>
          document.documentElement.classList.contains("dark"),
        ),
      ).toBe(false);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      expect(runtimeErrors).toEqual([]);
    });
  }
});
