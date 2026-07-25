/**
 * Export every 3-channel sticker fan as a PNG.
 *
 * Requires Playwright (one-time):
 *   cd /tmp && npm i playwright && npx playwright install chromium
 *
 * Run:
 *   NODE_PATH=/tmp/node_modules node apps/web/scripts/export-sticker-combo-mocks.mjs
 *
 * Or from /tmp after copying this file and setting absolute htmlPath/outDir.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../public/dashboard/sticker-combo-mocks.html");
const outDir =
  process.env.STICKER_MOCK_OUT ||
  path.resolve(
    process.env.HOME ?? "",
    ".cursor/projects/Users-nicol-Desktop-PROJECTS-leadreacher/assets/sticker-combos",
  );

const ORDER = ["instagram", "whatsapp", "facebook", "linkedin", "gmail", "outlook"];
const LABELS = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  gmail: "Gmail",
  outlook: "Outlook",
};

function combinations(items, k) {
  const out = [];
  function walk(start, pathAcc) {
    if (pathAcc.length === k) {
      out.push([...pathAcc]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      pathAcc.push(items[i]);
      walk(i + 1, pathAcc);
      pathAcc.pop();
    }
  }
  walk(0, []);
  return out;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 2,
  });

  console.log("opening", htmlPath);
  await page.goto(`file://${htmlPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const combos = combinations(ORDER, 3).map((trio) =>
    [...trio].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
  );

  await page.screenshot({
    path: path.join(outDir, "00-all-combinations.png"),
    fullPage: true,
  });
  console.log("wrote 00-all-combinations.png");

  const cards = page.locator(".card");
  const count = await cards.count();

  for (let i = 0; i < count; i += 1) {
    const trio = combos[i];
    const fileName = `${String(i + 1).padStart(2, "0")}-${trio.join("-")}.png`;
    await cards.nth(i).screenshot({ path: path.join(outDir, fileName) });
    console.log(`wrote ${fileName} (${trio.map((id) => LABELS[id]).join(" · ")})`);
  }

  await browser.close();
  console.log(`\nDone. ${count + 1} images in:\n${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
