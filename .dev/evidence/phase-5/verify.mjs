import { chromium } from "@playwright/test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

// Phase 5 harness: short blocks against the production preview (127.0.0.1:5174).
// node .dev/evidence/phase-5/verify.mjs <block> [variant]
const BASE = "http://127.0.0.1:5174";
const DIR = ".dev/evidence/phase-5";
const [block = "", variant = ""] = process.argv.slice(2);
const BLOCKS = ["sound", "matrix", "navigation", "keyboard", "fallback", "perf", "static"];
const VARIANTS = ["desktop", "mobile"].flatMap(device => ["light", "dark"].flatMap(theme => ["es", "en"].map(language => `${device}-${theme}-${language}`)));
if (!BLOCKS.includes(block)) throw new Error(`Choose a block: ${BLOCKS.join(", ")}`);
if (block === "matrix" && !VARIANTS.includes(variant)) throw new Error(`Choose a variant: ${VARIANTS.join(", ")}`);

const report = {
  block, variant, date: new Date().toISOString(),
  conditions: "Production build via vite preview; headless Chromium; viewport, touch, reduced motion, visibility and throttling emulated; /api/* answered by fixtures, no providers.",
  checks: [], measurements: {}, screenshots: [], errors: [], expectedErrors: [], warnings: [], apiRequests: [],
};
const start = Date.now();
const log = text => console.log(`[${((Date.now() - start) / 1000).toFixed(1)}s] ${text}`);
const check = (condition, label) => { if (!condition) throw new Error(`FAIL: ${label}`); report.checks.push(label); log(`PASS ${label}`); };

let browser;
let apiMode = "hello";
const SPEECH_TEXT = { es: "¿Quieres jugar conmigo hoy?", en: "Do you want to play with me today?" };
const decision = action => ({ action, actionConfidence: 0.9, reaction: action.kind === "reaction" ? action.reaction : "HELLO", reactionConfidence: 0.9, probabilities: { BASE: 0.05, HELLO: 0.85, GHOST: 0.05, FLOWER: 0.05 }, intensity: 0.5, wantsAttention: 0.5, source: "jev" });

// Default headless Chromium renders WebGL with SwiftShader (software); performance
// runs use the machine's GPU through ANGLE/D3D11 so frame pacing reflects hardware.
const GPU_ARGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
async function open({ phone = false, theme = "light", language = "es", reduced = false, sound = true, failure = false, viewport, path = "/", wait = true, gpu = false } = {}) {
  if (browser) await browser.close();
  browser = await chromium.launch(gpu ? { args: GPU_ARGS } : {});
  report.browser = browser.version();
  const context = await browser.newContext({
    viewport: viewport ?? (phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }),
    isMobile: phone, hasTouch: phone, colorScheme: theme, locale: language, reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.addInitScript(({ theme, language, sound }) => {
    if (!sessionStorage.getItem("phase5.seeded")) {
      localStorage.setItem("jevling.theme", JSON.stringify(theme));
      localStorage.setItem("jevling.language", JSON.stringify(language));
      localStorage.setItem("jevling.sound", JSON.stringify(sound));
      sessionStorage.setItem("phase5.seeded", "1");
    }
    // Audio probe: counts contexts and oscillators and records chirp frequencies.
    const audio = { contexts: 0, oscillators: 0, starts: [], frequencies: [] };
    window.__audio = audio;
    const frequencyParams = new WeakSet();
    if (window.AudioContext) {
      const Native = window.AudioContext;
      window.AudioContext = class extends Native { constructor(...args) { super(...args); audio.contexts++; audio.context = this; } };
      const create = BaseAudioContext.prototype.createOscillator;
      BaseAudioContext.prototype.createOscillator = function () { const node = create.call(this); audio.oscillators++; frequencyParams.add(node.frequency); return node; };
      const begin = AudioScheduledSourceNode.prototype.start;
      AudioScheduledSourceNode.prototype.start = function (time = 0) { audio.starts.push(time); return begin.call(this, time); };
      for (const method of ["setValueAtTime", "exponentialRampToValueAtTime"]) {
        const original = AudioParam.prototype[method];
        AudioParam.prototype[method] = function (value, time) {
          if (frequencyParams.has(this) && value >= 100) audio.frequencies.push({ method, value: Math.round(value), time });
          return original.call(this, value, time);
        };
      }
    }
    const frame = window.requestAnimationFrame.bind(window);
    window.__frames = 0;
    window.requestAnimationFrame = callback => { window.__frames++; return frame(callback); };
  }, { theme, language, sound });
  await context.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    report.apiRequests.push(url.pathname);
    if (apiMode === "fail") return route.fulfill({ status: 503, body: "fixture unavailable" });
    if (url.pathname === "/api/decide") return route.fulfill({ json: decision(apiMode === "talk" ? { kind: "talk", state: "Talk" } : { kind: "reaction", reaction: "HELLO" }) });
    const body = JSON.parse(route.request().postData() ?? "{}");
    const text = SPEECH_TEXT[body.language === "en" ? "en" : "es"];
    const words = text.split(" ");
    const events = words.map((word, index) => `event: delta\ndata: ${JSON.stringify({ text: index ? ` ${word}` : word })}\n\n`).join("") + "event: done\ndata: {}\n\n";
    return route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body: events });
  });
  if (failure) await context.route("**/rive/prove2.riv", route => route.fulfill({ status: 404, body: "asset failure fixture" }));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    const text = message.text();
    if (message.type() === "warning") report.warnings.push(text);
    if (message.type() !== "error") return;
    const expected = (failure && /404|rive|Failed to load/i.test(text)) || (apiMode === "fail" && /503|Failed to load resource/i.test(text));
    (expected ? report.expectedErrors : report.errors).push(text);
  });
  const response = await page.goto(`${BASE}${path}`);
  if (wait && !failure) await ready(page, path);
  return { context, page, response };
}

