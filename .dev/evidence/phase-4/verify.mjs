import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = ".dev/evidence/phase-4";
const name = process.argv[2];
const part = process.argv[3] ?? "layout";
const variants = ["desktop", "mobile"].flatMap(device => ["light", "dark"].flatMap(theme => ["es", "en"].map(language => `${device}-${theme}-${language}`)));
if (!variants.includes(name) && !["lifecycle", "isolation", "fallback"].includes(name)) throw new Error("Choose a single supported case");
if (!["layout", "controls", "reduced", "cold"].includes(part)) throw new Error("Choose layout, controls, reduced or cold");
const sources = [
  "package.json", "package-lock.json", "src/App.tsx", "src/App.css", "src/styles/tokens.css",
  "src/pages/AboutPage.tsx", "src/components/Character.tsx", "src/character/useCharacterController.ts",
  "src/components/SiteHeader.tsx", "src/components/ui/button.tsx", "src/navigation/routes.ts",
  "src/hooks/usePageVisibility.ts", "src/hooks/useReducedMotionPreference.ts", "src/lib/motionTokens.ts", "src/stores/preferencesStore.ts",
  "src/features/story/catalog.ts", "src/features/story/useStoryScroll.ts", "src/features/story/story.css",
  "src/features/presentation/scrollRuntime.ts", "src/features/presentation/useStageVisibility.ts", "docs/jev-story.md",
  ".dev/evidence/phase-4/verify.mjs", ".dev/evidence/phase-4/aggregate.mjs",
];
const hash = createHash("sha256");
for (const path of sources) { hash.update(path); hash.update(await readFile(path)); }
const report = { case: name, part, date: new Date().toISOString(), sourceFingerprint: hash.digest("hex"), sources, checks: [], screenshots: [], errors: [], warnings: [], expectedResourceErrors: [], measurements: [], conditions: "Production Chromium; desktop/mobile, touch, reduced motion and visibility emulated; Home API fixture only" };
const requests = [];
const start = Date.now();
const progress = text => console.log(`[${((Date.now() - start) / 1000).toFixed(1)}s] ${text}`);
const check = (condition, text) => { if (!condition) throw new Error(text); report.checks.push(text); progress(`PASS: ${text}`); };
let browser;
let page;
let context;
let deadline;
let touch = false;
async function open({ phone = false, theme = "light", language = "es", path = "/about", failure = false, noObserver = false, reduced = false } = {}) {
  if (browser) await browser.close();
  browser = await chromium.launch(); report.browser = browser.version();
  touch = phone;
  context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, colorScheme: theme, locale: language, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? "reduce" : "no-preference" });
  await context.addInitScript(({ theme, language }) => {
    localStorage.setItem("jevling.theme", theme); localStorage.setItem("jevling.language", language);
    const frame = requestAnimationFrame.bind(window); window.__storyFrames = 0;
    window.requestAnimationFrame = callback => { window.__storyFrames++; return frame(callback); };
  }, { theme, language });
  if (noObserver) await context.addInitScript(() => { delete window.IntersectionObserver; });
  await context.route("**/api/**", route => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: { action: { kind: "reaction", reaction: "HELLO" }, actionConfidence: 0.83, reaction: "HELLO", reactionConfidence: 0.83, probabilities: { BASE: 0.05, HELLO: 0.83, GHOST: 0.04, FLOWER: 0.08 }, intensity: 0.5, wantsAttention: 0.4, source: "jev" } });
  });
  if (failure) await context.route("**/rive/prove2.riv", route => route.fulfill({ status: 404, body: "asset failure fixture" }));
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "warning") report.warnings.push(message.text());
    if (message.type() === "error") (failure && /404|rive/i.test(message.text()) ? report.expectedResourceErrors : report.errors).push(message.text());
  });
  await page.goto(`http://127.0.0.1:5174${path}`);
  if (!failure) await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  if (!failure && path === "/about") await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 45000 });
  if (!failure) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Like the phase-3 visual harness, allow the first Rive surface to settle.
  // Binding readiness is not a guarantee that the GPU's first image has drawn.
  if (!failure && path === "/about") await page.waitForTimeout(1800);
  progress("Page and character ready");
}
async function choose(index) {
  const target = page.locator(".story-progress button").nth(index);
  if (touch) await target.tap(); else await target.click();
  await page.waitForFunction(index => document.querySelector(`[data-story-scene="${index}"]`)?.dataset.selected === "true", index);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function capture(label) {
  await page.screenshot({ path: `${directory}/${label}.png`, timeout: 10000 });
  report.screenshots.push(`${label}.png`);
}
async function geometry(label) {
  const data = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const root = document.querySelector(".story-page");
    return { selected: root.dataset.storySelected, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, flight: box(".story-flight"), copy: box('.story-scene[data-selected="true"] .story-copy'), header: box(".site-header"), navigation: box(".story-navigation"), chatOpacity: getComputedStyle(document.querySelector(".story-chat")).opacity, layersOpacity: getComputedStyle(document.querySelector(".story-layers")).opacity };
  });
  report.measurements.push({ label, ...data });
  check(data.scrollWidth <= data.width + 1, `${label}: no horizontal overflow`);
  check(data.copy.top >= data.header.bottom - 2, `${label}: scene starts below fixed header`);
  return data;
}
async function controlsFit() {
  const fit = await page.locator(".story-navigation button").evaluateAll(nodes => nodes.every(node => { const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44 && box.left >= 0 && box.right <= innerWidth; }));
  check(fit, "navigation touch targets are visible and at least 44px");
}

