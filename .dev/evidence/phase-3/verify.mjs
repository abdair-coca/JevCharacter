import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const directory = ".dev/evidence/phase-3";
const ids = ["perceives", "reacts", "decides", "answers", "talks", "transforms", "adapts", "stays"];
const states = [["Base", "Base"], ["Hello", "Flower", "Ghost"], ["think", "Hello"], ["yes", "no"], ["think", "Talk"], ["MorphState", "square", "triangle"], ["Base", "Hello"], ["Base", "Flower"]];
const selectedCase = process.argv[2] ?? "all";
const part = process.argv[3] ?? "all";
if (!["all", "layout", "controls", "reduced", "scroll", "lifecycle", "navigation"].includes(part) && !/^action-[0-7]$/.test(part)) throw new Error(`Unknown part: ${part}`);
const allowed = new Set(["all", "actions", "isolation", ...["desktop", "mobile"].flatMap(device => ["light", "dark"].flatMap(theme => ["es", "en"].map(language => `${device}-${theme}-${language}`)))]);
if (!allowed.has(selectedCase)) throw new Error(`Unknown case: ${selectedCase}`);
const report = { date: new Date().toISOString(), conditions: "Chromium production preview; real Rive binding/render; provider fixture only for Home; mobile/visibility/reduced-motion emulated", checks: [], errors: [], warnings: [], expectedResourceErrors: [], screenshots: [], measurements: [] };
const requests = [];
const started = Date.now();
const progress = message => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${message}`);
let browser;
let browserServer;
let page;
let mobile = false;
async function closeOwnedBrowser() {
  const owned = browserServer;
  browserServer = undefined;
  await owned?.kill();
}
const limit = selectedCase === "all" ? 600000 : selectedCase === "actions" ? 180000 : selectedCase === "isolation" ? 90000 : 45000;
const deadline = setTimeout(() => {
  report.failure = `Case exceeded ${limit / 1000}s; last completed check: ${report.checks.at(-1) ?? "browser setup"}`;
  console.error(report.failure);
  void closeOwnedBrowser();
}, limit);
const check = (condition, label) => { if (!condition) throw new Error(label); report.checks.push(label); progress(`PASS: ${label}`); };
async function open({ phone = false, theme = "light", language = "es", path = "/features", failure = false } = {}) {
  await closeOwnedBrowser();
  progress("Launching the owned test browser");
  browserServer = await chromium.launchServer({ timeout: 20000 });
  browser = await chromium.connect(browserServer.wsEndpoint());
  report.browser = browser.version();
  mobile = phone;
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: language, colorScheme: theme, isMobile: phone, hasTouch: phone });
  await context.addInitScript(({ theme, language }) => {
    localStorage.setItem("jevling.theme", theme); localStorage.setItem("jevling.language", language);
    const frame = window.requestAnimationFrame.bind(window);
    window.__showcaseFrames = 0;
    window.requestAnimationFrame = callback => { window.__showcaseFrames++; return frame(callback); };
  }, { theme, language });
  await context.route("**/api/**", route => {
    requests.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
    return route.fulfill({ json: { action: { kind: "reaction", reaction: "HELLO" }, actionConfidence: 0.83, reaction: "HELLO", reactionConfidence: 0.83, probabilities: { BASE: 0.05, HELLO: 0.83, GHOST: 0.04, FLOWER: 0.08 }, intensity: 0.5, wantsAttention: 0.4, source: "jev" } });
  });
  if (failure) await context.route("**/rive/prove2.riv", route => route.fulfill({ status: 404, body: "fixture asset failure" }));
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => (failure ? report.expectedResourceErrors : report.errors).push(error.message));
  page.on("console", message => {
    if (message.type() === "warning") report.warnings.push(message.text());
    if (message.type() === "error") (failure ? report.expectedResourceErrors : report.errors).push(message.text());
  });
  await page.goto(`http://127.0.0.1:5174${path}`);
  progress("Page loaded; waiting for Rive binding");
  if (!failure) await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  progress(failure ? "Asset failure fixture ready" : "Rive binding ready");
  return context;
}
async function choose(index) {
  const toggle = page.locator(".showcase-jump-toggle");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") {
    if (mobile) await toggle.tap(); else await toggle.click();
  }
  const button = page.locator(".showcase-progress button").nth(index);
  if (mobile) await button.tap(); else await button.click();
  await page.waitForFunction(id => document.querySelector(".features-page")?.dataset.chapter === id, ids[index]);
}
async function step(index, ordinal) {
  await page.waitForFunction(({ id, ordinal, state }) => {
    const root = document.querySelector(".features-page");
    return root?.dataset.chapter === id && root.dataset.step === String(ordinal) && root.dataset.showcasePhase === "playing" && document.querySelector('.character-rive[data-presentation="true"]')?.dataset.state === state;
  }, { id: ids[index], ordinal, state: states[index][ordinal] }, { timeout: 25000 });
}
async function capture(name) {
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false, timeout: 8000 });
  report.screenshots.push(`${name}.png`);
}
async function measure(label) {
  const data = await page.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const root = document.querySelector(".features-page");
    const active = root.dataset.chapter;
    const pane = document.querySelector(`#chapter-${active} .showcase-chapter__copy`);
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, chapter: active, step: root.dataset.step, phase: root.dataset.showcasePhase, flight: bounds(".showcase-flight"), copy: pane.getBoundingClientRect().toJSON(), stageBackground: getComputedStyle(document.querySelector(".showcase-stage")).backgroundColor, stageBorder: getComputedStyle(document.querySelector(".showcase-stage")).borderWidth, cardBorder: getComputedStyle(pane.parentElement).borderWidth, pointerEvents: getComputedStyle(document.querySelector('.character-rive[data-presentation="true"]')).pointerEvents };
  });
  report.measurements.push({ label, ...data });
  check(data.scrollWidth <= data.width + 1, `${label}: no horizontal overflow`);
  check(data.stageBackground === "rgba(0, 0, 0, 0)" && data.stageBorder === "0px" && data.cardBorder === "0px", `${label}: free scene without boxes/cards`);
  check(data.pointerEvents === "none", `${label}: presentation cannot receive real pointer events`);
  return data;
}
async function reducedCheck(label, phone) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await choose(2);
  await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "static", null, { timeout: 10000 });
  check(await page.locator(".pin-spacer").count() === 0, `${label}: reduced motion removes pinning`);
  await capture(`${label}-reduced`);
  if (phone) {
    await page.setViewportSize({ width: 320, height: 568 });
    await choose(0); await measure(`${label} reflow`); await capture(`${label}-reflow`);
  }
}
async function scrollCheck() {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "interrupted", null, { timeout: 10000 });
  const atEnd = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, -500); await page.waitForTimeout(300);
  check(await page.evaluate(() => scrollY) < atEnd, "offscreen scene suspends smooth scrolling without locking native wheel");
  await choose(0); await step(0, 0);
  check(true, "scroll return resumes selected scene");
}