async function ready(page, path) {
  if (path === "/") await page.locator('.home-page .character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  if (path === "/features") {
    await page.locator(".showcase-chapter").first().waitFor();
    await page.locator('.features-page .character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  }
  if (path === "/about") await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  // Binding readiness precedes the first GPU image (same settle as phases 3-4).
  await page.waitForTimeout(1800);
}

async function capture(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: `${DIR}/${file}` });
  report.screenshots.push(file);
}

const audio = page => page.evaluate(() => ({ contexts: window.__audio.contexts, state: window.__audio.context?.state ?? "none", oscillators: window.__audio.oscillators, frequencies: window.__audio.frequencies.length }));
const setVisibility = (page, state) => page.evaluate(value => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => value === "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
}, state);
async function submit(page, text) {
  await page.locator("#creature-context").fill(text);
  await page.locator("#creature-context").press("Enter");
}

// Accessibility and layout audit of the visible route, computed in the page.
const audit = page => page.evaluate(() => {
  const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = color => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = "#000"; canvas.fillStyle = color; canvas.fillRect(0, 0, 1, 1); const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const over = (top, bottom) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3])).concat(1);
  const luminance = ([r, g, b]) => { const c = [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const shown = element => {
    if (element.closest("[hidden], [inert], .sr-only")) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className && typeof element.className === "string" ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
  const interactive = [...document.querySelectorAll("a[href], button, input, textarea, select, [role='button'], [tabindex='0']")].filter(element => shown(element) && !element.classList.contains("skip-link"));
  const name = element => element.getAttribute("aria-label") || (element.getAttribute("aria-labelledby") ?? "").split(" ").map(id => document.getElementById(id)?.textContent ?? "").join(" ").trim()
    || element.innerText?.trim() || element.getAttribute("title") || (element.id && document.querySelector(`label[for="${element.id}"]`)?.textContent?.trim()) || element.getAttribute("placeholder");
  const targets = interactive.map(element => { const box = element.getBoundingClientRect(); return { element: describe(element), width: Math.round(box.width), height: Math.round(box.height) }; });
  const contrast = { measured: 0, unmeasured: 0, failures: [], lowest: null };
  for (const element of document.querySelectorAll("body *")) {
    const own = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (!own || !shown(element) || element.closest("[aria-hidden='true'], svg, .sr-only") || element === document.activeElement && element.classList.contains("skip-link")) continue;
    const style = getComputedStyle(element);
    if (Number(style.opacity) < 1 || element.closest(".skip-link")) continue;
    const layers = [];
    let image = false;
    // The selected ES/EN label sits on its sibling indicator, not on an ancestor.
    const indicator = element.matches(".language-switch button[aria-pressed='true']") && element.parentElement.querySelector(".language-switch__indicator");
    for (let node = element; node; node = node.parentElement) {
      const nodeStyle = getComputedStyle(node);
      if (Number(nodeStyle.opacity) < 1) { image = true; break; }
      if (nodeStyle.backgroundImage !== "none") { image = true; break; }
      const color = rgba(nodeStyle.backgroundColor);
      if (color[3] > 0) layers.push(color);
      if (color[3] === 1) break;
    }
    if (image) { contrast.unmeasured++; continue; }
    if (indicator) layers.unshift(rgba(getComputedStyle(indicator).backgroundColor));
    const background = layers.reverse().reduce((base, layer) => over(layer, base), [255, 255, 255, 1]);
    const foreground = over(rgba(style.color), background);
    const value = ratio(foreground, background);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    const needed = large ? 3 : 4.5;
    contrast.measured++;
    if (!contrast.lowest || value < contrast.lowest.ratio) contrast.lowest = { element: describe(element), ratio: Number(value.toFixed(2)) };
    if (value < needed) contrast.failures.push({ element: describe(element), text: element.textContent.trim().slice(0, 40), ratio: Number(value.toFixed(2)), needed });
  }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    h1: [...document.querySelectorAll("h1")].filter(shown).length,
    main: [...document.querySelectorAll("main")].filter(shown).length,
    navLinks: document.querySelectorAll("nav a").length,
    current: document.querySelector('nav a[aria-current="page"]')?.getAttribute("href") ?? null,
    unnamed: interactive.filter(element => !name(element)).map(describe),
    under24: targets.filter(target => target.width < 24 || target.height < 24),
    under44: targets.filter(target => target.width < 44 || target.height < 44),
    targets: targets.length,
    contrast,
    lang: document.documentElement.lang, theme: document.documentElement.dataset.theme, title: document.title,
  };
});

