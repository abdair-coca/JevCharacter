import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// One bounded case per command. Old phase-4 evidence remains an earlier baseline.
const name = process.argv[2] ?? "desktop-light-es";
const special = ["reduced", "fallback", "lifecycle"];
const block = process.argv[3] ?? (special.includes(name) ? "checks" : "images");
if (!special.includes(name) && !["images", "finale"].includes(block)) throw new Error("Choose images or finale");
if (!special.includes(name) && !/^(desktop|mobile)-(light|dark)-(es|en)$/.test(name)) throw new Error("Unknown particle case");
const mobile = name.startsWith("mobile") || name === "reduced";
const language = name.endsWith("en") ? "en" : "es";
const theme = name.includes("dark") ? "dark" : "light";
const folder = ".dev/evidence/phase-4";
const sources = ["src/pages/AboutPage.tsx", "src/features/story/catalog.ts", "src/features/story/story.css", "src/features/story/useStoryScroll.ts", "src/features/story/ParticleVortex.tsx", "src/features/story/particleGeometry.ts", "public/story/bob.jpeg", "public/story/curiousTiti.webp", "public/story/housingML.svg", ".dev/evidence/phase-4/verify-particles.mjs"];
const hash = createHash("sha256");
for (const file of sources) { hash.update(file); hash.update(await readFile(file)); }
const report = { case: name, block, date: new Date().toISOString(), fingerprint: hash.digest("hex"), sources, checks: [], screenshots: [], errors: [], expectedErrors: [], warnings: [], measurements: [] };
const start = Date.now();
function check(ok, message) { if (!ok) throw new Error(message); report.checks.push(message); console.log(`[${((Date.now() - start) / 1000).toFixed(1)}s] PASS ${message}`); }
let browser; let page; let deadline;
async function capture(label) { const file = `particles-${name}-${label}.png`; await page.screenshot({ path: `${folder}/${file}`, timeout: 8000 }); report.screenshots.push(file); }
async function choose(index) {
  await page.locator(".story-progress button").nth(index).click();
  await page.waitForFunction(index => document.querySelector(".story-page").dataset.storySelected === ["creator", "bob", "titi", "learning", "vision"][index], index);
  await page.waitForTimeout(80);
}
async function inspect() {
  return page.evaluate(() => {
    const root = document.querySelector(".story-page"); const particle = document.querySelector(".story-particles");
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const copy = root.querySelector('.story-scene[data-selected="true"] .story-copy').getBoundingClientRect();
    const flight = root.querySelector(".story-flight").getBoundingClientRect();
    return { root: { ...root.dataset }, canvas: { ...particle.dataset }, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(root).getPropertyValue("--color-background").trim(), copyTop: copy.top, headerBottom: header.bottom, reveal: Number(getComputedStyle(root.querySelector(".story-creature")).opacity), canvasWidth: particle.width, flightWidth: flight.width, imageBottom: flight.top + flight.height * 0.92, navTop: root.querySelector('.story-navigation').getBoundingClientRect().top };
  });
}
try {
  browser = await chromium.launch(); report.browser = browser.version();
  deadline = setTimeout(() => { report.failure = "Case exceeded 60s deadline"; void browser.close(); }, 60000);
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: language, colorScheme: theme, reducedMotion: name === "reduced" ? "reduce" : "no-preference", isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  await context.addInitScript(({ theme, language }) => {
    localStorage.setItem("jevling.theme", theme); localStorage.setItem("jevling.language", language);
  }, { theme, language });
  let api = 0;
  await context.route("**/api/**", route => { api++; return route.abort(); });
  if (name === "fallback") await context.route("**/story/bob.jpeg", route => route.fulfill({ status: 404, body: "Expected image failure" }));
  page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "warning") report.warnings.push(message.text());
    if (message.type() === "error") (name === "fallback" && /404/.test(message.text()) ? report.expectedErrors : report.errors).push(message.text());
  });
  await page.goto("http://127.0.0.1:5174/about");
  await page.locator('.story-particles[data-prepared="true"]').waitFor();
  check(await page.locator("[data-story-scene]").count() === 5, "five readable project scenes");
  check(await page.locator(".home-session").count() === 0 && api === 0, "About does not initialize Home or call an API");
  check(await page.locator(".story-scene details").count() === 5, "native optional details available");
  if (name === "reduced" || name === "fallback") {
    await page.locator('.story-page[data-static="true"]').waitFor();
    const state = await inspect();
    check(await page.locator(".pin-spacer").count() === 0, "linear fallback has no pinning");
    check(state.canvas.running === "false", "static particles have no ticker loop");
    check(await page.locator('.story-static-media img:visible').count() === 3, "original project images accompany linear text");
    if (name === "fallback") check(state.root.particleError === "true", "failed image produces localized fallback notice");
    await choose(4);
    await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 15000 });
    await capture("static");
    if (name === "reduced") {
      const before = await page.locator(".story-particles").screenshot();
      await page.waitForTimeout(250);
      const after = await page.locator(".story-particles").screenshot();
      check(createHash("sha256").update(before).digest("hex") === createHash("sha256").update(after).digest("hex"), "reduced particles remain visually identical");
      await page.setViewportSize({ width: 320, height: 700 });
      check((await inspect()).scrollWidth <= 321, "320px reflow has no horizontal overflow");
    }
  } else if (name === "lifecycle") {
    await choose(1);
    check((await inspect()).canvas.running === "true", "visible vortex owns an active ticker");
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.locator('.story-particles[data-running="false"]').waitFor();
    check(true, "hidden document suspends particles");
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.locator('.story-particles[data-running="true"]').waitFor();
    check(true, "visible document resumes particles");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.locator('.story-particles[data-running="false"]').waitFor();
    check(true, "outro suspends offscreen vortex");
    await choose(1);
    await page.locator('.story-particles[data-running="true"]').waitFor();
    check((await inspect()).canvas.phase === "1", "returning from outro repositions pin and resumes the correct image");
    const node = await page.locator(".story-particles").elementHandle();
    await page.locator('.site-header a[href="/features"]').click();
    await page.locator(".story-page").waitFor({ state: "detached" });
    check(await node.evaluate(canvas => canvas.width === 0 && canvas.height === 0), "route exit releases particle canvas buffers");
    check(api === 0, "navigation to Features does not consult API");
  } else {
    await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 15000 });
    const chapters = block === "images" ? [[0, "intro"], [1, "bob"], [2, "titi"], [3, "learning"]] : [[4, "star"]];
    for (const [index, label] of chapters) {
      await choose(index);
      const state = await inspect(); report.measurements.push({ label, ...state });
      check(state.background === "#050608", `${label}: dark cinematic stage in ${theme} theme`);
      check(state.scrollWidth <= state.width + 1, `${label}: no horizontal overflow`);
      check(state.copyTop >= state.headerBottom - 2, `${label}: copy clears fixed header`);
      check(Number(state.canvas.phase) === index, `${label}: particles match chapter`);
      if (index === 4) check(state.reveal < 0.01, "star holds before revealing Jev");
      if (mobile && index > 0) check(state.imageBottom <= state.navTop + 2, `${label}: main figure clears bottom navigation`);
      await capture(label);
    }
    if (block === "finale") {
    const canvas = await page.locator(".story-particles").elementHandle();
    const character = await page.locator(".character-rive").elementHandle();
    await page.getByRole("button", { name: language === "es" ? "Revelar a Jev" : "Reveal Jev", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => Number(document.querySelector(".story-particles").dataset.reveal) > 0.98);
    check((await inspect()).reveal > 0.98, "keyboard action opens star and reveals Jev");
    await capture("reveal");
    await choose(4);
    check((await inspect()).reveal < 0.01, "reverse navigation reforms star");
    await page.locator('.theme-toggle').click();
    check((await inspect()).background === "#050608" && await canvas.evaluate(node => node === document.querySelector('.story-particles')), "theme switch retains dark stage and same particle canvas");
    await page.getByRole("button", { name: language === "es" ? "English" : "Español", exact: true }).click();
    const switched = await inspect();
    check(switched.root.storySelected === "vision" && Number(switched.root.storyProgress) < 4.1, "language switch preserves chapter and star progress");
    check(await canvas.evaluate(node => node === document.querySelector(".story-particles")) && await character.evaluate(node => node === document.querySelector(".character-rive")), "preferences retain particle and Rive canvases");
    await choose(1);
    if (mobile) {
      await page.locator('#story-bob summary').click();
      await page.locator('.story-page[data-reading="true"]').waitFor();
      check((await inspect()).canvas.running === "false", "mobile detail reading pauses illustration");
      await page.locator('#story-bob summary').click();
      await page.locator('.story-particles[data-running="true"]').waitFor();
      check(true, "closing mobile details resumes illustration");
    }
    }
    const fit = await page.locator('.story-navigation button').evaluateAll(nodes => nodes.every(node => { const b = node.getBoundingClientRect(); return b.width >= 44 && b.height >= 44 && b.left >= 0 && b.right <= innerWidth; }));
    check(fit, "keyboard/touch navigation has visible 44px targets");
    const state = await inspect();
    check(state.canvasWidth <= state.flightWidth * 2 + 1, "canvas DPR capped at two");
    check(Number(state.canvas.count) >= 3500 && Number(state.canvas.count) <= (mobile ? 5500 : 11000), "adaptive density stays within device budget");
    const timing = await page.evaluate(() => new Promise(resolve => {
      const intervals = []; let prior = performance.now();
      const frame = now => { intervals.push(now - prior); prior = now; if (intervals.length < 61) requestAnimationFrame(frame); else { intervals.shift(); intervals.sort((a, b) => a - b); resolve({ medianMs: intervals[30], p95Ms: intervals[57], particleDrawMs: document.querySelector('.story-particles').dataset.drawMs }); } };
      requestAnimationFrame(frame);
    }));
    report.measurements.push({ timing, conditions: "Chromium desktop host; mobile viewport/DPR/touch emulated; RAF pacing and canvas draw cost, not mobile hardware or LCP" });
    check(api === 0, "complete story makes zero API requests");
  }
  check(report.errors.length === 0, "no unexpected browser errors");
  check(!report.failure, "case completes within deadline");
} catch (error) {
  report.failure = error.message; process.exitCode = 1; console.error(error.message);
  if (!page?.isClosed()) {
    report.failureState = await inspect().catch(() => null);
    report.stage = await page.locator('.story-stage').boundingBox().catch(() => null);
    await capture('diagnostic').catch(() => {});
  }
} finally {
  clearTimeout(deadline); report.elapsedSeconds = (Date.now() - start) / 1000;
  await writeFile(`${folder}/particles-${name}-${block}.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  console.log(`Saved ${name}: ${report.checks.length} checks, ${report.screenshots.length} captures (${report.elapsedSeconds.toFixed(1)}s)`);
}