try {
  deadline = setTimeout(() => { report.failure = "Case exceeded its deadline"; void browser?.close(); }, name === "isolation" ? 90000 : 60000);
  if (variants.includes(name)) {
    const [device, theme, language] = name.split("-"); const phone = device === "mobile";
    await open({ phone, theme, language, reduced: part === "cold" });
    check(await page.locator("[data-story-scene]").count() === 5, "five readable narrative scenes");
    check(await page.locator(".home-session").count() === 0, "direct About does not initialize Home");
    check(await page.locator(".story-scene details").count() === 5, "five native optional details");
    if (part === "cold") {
      check(await page.locator('.story-page').getAttribute('data-static') === 'true' && await page.locator('.pin-spacer').count() === 0, "cold reduced entry has no pinning");
      check(await page.locator('.character-rive').getAttribute('data-static-preparing') === 'false' && await page.locator('.character-rive').getAttribute('data-state') === 'Base', "authored Base is ready after invisible initialization");
      const first = await page.locator('.story-creature').screenshot();
      await page.waitForTimeout(700);
      const second = await page.locator('.story-creature').screenshot();
      check(createHash('sha256').update(first).digest('hex') === createHash('sha256').update(second).digest('hex'), "static pose remains visually identical without motion");
      await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForFunction(() => document.querySelector('.character-rive')?.dataset.active === 'false');
      await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForFunction(() => document.querySelector('.character-rive')?.dataset.active === 'true');
      const resumed = await page.locator('.story-creature').screenshot();
      check(await page.locator('.character-rive').getAttribute('data-static-preparing') === 'false' && createHash('sha256').update(second).digest('hex') === createHash('sha256').update(resumed).digest('hex'), "static return preserves the same pose without warmup replay");
      await controlsFit(); await capture(`${name}-cold`);
    } else if (part === "layout") {
      await controlsFit();
      const first = await geometry(`${name} question`); await capture(`${name}-question`);
      check(Number(first.chatOpacity) > 0.9, "opening chat-box metaphor is visible");
      await choose(1); const second = await geometry(`${name} experiment`); await capture(`${name}-experiment`);
      check(first.flight.x > second.flight.x + (phone ? 10 : 200), "creature escapes to the opposite side");
      check(Number(second.chatOpacity) < 0.01, "chat box releases the creature");
      await choose(2); const layers = await geometry(`${name} evolution`); await capture(`${name}-evolution`);
      check(Number(layers.layersOpacity) > 0.99, "perception/behavior/body metaphor is visible");
      await choose(3); await geometry(`${name} creator`); await capture(`${name}-creator`);
      check((await page.locator("#story-creator").innerText()).includes("Abdair") && (await page.locator("#story-creator").innerText()).includes("Coca"), "original creator attribution");
      check((await page.locator("#story-creator .story-lead").innerText()).includes(language === "es" ? "Ingeniería Informática" : "Computer Engineering"), "creator biography localized without an invented portrait");
      await choose(4); await geometry(`${name} vision`); await capture(`${name}-vision`);
      check((await page.locator(".story-vision-note").innerText()).includes(language === "es" ? "no una promesa" : "not a promise"), "future vision explicitly identified");
      await page.locator(".story-outro").scrollIntoViewIfNeeded(); await capture(`${name}-closing`);
      check((await page.locator(".story-outro h2").innerText()).replace(/\s+/g, " ") === "Tiny creature. Big decisions.", "original closing and language metadata");
    } else if (part === "controls") {
      await page.keyboard.press("Tab");
      check(await page.locator(".skip-link").evaluate(node => node === document.activeElement), "keyboard discovers the skip link first");
      await page.keyboard.press("Enter");
      check(await page.locator("#page-title").evaluate(node => node === document.activeElement), "skip link focuses the story heading");
      await choose(2); const canvas = page.locator(".story-creature canvas"); await canvas.evaluate(node => { node.__storyIdentity = true; });
      if (phone) await page.locator("#story-evolution summary").tap(); else await page.locator("#story-evolution summary").click();
      await page.getByRole("button", { name: language === "es" ? "English" : "Español", exact: true }).click();
      check(await page.locator(".story-page").getAttribute("data-story-selected") === "evolution", "language retains selected scene");
      check(await page.locator("#story-evolution details").evaluate(node => node.open), "language retains expanded details");
      await page.locator(".theme-toggle").click();
      check(await canvas.evaluate(node => node.__storyIdentity === true), "theme/language retain the same canvas");
      if (phone) {
        await page.waitForFunction(() => document.querySelector('.story-page')?.dataset.reading === 'true' && Number(getComputedStyle(document.querySelector('.story-art')).opacity) < 0.01);
        check(await page.locator('.story-creature .character-rive').getAttribute('data-active') === 'false', "narrow detail reading hides and pauses the illustration");
      }
      await capture(`${name}-expanded`);
      await page.locator(".story-navigation > button").last().focus(); await page.keyboard.press("Enter");
      check(await page.locator(".story-page").getAttribute("data-story-selected") === "creator", "keyboard next selects a scene");
      await page.locator(".story-navigation > button").first().focus(); await page.keyboard.press("Enter");
      check(await page.locator(".story-page").getAttribute("data-story-selected") === "evolution", "keyboard previous selects a scene");
      await choose(4); check(await page.locator(".story-navigation > button").last().isDisabled(), "last scene disables next");
      await page.reload(); await page.locator("[data-story-scene]").nth(4).waitFor();
      check(await page.locator("[data-story-scene]").count() === 5 && new URL(page.url()).pathname === "/about", "direct reload preserves the About route");
    } else {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator('.story-page[data-static="true"]').waitFor();
      check(await page.locator(".pin-spacer").count() === 0, "reduced motion removes pinning");
      check(await page.evaluate(() => !document.documentElement.classList.contains("lenis")), "reduced motion releases smooth scrolling");
      await page.locator('.character-rive[data-static-preparing="false"]').waitFor({ timeout: 12000 });
      await choose(3); await geometry(`${name} reduced`); await capture(`${name}-reduced`);
      await page.setViewportSize({ width: phone ? 320 : 1024, height: phone ? 568 : 420 });
      await choose(2); await geometry(`${name} reflow`); await capture(`${name}-reflow`);
      await controlsFit();
      check(await page.locator(".story-page").getAttribute("data-story-selected") === "evolution", "static keyboard/direct controls reach every scene");
    }
    check(requests.length === 0, "About makes no API calls, including initial load");
  } else if (name === "fallback") {
    await open({ phone: true, noObserver: true });
    check(await page.locator(".story-page").getAttribute("data-static") === "true", "missing observer selects linear static reading");
    check(await page.locator(".pin-spacer").count() === 0 && await page.evaluate(() => !document.documentElement.classList.contains("lenis")), "missing observer has no pinning or smooth scroll");
    await choose(4); await geometry("no observer vision");
    check(await page.locator("[data-story-scene]").count() === 5 && requests.length === 0, "fallback retains five scenes without an API request");
    await capture("no-observer");
  } else if (name === "lifecycle") {
    await open(); await choose(3); await page.waitForTimeout(350);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(350); const frames = await page.evaluate(() => window.__storyFrames); await page.waitForTimeout(500);
    check(await page.locator(".story-creature .character-rive").getAttribute("data-active") === "false", "hidden tab pauses the character");
    check(await page.evaluate(() => window.__storyFrames) === frames, "hidden tab has no new animation frames");
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForFunction(() => document.querySelector('.story-creature .character-rive')?.dataset.active === 'true');
    check(await page.locator(".story-page").getAttribute("data-story-selected") === "creator", "return retains the selected scene");
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector('.story-creature .character-rive')?.dataset.active === 'false');
    const end = await page.evaluate(() => scrollY); await page.mouse.wheel(0, -500); await page.waitForTimeout(300);
    check(await page.evaluate(() => scrollY) < end, "native scroll remains usable offscreen");
    await choose(1); await context.setOffline(true); await choose(2); check(true, "loaded story works offline");
    check(requests.length === 0, "no API calls throughout lifecycle");
  } else {
    await open({ path: "/" });
    const canvas = page.locator(".home-session canvas"); await canvas.evaluate(node => { node.__homeIdentity = true; });
    await page.getByRole("textbox").fill("ABOUT-CONTEXT"); await page.getByRole("textbox").press("Enter");
    await page.getByRole("button", { name: "Borrar conversación", exact: true }).waitFor();
    await page.getByRole("textbox").fill("Borrador para volver"); const count = requests.length;
    await page.getByRole("link", { name: "Historia", exact: true }).click();
    await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 45000 });
    check(await page.locator("#page-title").evaluate(node => node === document.activeElement), "explicit navigation focuses the story heading");
    const personality = await page.evaluate(() => localStorage.getItem("jevling.personality"));
    await choose(4);
    check(await page.evaluate(() => localStorage.getItem("jevling.personality")) === personality, "story never changes Home personality");
    check(await page.locator(".home-session").getAttribute("hidden") !== null && await page.locator(".home-session").getAttribute("inert") !== null, "Home remains hidden and inert");
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    check(await page.getByRole("textbox").inputValue() === "Borrador para volver" && await canvas.evaluate(node => node.__homeIdentity === true), "Home returns with the same canvas and draft");
    check(requests.length === count && await page.getByRole("button", { name: "Borrar conversación", exact: true }).isVisible(), "Home context persists without a return API request");
    check(await page.locator(".pin-spacer").count() === 0 && await page.evaluate(() => !document.documentElement.classList.contains("lenis")), "story tears down pinning and Lenis");
    await page.goBack(); await page.locator(".story-page").waitFor(); await page.goForward(); await page.getByRole("textbox").waitFor();
    check(true, "back/forward crosses Home and About");
    await open({ failure: true }); await page.locator('.story-page[data-story-status="error"]').waitFor({ timeout: 50000 });
    check(await page.locator("[data-story-scene]").count() === 5, "asset failure preserves all narrative content");
    await capture("asset-error"); await context.unroute("**/rive/prove2.riv");
    await page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
    await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 45000 });
    check(true, "retry recovers only the story character");
  }
  check(report.errors.length === 0, "no unexpected application errors");
} catch (error) {
  report.failure ??= error.message; process.exitCode = 1; progress(`FAIL: ${error.message}`);
} finally {
  clearTimeout(deadline);
  await browser?.close();
  await writeFile(`${directory}/results-${name}-${part}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ case: name, part, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, failure: report.failure }, null, 2));
}
