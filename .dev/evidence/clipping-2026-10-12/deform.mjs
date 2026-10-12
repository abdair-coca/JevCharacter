import { chromium } from "file:///C:/Users/abdai/desktop/tracker/jevbot/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const page = await (await browser.newContext({ viewport: size, locale: "es-ES" })).newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("http://localhost:5180/about", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo({ top: Math.round((document.documentElement.scrollHeight - innerHeight) * 0.2), behavior: "instant" }));
  await page.waitForTimeout(2000);
  const box = await page.locator("canvas.story-particles").boundingBox();
  const read = () => page.evaluate(() => document.querySelector("canvas.story-particles").dataset.deformation);
  const before = await read();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 8 });
  await page.waitForTimeout(1200);
  const during = await read();
  await page.mouse.move(5, 5, { steps: 4 });
  await page.waitForTimeout(2500);
  const after = await read();
  console.log(JSON.stringify({ viewport: size.width, before, during, afterLeave: after, running: await page.evaluate(() => document.querySelector("canvas.story-particles").dataset.running), errors }));
  await page.context().close();
}
await browser.close();
