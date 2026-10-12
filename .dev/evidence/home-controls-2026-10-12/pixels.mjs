import { chromium } from "file:///C:/Users/abdai/desktop/tracker/jevbot/node_modules/playwright-core/index.mjs";
const variants = { final: "", noMetaAbsent: ".whisper__meta{display:none !important}" };
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [name, css] of Object.entries(variants)) {
  const out = [];
  for (let run = 0; run < 6; run++) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" })).newPage();
    await page.goto("http://localhost:5180/", { waitUntil: "networkidle" });
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(6500);
    const px = await page.evaluate(() => {
      const cv = document.querySelector(".character-rive canvas");
      const ctx = cv.getContext("2d");
      if (!ctx) return "no-2d";
      const cx = Math.round(cv.width / 2), cy = Math.round(cv.height / 2);
      let dark = 0, opaque = 0, n = 0;
      const d = ctx.getImageData(cx - 60, cy - 60, 120, 120).data;
      for (let i = 0; i < d.length; i += 4) { n++; if (d[i + 3] > 0) opaque++; if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] < 200) dark++; }
      return { bitmap: cv.width, opaqueShare: +(opaque / n).toFixed(2), darkShare: +(dark / n).toFixed(2) };
    });
    out.push(px);
    await page.context().close();
  }
  console.log(name, JSON.stringify(out));
}
await browser.close();
