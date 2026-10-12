// Usage: node capture.mjs <outDir> <baseUrl>
import { chromium } from "file:///C:/Users/abdai/desktop/tracker/jevbot/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
import path from "node:path";

const [outDir, base = "http://localhost:5180"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const shots = [
  { name: "home-desktop-light", route: "/", vp: "desktop", scheme: "light", wait: 7000 },
  { name: "home-mobile-light", route: "/", vp: "mobile", scheme: "light", wait: 7000 },
  { name: "home-mobile-dark", route: "/", vp: "mobile", scheme: "dark", wait: 7000 },
  { name: "features-desktop-light", route: "/features", vp: "desktop", scheme: "light", wait: 7000, scrolls: [0.0, 0.2, 0.5] },
  { name: "features-mobile-light", route: "/features", vp: "mobile", scheme: "light", wait: 7000, scrolls: [0.0, 0.2, 0.5] },
  { name: "about-desktop-light", route: "/about", vp: "desktop", scheme: "light", wait: 4000, scrolls: [0.0, 0.2, 0.45, 0.7] },
  { name: "about-mobile-light", route: "/about", vp: "mobile", scheme: "light", wait: 4000, scrolls: [0.0, 0.2, 0.45, 0.7] },
];

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const report = [];

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: viewports[shot.vp],
    colorScheme: shot.scheme,
    locale: "es-ES",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

  await page.goto(base + shot.route, { waitUntil: "networkidle" });
  await page.waitForTimeout(shot.wait);

  const measure = () => page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollY: Math.round(window.scrollY),
      particles: box(".story-particles, .story-page canvas.story-particles"),
      flight: box(".story-flight, .showcase-flight"),
      creatureZone: box(".creature-zone"),
      riveCanvas: box(".character-rive canvas"),
    };
  });

  const scrolls = shot.scrolls ?? [null];
  for (const frac of scrolls) {
    if (frac !== null) {
      await page.evaluate((f) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.round(max * f), behavior: "instant" });
      }, frac);
      await page.waitForTimeout(2500);
    }
    const label = frac === null ? "rest" : `s${String(Math.round(frac * 100)).padStart(2, "0")}`;
    const file = path.join(outDir, `${shot.name}-${label}.png`);
    await page.screenshot({ path: file });
    const m = await measure();
    report.push({ shot: shot.name, label, ...m, errors: [...new Set(errors)] });
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