async function blockSound() {
  const { page } = await open();
  let state = await audio(page);
  check(state.contexts === 0 && state.oscillators === 0, "no audio before the first user gesture (Hello wake stays silent)");
  await page.locator("h1").click();
  await page.waitForFunction(() => window.__audio.context?.state === "running");
  check((await audio(page)).contexts === 1, "first gesture creates one running AudioContext");
  await submit(page, "hola");
  await page.waitForFunction(() => /Saluda/.test(document.querySelector(".brain-hud__headline")?.textContent ?? ""));
  await page.waitForTimeout(800);
  state = await audio(page);
  const hello = await page.evaluate(() => window.__audio.frequencies.some(entry => entry.method === "exponentialRampToValueAtTime" && entry.value === 1500));
  check(state.oscillators > 0 && hello, "think + Hello actions play their motifs (Hello rises to 1500 Hz)");
  report.measurements.actionOscillators = state.oscillators;

  apiMode = "talk";
  const before = await page.evaluate(() => ({ oscillators: window.__audio.oscillators, frequencies: window.__audio.frequencies.length, starts: window.__audio.starts.length }));
  await submit(page, "cuéntame algo");
  await page.locator(".speech-caption").filter({ hasText: "jugar" }).waitFor();
  await page.waitForTimeout(2500);
  const speech = await page.evaluate(({ frequencies, starts }) => {
    const ramps = window.__audio.frequencies.slice(frequencies);
    const sets = ramps.filter(entry => entry.method === "setValueAtTime");
    const lastSet = sets[sets.length - 1];
    const lastRamp = ramps.filter(entry => entry.method === "exponentialRampToValueAtTime" && entry.time >= lastSet.time).pop();
    const times = window.__audio.starts.slice(starts);
    // The submit's think motif (620, 820, 540, 900, 700 Hz) precedes the reply.
    const values = sets.map(entry => entry.value).join(",");
    const think = values.includes("620,820,540,900,700") ? 5 : 0;
    return { notes: sets.length, think, syllables: sets.length - think, finalFrom: lastSet.value, finalTo: lastRamp?.value ?? lastSet.value, span: Math.max(...times) - Math.min(...times) };
  }, before);
  report.measurements.speech = speech;
  // quie·res ju·gar con·mi·go hoy: 8 written syllables.
  check(speech.syllables === 8, `one chirp per written syllable (${speech.syllables} for "${SPEECH_TEXT.es}", plus ${speech.think} think chirps)`);
  check(speech.finalTo > speech.finalFrom * 1.5, `the question ends rising (${speech.finalFrom} → ${speech.finalTo} Hz)`);
  check(speech.span > 0.6, `chirps are spread as phrasing, not a single beep (${speech.span.toFixed(2)} s)`);
  await capture(page, "sound-home-speaking");

  apiMode = "hello";
  const toggle = page.getByRole("button", { name: "Sonido de Jev" });
  await toggle.click();
  check(await toggle.getAttribute("aria-pressed") === "false" && await page.evaluate(() => localStorage.getItem("jevling.sound")) === "false", "mute toggle reports pressed=false and persists");
  const muted = (await audio(page)).oscillators;
  await submit(page, "hola otra vez");
  await page.waitForTimeout(2500);
  check((await audio(page)).oscillators === muted, "muted Jev plays no new sounds");
  await capture(page, "sound-header-muted");
  await page.reload();
  await ready(page, "/");
  await page.locator("h1").click();
  check(await page.getByRole("button", { name: "Sonido de Jev" }).getAttribute("aria-pressed") === "false" && (await audio(page)).contexts === 0, "mute survives reload and gestures do not create audio while muted");
  await page.getByRole("button", { name: "Sonido de Jev" }).click();
  await page.waitForFunction(() => window.__audio.context?.state === "running");
  check(true, "unmuting from the header starts audio in that same gesture");

  await setVisibility(page, "hidden");
  await page.waitForFunction(() => window.__audio.context?.state === "suspended");
  check(true, "hidden tab suspends audio");
  await setVisibility(page, "visible");
  await page.waitForFunction(() => window.__audio.context?.state === "running");
  check(true, "visible tab resumes audio");

  await page.locator("nav").getByRole("link", { name: "Historia" }).click();
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  const aboutStart = (await audio(page)).oscillators;
  await page.locator('[data-story-scene="4"]').scrollIntoViewIfNeeded();
  await page.locator(".story-reveal-cue button").click();
  await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 45000 });
  await page.waitForTimeout(2500);
  check((await audio(page)).oscillators === aboutStart, "About stays silent, including the Jev reveal");

  await page.locator("nav").getByRole("link", { name: "Capacidades" }).click();
  await page.locator('.features-page .character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  await page.waitForTimeout(1800);
  const featuresStart = await page.evaluate(() => window.__audio.frequencies.length);
  await page.getByRole("button", { name: "Ver escena: Habla" }).click();
  await page.locator('.features-page[data-chapter="talks"][data-step="1"][data-showcase-phase="playing"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const talk = await page.evaluate(start => window.__audio.frequencies.slice(start).filter(entry => entry.method === "setValueAtTime").length, featuresStart);
  check(talk >= 12, `Features "Habla" chirps its scripted line (${talk} chirps, think motif included)`);
  await capture(page, "sound-features-talks");
  check(report.errors.length === 0, "zero application or console errors");
}

async function blockMatrix() {
  const [device, theme, language] = variant.split("-");
  const phone = device === "mobile";
  const { page } = await open({ phone, theme, language, path: "/" });
  for (const path of ["/", "/features", "/about"]) {
    if (path !== "/") { const response = await page.goto(`${BASE}${path}`); check(response.status() === 200, `${path} direct load HTTP 200`); await ready(page, path); }
    const result = await audit(page);
    report.measurements[path] = result;
    check(result.lang === language && result.theme === theme, `${path} applies ${language}/${theme}`);
    check(result.h1 === 1 && result.main >= 1, `${path} has one visible h1 and a main landmark`);
    check(result.navLinks === 3 && result.current === path, `${path} navigation marks the current page`);
    check(result.overflow <= 1, `${path} has no horizontal overflow (${result.overflow}px)`);
    check(result.unnamed.length === 0, `${path} every visible control has an accessible name`);
    check(result.under24.length === 0, `${path} targets meet 24×24 CSS px (${result.targets} measured; ${result.under44.length} below 44)`);
    check(result.contrast.failures.length === 0, `${path} AA text contrast (${result.contrast.measured} measured, ${result.contrast.unmeasured} over images/animated, lowest ${result.contrast.lowest?.ratio})`);
    await capture(page, `matrix-${variant}-${path === "/" ? "home" : path.slice(1)}`);
  }
  check(report.errors.length === 0, "zero application or console errors");
}

async function blockNavigation() {
  const { page } = await open({ path: "/" });
  await page.evaluate(() => { document.querySelector(".home-page canvas").__phase5 = true; });
  await page.locator("#creature-context").fill("Borrador pendiente");
  await page.locator("nav").getByRole("link", { name: "Historia" }).click();
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  check(await page.evaluate(() => document.activeElement?.dataset.pageRoute === "/about" && scrollY === 0), "link navigation focuses the destination h1 and starts at the top");
  check(await page.title() === "JEVLING — Historia", "document title follows the route");
  const homeHidden = await page.evaluate(() => { const shell = document.querySelector(".home-session"); return shell.hidden && shell.inert && document.querySelector(".home-page .character-rive").dataset.active === "false"; });
  check(homeHidden, "Home stays mounted but hidden, inert and suspended on another route");
  const framesBefore = await page.evaluate(() => ({ api: 0, oscillators: window.__audio.oscillators }));
  const apiBefore = report.apiRequests.length;
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(1500);
  const position = await page.evaluate(() => Math.round(scrollY));
  check(position > 800, `About scrolls (${position}px)`);
  await page.waitForTimeout(400);
  await page.locator("nav").getByRole("link", { name: "Inicio" }).click();
  await page.locator("#creature-context").waitFor();
  check(await page.evaluate(() => document.querySelector("#creature-context").value === "Borrador pendiente" && document.querySelector(".home-page canvas").__phase5 === true), "Home keeps its draft and the same canvas after crossing routes");
  check(report.apiRequests.length === apiBefore && (await audio(page)).oscillators === framesBefore.oscillators, "no API requests or sounds while Home was hidden");
  await page.goBack();
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  await page.waitForFunction(target => Math.abs(scrollY - target) <= 2, position, { timeout: 5000 });
  check(true, `Back restores About at ${position}px`);
  check(await page.evaluate(() => document.activeElement?.dataset.pageRoute === "/about"), "Back focuses the restored page heading");
  await page.goForward();
  await page.locator("#creature-context").waitFor();
  check(await page.evaluate(() => location.pathname === "/"), "Forward returns to Home");
  await page.goBack();
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  await page.reload();
  await ready(page, "/about");
  await page.waitForFunction(target => Math.abs(scrollY - target) <= 2, position, { timeout: 5000 });
  check(true, "reload keeps the route and restores the saved position");
  await page.getByRole("button", { name: "English" }).click();
  check(await page.evaluate(() => location.pathname === "/about" && document.documentElement.lang === "en"), "language change keeps route");
  await page.goto(`${BASE}/features`);
  await ready(page, "/features");
  await page.getByRole("button", { name: "View scene: Transforms" }).click();
  await page.locator('.features-page[data-chapter="transforms"]').waitFor();
  await page.getByRole("button", { name: "Español" }).click();
  check(await page.evaluate(() => document.querySelector(".features-page").dataset.chapter === "transforms"), "language change keeps the Features chapter");
  const missing = await page.goto(`${BASE}/no-existe`);
  await page.getByRole("heading", { name: "Página no encontrada" }).waitFor();
  check(missing.status() === 200 && await page.getByText("Esta dirección no lleva a ninguna vista de JEVLING.").isVisible(), "unknown path renders the in-app not-found page (preview SPA fallback)");
  await capture(page, "navigation-not-found");
  check(report.errors.length === 0, "zero application or console errors");
}

async function blockKeyboard() {
  const { page } = await open({ path: "/" });
  const order = [];
  for (let index = 0; index < 11; index++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const visible = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 || element.closest(".whisper")?.matches(":focus-within");
      return { name: element.getAttribute("aria-label") || element.textContent.trim().slice(0, 24) || element.id, visible: Boolean(visible) };
    }));
  }
  report.measurements.tabOrder = order;
  check(order[0].name === "Ir al contenido", "Tab starts with the skip link");
  check(["Jevling", "Inicio", "Capacidades", "Historia", "Sonido de Jev", "Tema", "Español", "English"].every((name, index) => order[index + 1].name === name), "header focus order: brand, three routes, sound, theme, ES, EN");
  check(order.every(entry => entry.visible), "every focused control shows a visible focus indicator");
  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < 9; index++) await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  check(await page.evaluate(() => document.activeElement?.id === "page-title"), "skip link moves focus to the page title");
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => document.activeElement?.id === "creature-context"), "after the title, Tab reaches Jev's input");
  await page.keyboard.type("hola");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Saluda/.test(document.querySelector(".brain-hud__headline")?.textContent ?? ""));
  check(true, "keyboard-only message reaches Jev");
  const expander = page.locator(".brain-hud button[aria-expanded]").first();
  await expander.focus();
  await page.keyboard.press("Enter");
  check(await expander.getAttribute("aria-expanded") === "true", "HUD details expand from the keyboard with aria-expanded");
  await page.keyboard.press("Escape");
  check(await expander.getAttribute("aria-expanded") === "false" && await expander.evaluate(element => element === document.activeElement), "Escape collapses HUD details and keeps focus");
  await page.goto(`${BASE}/features`);
  await ready(page, "/features");
  const play = page.getByRole("button", { name: "Ver escena: Reacciona" });
  await play.focus();
  await page.keyboard.press("Enter");
  await page.locator('.features-page[data-chapter="reacts"]').waitFor();
  check(true, "Features scenes start from the keyboard");
  await page.goto(`${BASE}/about`);
  await ready(page, "/about");
  const reveal = page.locator(".story-reveal-cue button");
  await reveal.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Number(document.querySelector(".story-page").dataset.storyProgress) > 4.8, null, { timeout: 15000 });
  check(true, "About reveal works from the keyboard");
  const links = await page.locator(".story-project a").evaluateAll(anchors => anchors.map(anchor => ({ href: anchor.href, target: anchor.target, rel: anchor.rel })));
  check(links.length === 3 && links.every(link => link.target === "_blank" && link.rel.includes("noopener")), "About project links open safely in a new tab");

  // Reduced motion: nothing moves on screen. ScrollTrigger keeps a no-op rAF
  // (its _rafBugFix) while enabled, so frame counts are recorded, not asserted.
  const reduced = await open({ reduced: true, path: "/about" });
  const frames = await reduced.page.evaluate(() => new Promise(resolve => { const begin = window.__frames; setTimeout(() => resolve(window.__frames - begin), 2000); }));
  report.measurements.reducedAboutFramesIn2s = { frames, note: "ScrollTrigger _rafBugFix no-op loop while section triggers exist; no rendering" };
  check(await reduced.page.evaluate(() => document.querySelector(".story-page").dataset.static === "true"), "About uses its static reading in reduced motion");
  const still = async () => { const first = await reduced.page.screenshot(); await reduced.page.waitForTimeout(1500); return first.equals(await reduced.page.screenshot()); };
  check(await still(), "About is visually still in reduced motion (identical frames 1.5 s apart)");
  await reduced.page.locator(".story-page").evaluate(element => element.querySelectorAll("[data-story-scene]")[2].scrollIntoView());
  await reduced.page.waitForTimeout(800);
  check(await still(), "About stays still after scrolling to another scene in reduced motion");
  await reduced.page.goto(`${BASE}/features`);
  await reduced.page.locator(".showcase-static-steps").first().waitFor();
  check(await reduced.page.evaluate(() => document.querySelector(".features-page").dataset.static === "true"), "Features uses static steps in reduced motion");
  await capture(reduced.page, "keyboard-reduced-features");
  check(report.errors.length === 0, "zero application or console errors");
}