try {
  for (const phone of [false, true]) for (const theme of ["light", "dark"]) for (const language of ["es", "en"]) {
    const label = `${phone ? "mobile" : "desktop"}-${theme}-${language}`;
    if (selectedCase !== "all" && selectedCase !== label && !(selectedCase === "actions" && label === "desktop-light-es")) continue;
    const context = await open({ phone, theme, language });
    console.log(`Checking ${label}`);
    const beforeRequests = requests.length;
    check(await page.locator("[data-chapter-card]").count() === 8 && await page.locator(".home-session").count() === 0, `${label}: eight chapters, no Home initialized`);
    if (part === "reduced" || part === "scroll" || part === "lifecycle" || part === "navigation" || part.startsWith("action-")) {
      if (part === "reduced") await reducedCheck(label, phone);
      else if (part === "scroll") await scrollCheck();
      else if (part === "navigation") {
        await choose(7); await step(7, 0);
        check(await page.locator(".showcase-controls button").nth(2).isDisabled(), `${label}: last chapter disables next`);
        await page.locator(".showcase-controls button").nth(0).focus(); await page.keyboard.press("Enter");
        check(await page.locator(".features-page").getAttribute("data-chapter") === "adapts", `${label}: keyboard previous selects chapter`);
        await page.reload(); await page.locator(".features-page").waitFor();
        check(await page.locator("[data-chapter-card]").count() === 8, `${label}: direct reload preserves route content`);
      }
      else if (part === "lifecycle") {
        await context.setOffline(true); await choose(3); await step(3, 0);
        check(true, "loaded scene plays offline without providers"); await context.setOffline(false);
        await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
        await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "interrupted", null, { timeout: 10000 });
        await page.waitForTimeout(250); const frames = await page.evaluate(() => window.__showcaseFrames); await page.waitForTimeout(500);
        check(await page.evaluate(() => window.__showcaseFrames) === frames, "hidden tab suspends Rive/Motion/Lenis RAF");
        await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
        await step(3, 0); check(true, "return resumes selected chapter from step zero");
      }
      else {
        const index = Number(part.slice(-1));
        await choose(index);
        await page.locator(".showcase-controls button").nth(1).click();
        for (let ordinal = 0; ordinal < states[index].length; ordinal++) {
          await step(index, ordinal); check(true, `${ids[index]}: real binding ${states[index][ordinal]}`);
          if (index === 5) { await page.waitForTimeout(1000); await capture(`morph-${states[index][ordinal]}`); }
        }
        if (index === 4) await capture("talk-example");
      }
      check(requests.length === beforeRequests, `${label}: no API calls from Features`);
      continue;
    }
    if (part !== "controls") {
    await choose(0);
    await page.waitForTimeout(1800);
    const right = await measure(`${label} first`);
    await capture(`${label}-perceives`);
    await choose(1);
    await step(1, 0);
    const left = await measure(`${label} second`);
    check(right.flight.x > left.flight.x + (phone ? 20 : 200), `${label}: Jev travels right-to-left`);
    check(left.copy.x > right.copy.x + (phone ? 10 : 200), `${label}: explanations alternate left/right`);
    await capture(`${label}-reacts`);
    await choose(2);
    await step(2, 1);
    check((await page.locator(".showcase-decision").innerText()).includes("94") && (await page.locator(".showcase-decision").innerText()).includes(language === "es" ? "no garantiza" : "does not guarantee"), `${label}: confidence explained contextually`);
    await measure(`${label} decision`);
    await capture(`${label}-decides`);
    }
    if (part === "layout") { check(requests.length === beforeRequests, `${label}: no API calls from Features`); continue; }
    const canvas = page.locator('.character-rive[data-presentation="true"] canvas');
    await canvas.evaluate(node => { node.__showcaseIdentity = true; });
    await choose(4);
    await step(4, 1);
    const oldChapter = await page.locator(".features-page").getAttribute("data-chapter");
    const oldStep = await page.locator(".features-page").getAttribute("data-step");
    await page.getByRole("button", { name: language === "es" ? "English" : "Español", exact: true }).click();
    check(await page.locator(".features-page").getAttribute("data-chapter") === oldChapter && await page.locator(".features-page").getAttribute("data-step") === oldStep, `${label}: language preserves logical progress`);
    check(await canvas.evaluate(node => node.__showcaseIdentity === true), `${label}: preferences do not remount Rive`);
    await page.getByRole("button", { name: language === "es" ? "Español" : "English", exact: true }).click();
    await page.locator(".theme-toggle").click();
    check(await canvas.evaluate(node => node.__showcaseIdentity === true), `${label}: theme retains canvas`);
    if (part === "controls") { check(requests.length === beforeRequests, `${label}: no API calls from Features`); continue; }
    await page.locator(".theme-toggle").click();
    if (!phone && theme === "light" && language === "es") {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "interrupted");
      const atEnd = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(300);
      check(await page.evaluate(() => scrollY) < atEnd, "offscreen scene suspends smooth scrolling without locking native wheel");
    }
    if (!phone && theme === "light" && language === "es" && (selectedCase === "all" || selectedCase === "actions")) {
      for (let index = 0; index < ids.length; index++) {
        console.log(`Checking Rive actions: ${ids[index]}`);
        await choose(index);
        await page.getByRole("button", { name: "Repetir escena", exact: true }).click();
        for (let ordinal = 0; ordinal < states[index].length; ordinal++) {
          await step(index, ordinal);
          check(true, `${ids[index]}: real binding ${states[index][ordinal]}`);
          if (index === 5) { await page.waitForTimeout(1000); await capture(`morph-${states[index][ordinal]}`); }
        }
      }
      await choose(4);
      await step(4, 1);
      await capture("talk-example");
      await context.setOffline(true);
      await choose(3);
      await step(3, 0);
      check(true, "loaded scene plays offline without providers");
      await context.setOffline(false);
      await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "interrupted");
      await page.waitForTimeout(200);
      const frames = await page.evaluate(() => window.__showcaseFrames);
      await page.waitForTimeout(500);
      check(await page.evaluate(() => window.__showcaseFrames) === frames, "hidden tab suspends Rive/Motion/Lenis RAF");
      await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
      await step(3, 0);
      check(true, "return resumes selected chapter from step zero");
    }
    await choose(7);
    await step(7, 0);
    check(await page.getByRole("button", { name: language === "es" ? "Siguiente" : "Next", exact: true }).isDisabled(), `${label}: final next is disabled`);
    await page.getByRole("button", { name: language === "es" ? "Anterior" : "Previous", exact: true }).focus();
    await page.keyboard.press("Enter");
    check(await page.locator(".features-page").getAttribute("data-chapter") === "adapts", `${label}: keyboard previous works`);
    await reducedCheck(label, phone);
    check(requests.length === beforeRequests, `${label}: no API calls from Features`);
    await page.reload();
    await page.locator(".features-page").waitFor();
    check(await page.locator("[data-chapter-card]").count() === 8, `${label}: direct reload works`);
  }
  if (selectedCase === "all" || selectedCase === "isolation") {
  // A real route crossing retains Home, while Features never touches its session.
  console.log("Checking Home isolation and asset recovery");
  await open({ path: "/" });
  const homeCanvas = page.locator(".home-session canvas");
  await homeCanvas.evaluate(node => { node.__homeIdentity = true; });
  await page.getByRole("textbox").fill("PHASE-3-CONTEXT");
  await page.getByRole("textbox").press("Enter");
  await page.getByRole("button", { name: "Borrar conversación", exact: true }).waitFor();
  await page.getByRole("textbox").fill("Borrador conservado");
  await page.getByRole("link", { name: "Capacidades", exact: true }).click();
  await page.locator('.character-rive[data-presentation="true"][data-ready="true"]').waitFor({ timeout: 45000 });
  const session = await page.evaluate(() => localStorage.getItem("jevling.personality"));
  const count = requests.length;
  await choose(5); await step(5, 0); await choose(2); await step(2, 1);
  check(await page.evaluate(() => localStorage.getItem("jevling.personality")) === session, "Features never mutates Home personality");
  check(await page.locator(".home-session").getAttribute("hidden") !== null && await page.locator('.home-session .character-rive').getAttribute("data-active") === "false", "Home remains hidden and suspended");
  await page.getByRole("link", { name: "Inicio", exact: true }).click();
  await page.getByRole("textbox").waitFor();
  check(await page.getByRole("textbox").inputValue() === "Borrador conservado" && await homeCanvas.evaluate(node => node.__homeIdentity === true), "return keeps Home draft and same canvas");
  check(await page.getByRole("button", { name: "Borrar conversación", exact: true }).isVisible() && requests.length === count, "return keeps context without an AI request");
  check(await page.locator(".pin-spacer").count() === 0 && await page.evaluate(() => !document.documentElement.classList.contains("lenis")), "presentation tears down pinning and global Lenis");
  await page.goBack(); await page.locator(".features-page").waitFor();
  await page.goForward(); await page.getByRole("textbox").waitFor();
  check(true, "back/forward crosses implemented Features and persistent Home");
  const failureContext = await open({ failure: true });
  await page.waitForFunction(() => document.querySelector(".features-page")?.dataset.showcasePhase === "error", null, { timeout: 50000 });
  check(await page.locator("[data-chapter-card]").count() === 8 && await page.getByRole("button", { name: "Reintentar carga", exact: true }).isVisible(), "asset failure leaves readable chapters and retry");
  await capture("asset-error");
  await failureContext.unroute("**/rive/prove2.riv");
  await page.getByRole("button", { name: "Reintentar carga", exact: true }).click();
  await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  await choose(1); await step(1, 0);
  check(true, "retry recovers real Rive binding");
  }
  check(report.errors.length === 0, "no unexpected application/console errors");
} catch (error) {
  report.failure ??= error.message;
  console.error(`FAIL: ${error.message}`);
  if (page && !page.isClosed()) await page.screenshot({ path: `${directory}/diagnostic-failure.png`, fullPage: false, timeout: 5000 }).catch(() => {});
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await closeOwnedBrowser();
  const suffix = part === "all" ? "" : `-${part}`;
  const filename = selectedCase === "all" ? "results.json" : `results-${selectedCase}${suffix}.json`;
  await writeFile(`${directory}/${filename}`, JSON.stringify({ case: selectedCase, part, ...report }, null, 2));
  console.log(JSON.stringify({ case: selectedCase, part, checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, failure: report.failure }, null, 2));
}
