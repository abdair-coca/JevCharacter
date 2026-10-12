// Counts non-transparent pixels on the outer border of the particle canvas bitmap.
// Non-zero border alpha means the cloud is still cut by the canvas edge.
import { chromium } from "file:///C:/Users/abdai/desktop/tracker/jevbot/node_modules/playwright-core/index.mjs";

const base = process.argv[2] ?? "http://localhost:5180";
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];

for (const [vp, size] of Object.entries(viewports)) {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: size, colorScheme: scheme, locale: "es-ES" });
    const page = await context.newPage();
    await page.goto(base + "/about", { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    for (const frac of [0.0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8]) {
      await page.evaluate((f) => window.scrollTo({ top: Math.round((document.documentElement.scrollHeight - innerHeight) * f), behavior: "instant" }), frac);
      await page.waitForTimeout(1800);
      const result = await page.evaluate(() => {
        const canvas = document.querySelector("canvas.story-particles");
        if (!canvas || !canvas.width) return null;
        const ctx = canvas.getContext("2d");
        const { width: w, height: h } = canvas;
        const band = Math.max(2, Math.round(w * 0.004));
        const data = ctx.getImageData(0, 0, w, h).data;
        let edge = 0; let total = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] === 0) continue;
          total++;
          if (x < band || y < band || x >= w - band || y >= h - band) edge++;
        }
        return { edge, total };
      });
      rows.push({ vp, scheme, scroll: frac, ...(result ?? { edge: "no canvas" }) });
    }
    await context.close();
  }
}

await browser.close();
console.table(rows);