async function blockFallback() {
  const { page } = await open({ failure: true, path: "/" });
  await page.locator("#creature-context").waitFor();
  await page.waitForTimeout(2500);
  check(await page.locator(".creature-loader").count() === 0 || !(await page.locator(".creature-loader").isVisible()), "Home hides the loader when Rive fails");
  await submit(page, "hola");
  await page.waitForFunction(() => /Saluda/.test(document.querySelector(".brain-hud__headline")?.textContent ?? ""));
  check(true, "Home input and decisions keep working without Rive");
  await capture(page, "fallback-home-no-rive");
  await page.goto(`${BASE}/features`);
  await page.locator('.showcase-status[data-phase="error"]').waitFor({ timeout: 30000 });
  check(await page.getByRole("button", { name: "Reintentar carga" }).isVisible(), "Features reports the failure and offers retry");
  await page.goto(`${BASE}/about`);
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 30000 });
  await page.locator('[data-story-scene="4"]').scrollIntoViewIfNeeded();
  await page.locator('.story-page[data-story-status="error"]').waitFor({ timeout: 45000 });
  check(await page.locator(".story-scene").count() === 5, "About remains readable when Jev cannot load");
  apiMode = "fail";
  const remote = await open({ path: "/" });
  await submit(remote.page, "hola");
  await remote.page.waitForFunction(() => document.querySelector(".brain-hud__headline")?.textContent.trim().length > 0);
  await remote.page.waitForTimeout(1500);
  check(await remote.page.locator(".brain-hud__signal--online").count() === 0, "remote decision failure falls back to local instinct");
  await capture(remote.page, "fallback-home-offline-api");
  check(report.errors.length === 0, `only injected failures logged errors (${report.expectedErrors.length} expected)`);
}

