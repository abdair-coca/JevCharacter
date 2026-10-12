import { chromium } from "file:///C:/Users/abdai/desktop/tracker/jevbot/node_modules/playwright-core/index.mjs";
const sizes = [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile-tall", width: 390, height: 844 }, { name: "mobile-short", width: 390, height: 640 }];
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const size of sizes) {
  for (const run of [1, 2]) {
    const page = await (await browser.newContext({ viewport: { width: size.width, height: size.height }, locale: "es-ES" })).newPage();
    await page.goto("http://localhost:5180/", { waitUntil: "networkidle" });
    await page.waitForTimeout(6500);
    const pos = () => page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height)]; };
      const cv = document.querySelector(".character-rive canvas");
      return { input: r("#creature-context"), zone: r(".creature-zone"), footer: r(".home-footer"), jevBitmap: cv ? cv.width : null };
    });
    const rest = await pos();
    await page.fill("#creature-context", "me gusta el café");
    await page.press("#creature-context", "Enter");
    await page.waitForTimeout(1000);
    const withClear = await pos();
    await page.evaluate(() => { const el = document.createElement("div"); el.className = "speech-caption"; el.textContent = "Hola, me encanta el café. Cuéntame más de tu día."; document.querySelector(".speech-slot").appendChild(el); });
    await page.waitForTimeout(800);
    const withCaption = await pos();
    if (run === 1) await page.screenshot({ path: `./home-after/final-${size.name}.png` });
    const same = (a, b) => JSON.stringify(a.input) === JSON.stringify(b.input) && JSON.stringify(a.zone) === JSON.stringify(b.zone) && JSON.stringify(a.footer) === JSON.stringify(b.footer);
    console.log(JSON.stringify({ viewport: size.name, run, rest, withClear, withCaption, noMovement: same(rest, withClear) && same(rest, withCaption) }));
    await page.context().close();
  }
}
await browser.close();
