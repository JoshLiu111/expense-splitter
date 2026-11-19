// Captures the Group page prototype (JoshLiu111/issue-track#19) in every
// hero state at desktop (1280px) and phone (390px) widths, full page, with
// the prototype switcher and the Next.js dev badge hidden.
//
// Needs the dev server running (`npm run dev`). Usage:
//
//   node scripts/shoot-prototype.mjs <out-dir> [--variant A] [--guest]
//     [--group grp_japan_2024] [--base http://localhost:3000]
//
// Files are named <variant>-<hero>-<desktop|phone>.png. By default the
// signed-in perspective (?you=1) is shown; --guest drops it.

import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    variant: { type: "string", default: "A" },
    group: { type: "string", default: "grp_japan_2024" },
    base: { type: "string", default: "http://localhost:3000" },
    guest: { type: "boolean", default: false },
  },
});

const [out] = positionals;
if (!out) {
  console.error("Usage: node scripts/shoot-prototype.mjs <out-dir> [--variant A] [--guest] [--group id] [--base url]");
  process.exit(1);
}

const HEROES = ["open", "small", "settled", "empty"];
const VIEWPORTS = [
  ["desktop", 1280, 900],
  ["phone", 390, 844],
];
const HIDE_OVERLAYS = "[data-prototype-switcher], nextjs-portal { display: none !important; }";

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [label, width, height] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
    for (const hero of HEROES) {
      const params = new URLSearchParams({ variant: values.variant, hero });
      if (!values.guest) params.set("you", "1");
      await page.goto(`${values.base}/guest/groups/${values.group}?${params}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: HIDE_OVERLAYS });
      await page.waitForTimeout(300);
      const file = `${out}/${values.variant}-${hero}-${label}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