async function blockPerf() {
  const lcp = page => page.evaluate(() => new Promise(resolve => {
    let last = null;
    new PerformanceObserver(list => { for (const entry of list.getEntries()) last = entry; }).observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => resolve(last ? { ms: Math.round(last.startTime), element: last.element?.tagName.toLowerCase() ?? null } : null), 1500);
  }));
  const pacing = (page, scroll) => page.evaluate(scroll => new Promise(resolve => {
    const deltas = [];
    let previous = performance.now();
    const until = previous + 4000;
    const step = now => { deltas.push(now - previous); previous = now; if (now < until) requestAnimationFrame(step); else done(); };
    const done = () => { deltas.sort((a, b) => a - b); const pick = q => Number(deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * q))].toFixed(1)); resolve({ frames: deltas.length, p50: pick(0.5), p95: pick(0.95), max: Number(deltas[deltas.length - 1].toFixed(1)), over33: Number((deltas.filter(d => d > 33.4).length / deltas.length * 100).toFixed(1)) }); };
    if (scroll) { let y = 0; const timer = setInterval(() => { y += 120; scrollTo(0, y); if (y > 6000) clearInterval(timer); }, 50); }
    requestAnimationFrame(step);
  }), scroll);
  for (const profile of ["desktop", "mobile-throttled"]) {
    const phone = profile !== "desktop";
    const results = {};
    for (const path of ["/", "/features", "/about"]) {
      const { context, page } = await open({ phone, path, wait: false, gpu: true });
      report.measurements.renderer ??= await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const info = gl?.getExtension("WEBGL_debug_renderer_info");
        return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
      });
      if (phone) {
        const session = await context.newCDPSession(page);
        await session.send("Network.enable");
        await session.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.reload();
      }
      await page.waitForLoadState("load");
      const paint = await lcp(page);
      await ready(page, path);
      // A cold pass includes one-off work such as About loading Rive mid-scroll;
      // the warm pass repeats the same scroll once everything is loaded.
      const frames = await pacing(page, path !== "/");
      let warm = null;
      if (path !== "/") {
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(1500);
        warm = await pacing(page, true);
      }
      results[path] = { lcp: paint, frames, warm };
      log(`${profile} ${path}: LCP ${paint?.ms ?? "n/a"} ms, frame p95 ${frames.p95} ms, >33ms ${frames.over33}%${warm ? `; warm p95 ${warm.p95} ms, >33ms ${warm.over33}%` : ""}`);
    }
    report.measurements[profile] = results;
  }
  const assets = (await readdir("dist/assets")).filter(file => /\.(js|css)$/.test(file));
  report.measurements.bundle = await Promise.all(assets.map(async file => { const bytes = await readFile(`dist/assets/${file}`); return { file, kB: Number((bytes.length / 1000).toFixed(2)), gzipKB: Number((gzipSync(bytes).length / 1000).toFixed(2)) }; }));
  check(["desktop", "mobile-throttled", "bundle"].every(key => report.measurements[key]) && /D3D11/.test(report.measurements.renderer), `measured LCP and frame pacing for three routes under two profiles on the hardware GPU (${report.measurements.renderer}), plus bundle sizes`);
  check(report.errors.length === 0, "zero application or console errors");
}

