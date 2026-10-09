import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://jev-bot-sigma.vercel.app";
const variant = process.argv[3] ?? "desktop";
assert(["desktop", "mobile"].includes(variant), "Choose desktop or mobile");
const mobile = variant === "mobile";
const language = mobile ? "en" : "es";
const theme = mobile ? "dark" : "light";
const folder = new URL("./", import.meta.url);
const report = { date: new Date().toISOString(), base, variant, language, theme, checks: [], screenshots: [], apiRequests: [], errors: [] };
const browser = await chromium.launch();
let page;
const deadline = setTimeout(() => { void browser.close(); }, 90000);
const start = Date.now();
function check(value, label) {
  assert(value, label);
  report.checks.push(label);
  console.log(`[${((Date.now() - start) / 1000).toFixed(1)}s] PASS ${label}`);
}
try {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, locale: language, colorScheme: theme,
  });
  await context.addInitScript(({ theme, language }) => {
    localStorage.setItem("jevling.theme", JSON.stringify(theme));
    localStorage.setItem("jevling.language", JSON.stringify(language));
  }, { theme, language });
  context.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) report.apiRequests.push(request.url());
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  const capture = async name => {
    const file = `${variant}-${name}.png`;
    await page.screenshot({ path: fileURLToPath(new URL(file, folder)) });
    report.screenshots.push(file);
  };
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const response = await page.goto(`${base}/`);
  check(response.status() === 200, "Home direct load HTTP 200");
  await page.locator('.home-page .character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  check(await page.locator(".home-page canvas").count() === 1, "one ready Home character");
  check(await page.evaluate(({ language, theme }) => document.documentElement.lang === language && document.documentElement.dataset.theme === theme, { language, theme }), "requested language and theme applied");
  check(await noOverflow(), "Home without horizontal overflow");
  await capture("home");
  await page.locator("#creature-context").fill("hola");
  await page.locator("#creature-context").press("Enter");
  await page.waitForFunction(() => document.querySelector(".brain-hud__headline").textContent.match(/Saluda|Waves/));
  check(await page.locator(".brain-hud__signal--online").count() === 0, "context resolves locally without online status");
  await page.locator("#creature-context").fill(mobile ? "I want to sign up" : "quiero inscribirme");
  await page.locator("#creature-context").press("Enter");
  await page.locator("#enrollment-name").waitFor();
  check(await page.locator("#enrollment-phone").isVisible(), "both enrollment fields available");
  await page.locator('.enrollment button[type="submit"]').click();
  check(await page.locator('.enrollment [role="alert"]').count() === 2, "empty enrollment validates both fields");
  await page.locator("#enrollment-name").fill("Estudiante de Prueba");
  await page.locator("#enrollment-phone").fill("+591 7000-0000");
  await page.locator('.enrollment button[type="submit"]').click();
  await page.locator('.home-page[data-enrollment="confirmed"]').waitFor();
  check(await page.locator("#enrollment-name, #enrollment-phone").count() === 0, "confirmation discards personal fields");
  check(await page.locator(".home-page canvas").count() === 1, "enrollment keeps one character");
  check(await noOverflow(), "enrollment without horizontal overflow");
  await capture("enrollment");
  await page.keyboard.press("Escape");
  await page.locator('.home-page[data-enrollment="closed"]').waitFor();
  check(await page.locator("#creature-context").evaluate(element => element === document.activeElement), "Escape restores input focus");
  const featuresResponse = await page.goto(`${base}/features`);
  check(featuresResponse.status() === 200, "Features direct load HTTP 200");
  await page.locator(".showcase-chapter").first().waitFor();
  check(await page.locator(".showcase-chapter").count() === 8, "eight feature chapters");
  check(await page.locator(".home-session").count() === 0, "direct Features does not initialize Home");
  await page.locator('.showcase-chapter button').first().click();
  await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  // Binding readiness precedes the first authored GPU pose; match the existing
  // presentation harness's bounded visual stabilization before capturing.
  await page.waitForTimeout(1800);
  check(await page.locator('.features-page[data-showcase-phase="playing"], .features-page[data-showcase-phase="complete"]').count() === 1, "Features is playing or complete after character preparation");
  check(await noOverflow(), "Features without horizontal overflow");
  await capture("features");
  const aboutResponse = await page.goto(`${base}/about`);
  check(aboutResponse.status() === 200, "About direct load HTTP 200");
  await page.locator('.story-particles[data-prepared="true"]').waitFor({ timeout: 20000 });
  check(await page.locator(".story-scene").count() === 5, "five project story scenes");
  check(await page.locator(".home-session").count() === 0, "direct About does not initialize Home");
  await page.locator('[data-story-scene="4"]').scrollIntoViewIfNeeded();
  await page.locator(".story-reveal-cue button").click();
  await page.waitForFunction(() => Number(document.querySelector(".story-page").dataset.storyProgress) > 4.88);
  await page.locator('.story-page[data-story-status="ready"]').waitFor({ timeout: 45000 });
  check(await noOverflow(), "Story reveal without horizontal overflow");
  await capture("story");
  check(report.apiRequests.length === 0, "zero browser API requests across all flows");
  check(report.errors.length === 0, "zero application or console errors");
  for (const endpoint of ["decide", "talk"]) {
    const probe = await context.request.post(`${base}/api/${endpoint}`, { data: {} });
    check(probe.status() === 404, `/api/${endpoint} absent (HTTP 404)`);
  }
  await writeFile(new URL(`${variant}.json`, folder), JSON.stringify(report, null, 2) + "\n");
  console.log(`PASS ${variant}: ${report.checks.length} checks, ${report.screenshots.length} screenshots`);
} catch (error) {
  if (page && !page.isClosed()) {
    console.log(await page.evaluate(() => ({
      phase: document.querySelector(".home-page")?.dataset.enrollment,
      alerts: Array.from(document.querySelectorAll('[role="alert"]'), node => node.textContent),
      focused: document.activeElement?.id,
    })));
    await page.screenshot({ path: fileURLToPath(new URL(`${variant}-diagnostic.png`, folder)) });
  }
  throw error;
} finally {
  clearTimeout(deadline);
  await browser.close();
}
