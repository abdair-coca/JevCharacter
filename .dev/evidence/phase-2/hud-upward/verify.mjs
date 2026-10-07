import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const directory = ".dev/evidence/phase-2/hud-upward";
const report = { date: new Date().toISOString(), conditions: "Chromium production preview; API fixtures; mobile, keyboard viewport and reduced motion emulated", checks: [], errors: [], expectedNetworkErrors: [], warnings: [], screenshots: [], measurements: [] };
const check = (condition, label) => { if (!condition) throw new Error(label); report.checks.push(label); };
const rectangles = page => page.evaluate(() => {
  const rect = selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
  };
  return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, scrollY, header: rect(".site-header"), hud: rect(".brain-hud"), summary: rect(".brain-hud__summary"), panel: rect(".brain-hud__details"), input: rect(".whisper"), footer: rect(".home-footer"), stage: rect(".creature-zone") };
});
const withinScreen = (data, label) => {
  check(data.scrollHeight <= data.height + 1 && data.scrollWidth <= data.width + 1, `${label}: no document overflow`);
  check(data.input.y >= data.header.bottom && data.input.bottom <= data.height, `${label}: input remains visible`);
  check(data.footer.bottom <= data.height + 1 && data.stage.height > 0, `${label}: footer and character fit`);
  if (data.panel) {
    check(data.panel.y >= data.header.bottom - 1, `${label}: panel clears header`);
    check(data.panel.x >= 0 && data.panel.right <= data.width + 1, `${label}: panel fits horizontally`);
    check(data.panel.bottom <= data.hud.y, `${label}: panel opens upwards`);
  }
};
let browser;
let page;
try {
  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) for (const language of ["es", "en"]) {
    browser = await chromium.launch();
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: language, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
    await context.route("**/api/**", route => {
      const body = route.request().postDataJSON();
      if (route.request().url().endsWith("/talk")) return route.fulfill({ status: 503, json: { error: "unavailable" } });
      return route.fulfill({ json: { action: body.state.userContext === "FAIL" ? { kind: "talk", state: "talkb" } : { kind: "morph", form: "triangle" }, actionConfidence: 0.91, reaction: "BASE", reactionConfidence: 0.91, probabilities: { BASE: 0.91, HELLO: 0.04, GHOST: 0.02, FLOWER: 0.03 }, intensity: 0.5, wantsAttention: 0.4, source: "jev" } });
    });
    page = await context.newPage();
    let expectedNetworkFailure = false;
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "warning") report.warnings.push(message.text());
      if (message.type() === "error") (expectedNetworkFailure && /503/.test(message.text()) ? report.expectedNetworkErrors : report.errors).push(message.text());
    });
    await page.goto("http://127.0.0.1:5174");
    await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
    // Runtime readiness precedes its startup drawing; avoid capturing the Rive splash.
    await page.waitForTimeout(2500);
    const label = `${mobile ? "mobile" : "desktop"}-${theme}-${language}`;
    const before = await rectangles(page);
    withinScreen(before, `${label} collapsed`);
    if (mobile) check(before.summary.height <= 52 && before.hud.width <= 210 && before.hud.bottom < before.input.y && Math.abs(before.hud.right - before.input.right) < 1, `${label}: compact HUD aligned right above input`);
    else check(Math.abs(before.input.x + before.input.width / 2 - before.width / 2) < 1, `${label}: input centered independently`);
    await page.screenshot({ path: `${directory}/${label}-collapsed.png` });
    if (mobile) await page.locator(".brain-hud__summary").tap();
    else await page.locator(".brain-hud__summary").click();
    await page.waitForTimeout(400);
    const after = await rectangles(page);
    withinScreen(after, `${label} expanded`);
    check(Math.abs(after.input.y - before.input.y) < 1 && Math.abs(after.summary.y - before.summary.y) < 1, `${label}: expansion does not shift input or trigger`);
    await page.mouse.wheel(0, 1000);
    await page.keyboard.press("PageDown");
    check((await rectangles(page)).scrollY === 0, `${label}: wheel/PageDown cannot scroll Home`);
    await page.screenshot({ path: `${directory}/${label}-expanded.png` });
    report.screenshots.push(`${label}-collapsed.png`, `${label}-expanded.png`);
    report.measurements.push({ label, before, after });
    await page.locator(".brain-hud__summary").focus();
    await page.keyboard.press("Escape");
    check(await page.locator(".brain-hud__summary").getAttribute("aria-expanded") === "false", `${label}: Escape closes`);
    await page.locator(".brain-hud__summary").press("Enter");
    check(await page.locator(".brain-hud__summary").getAttribute("aria-expanded") === "true", `${label}: Enter opens`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const sizes = mobile ? [[390, 780], [390, 667], [390, 568], [320, 568], [390, 420], [844, 390]] : [[1366, 768], [1024, 768], [1366, 600]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const data = await rectangles(page);
      withinScreen(data, `${label} ${width}x${height}`);
      report.measurements.push({ label: `${label} ${width}x${height}`, after: data });
    }
    if (mobile) {
      await page.setViewportSize({ width: 390, height: 420 });
      await page.getByRole("textbox").fill("MORPH");
      await page.getByRole("textbox").press("Enter");
      await page.locator(".brain-hud__headline").getByText(language === "es" ? "Triángulo" : "Triangle", { exact: true }).waitFor();
      withinScreen(await rectangles(page), `${label} context held/short viewport`);
      await page.screenshot({ path: `${directory}/${label}-short.png` });
      report.screenshots.push(`${label}-short.png`);
      expectedNetworkFailure = true;
      await page.getByRole("textbox").fill("FAIL");
      await page.getByRole("textbox").press("Enter");
      await page.locator(".brain-hud__notice").waitFor({ timeout: 15000 });
      withinScreen(await rectangles(page), `${label} speech error/short viewport`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('nav a[href="/features"]').click();
    check(await page.evaluate(() => getComputedStyle(document.documentElement).overflow !== "hidden"), `${label}: leaving Home releases scroll lock`);
    await page.locator('nav a[href="/"]').click();
    await page.waitForTimeout(200);
    check(await page.locator(".brain-hud__summary").getAttribute("aria-expanded") === "true", `${label}: navigation preserves expanded HUD`);
    await browser.close();
    browser = null;
  }
  check(report.errors.length === 0, "no application errors");
} catch (error) {
  report.failure = error.message;
  if (page && !page.isClosed()) await page.screenshot({ path: `${directory}/diagnostic-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(`${directory}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, failure: report.failure }, null, 2));
}