async function blockStatic() {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  const sources = vercel.rewrites.map(rule => rule.source);
  check(JSON.stringify(sources) === JSON.stringify(["/features", "/about"]) && vercel.rewrites.every(rule => rule.destination === "/index.html"), "Vercel rewrites only the two app routes to index.html");
  check(!sources.some(source => source.includes("api") || source.includes("(.*)") || source.includes(":path")), "no rewrite can intercept /api/*");
  check(JSON.stringify(Object.keys(vercel.functions).sort()) === JSON.stringify(["api/decide.ts", "api/talk.ts"]), "only the decide/talk functions are server-side");
  const bundle = (await Promise.all((await readdir("dist/assets")).filter(file => file.endsWith(".js")).map(file => readFile(`dist/assets/${file}`, "utf8")))).join("\n");
  // Key-shaped values only: tailwind-merge legitimately contains "mask-…" class names.
  const leaks = [/GROQ/, /OPENAI/, /API_KEY/, /process\.env/, /\bg?sk[-_][A-Za-z0-9]{20,}/].filter(pattern => pattern.test(bundle)).map(String);
  check(leaks.length === 0, `client bundle has no provider keys or server env references (${leaks.join(", ") || "none"})`);
  const files = async directory => (await readdir(directory, { withFileTypes: true, recursive: true })).filter(entry => entry.isFile() && /\.(ts|tsx)$/.test(entry.name)).map(entry => `${entry.parentPath ?? entry.path}/${entry.name}`);
  const source = await Promise.all((await files("src")).map(async file => ({ file, text: await readFile(file, "utf8") })));
  const fetches = source.flatMap(({ file, text }) => [...text.matchAll(/fetch\(\s*["'`]([^"'`]+)/g)].map(match => `${file}: ${match[1]}`));
  check(fetches.every(entry => /\/api\/(decide|talk)$/.test(entry)), `the client only calls /api/decide and /api/talk (${fetches.length} call sites)`);
  const keys = source.flatMap(({ text }) => [...text.matchAll(/"(jevling\.[a-z]+)"/g)].map(match => match[1]));
  report.measurements.storageKeys = [...new Set(keys)].sort();
  // jevling.context is a legacy key the brain only removes on start; it is never written.
  const brain = source.find(({ file }) => file.endsWith("useCreatureBrain.ts")).text;
  const legacyRemovedOnly = /removeItem\(CONTEXT_KEY\)/.test(brain) && !/(setItem|writeStorage)\(CONTEXT_KEY/.test(brain);
  check(legacyRemovedOnly, "the legacy conversation key jevling.context is only removed, never written");
  check(report.measurements.storageKeys.every(key => ["jevling.context", "jevling.language", "jevling.personality", "jevling.sound", "jevling.theme"].includes(key)), `local storage holds preferences/personality only (${report.measurements.storageKeys.join(", ")}); conversation stays in memory`);
}

const deadline = setTimeout(() => { console.log("Deadline reached"); void browser?.close(); process.exit(1); }, block === "perf" ? 300000 : 180000);
try {
  await { sound: blockSound, matrix: blockMatrix, navigation: blockNavigation, keyboard: blockKeyboard, fallback: blockFallback, perf: blockPerf, static: blockStatic }[block]();
  report.passed = true;
  log(`PASS ${block}${variant ? ` ${variant}` : ""}: ${report.checks.length} checks, ${report.screenshots.length} screenshots`);
} catch (error) {
  report.passed = false;
  report.failure = String(error.message ?? error);
  console.error(report.failure);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await writeFile(`${DIR}/results-${block}${variant ? `-${variant}` : ""}.json`, JSON.stringify(report, null, 2) + "\n");
  await browser?.close();
}
