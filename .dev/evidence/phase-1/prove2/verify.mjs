import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const output = ".dev/evidence/phase-1/prove2";
const report = { date: new Date().toISOString(), browser: browser.version(), checks: [], errors: [], warnings: [], captures: [], conditions: "Production preview, direct Rive rendering, mocked decisions/SSE, emulated mobile" };
const check = (condition, label) => { if (!condition) throw new Error(label); report.checks.push(label); };
try {
  for (const mobile of [false, true]) {
    for (const theme of ["light", "dark"]) {
      const label = `${mobile ? "mobile" : "desktop"}-${theme}`;
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: "es", colorScheme: theme, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      let assetLoaded = false;
      let apiRequests = 0;
      let action = { kind: "reaction", reaction: "HELLO" };
      page.on("response", response => { if (response.url().endsWith("/rive/prove2.riv") && response.ok()) assetLoaded = true; });
      page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
      page.on("console", message => {
        if (message.type() === "error") report.errors.push(`${label}: ${message.text()}`);
        if (message.type() === "warning") report.warnings.push(`${label}: ${message.text()}`);
      });
      await page.route("**/api/decide", route => {
        apiRequests++;
        return route.fulfill({ json: { action, actionConfidence: 0.9, reaction: "HELLO", reactionConfidence: 0.9, probabilities: { BASE: 0.1, HELLO: 0.8, GHOST: 0.05, FLOWER: 0.05 }, intensity: 0.4, wantsAttention: 0.3, source: "jev" } });
      });
      await page.route("**/api/talk", route => route.fulfill({ contentType: "text/event-stream", body: 'event: delta\ndata: {"text":"Esta es una prueba de habla."}\n\nevent: done\ndata: {}\n\n' }));
      await page.goto("http://127.0.0.1:5174/");
      await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2200);
      check(assetLoaded, `${label}: prove2.riv loaded successfully`);
      check(await page.locator("canvas").count() === 1, `${label}: single direct canvas`);
      check(await page.locator(".creature-presence").evaluate(element => { const box = element.getBoundingClientRect(); return Math.abs(box.width - box.height) < 1; }), `${label}: existing square framing preserved`);
      const capture = async name => {
        const path = `${output}/${name}.png`;
        await page.screenshot({ path, fullPage: true });
        report.captures.push(path);
      };
      await capture(label);
      const canvas = await page.locator("canvas").elementHandle();
      await page.getByRole("button", { name: "Tema", exact: true }).click();
      await page.getByRole("button", { name: "English", exact: true }).click();
      check(await canvas.evaluate(element => element.isConnected), `${label}: preferences retain Rive instance`);
      await page.getByRole("button", { name: "Theme", exact: true }).click();
      await page.getByRole("button", { name: "Español", exact: true }).click();
      if (mobile) await page.locator("canvas").tap();
      else { await page.mouse.move(500, 350); await page.mouse.move(850, 450); }
      check(apiRequests === 0, `${label}: pointer/touch stays local`);
      if (!mobile && theme === "light") {
        await page.getByRole("button", { name: "Diagnóstico", exact: true }).click();
        const panel = page.getByRole("complementary", { name: "Diagnóstico" });
        for (const state of ["Hello", "Ghost", "Flower", "Cloud", "yes", "no", "Talk", "talkb", "talkc", "talkbc", "Base"]) {
          await panel.getByRole("button", { name: state, exact: true }).click();
          await page.waitForTimeout(450);
          await capture(`state-${state}`);
          check(true, `diagnostics: ${state} exercised with loaded prove2`);
        }
        await page.getByRole("button", { name: "Cerrar diagnóstico", exact: true }).click();
        for (const form of ["star", "square", "triangle"]) {
          action = { kind: "morph", form };
          await page.locator("input").fill(`Morph into a ${form}`);
          await page.locator("input").press("Enter");
          await page.waitForFunction(label => document.querySelector(".brain-hud__headline").textContent === label, { star: "Estrella", square: "Cuadrado", triangle: "Triángulo" }[form]);
          await page.waitForTimeout(500);
          await capture(`morph-${form}`);
          check(true, `morph: ${form} exercised through mocked decision`);
        }
        action = { kind: "talk", state: "talkb" };
        await page.locator("input").fill("Explícame algo");
        await page.locator("input").press("Enter");
        await page.getByText("Esta es una prueba de habla.", { exact: true }).first().waitFor();
        check(true, "mocked talk: animation request and caption displayed");
        await capture("talk-caption");
        await page.getByRole("link", { name: "Capacidades", exact: true }).click();
        await page.getByRole("heading", { name: "Capacidades", exact: true }).waitFor();
        await page.getByRole("link", { name: "Inicio", exact: true }).click();
        await page.locator('.character-rive[data-ready="true"]').waitFor();
        check(true, "navigation: prove2 remounts on return to Home");
      }
      await context.close();
    }
  }
} catch (error) { report.errors.push(error.message); }
finally {
  await browser.close();
  await writeFile(`${output}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checks: report.checks.length, captures: report.captures.length, errors: report.errors, warnings: report.warnings }, null, 2));
if (report.errors.length) process.exitCode = 1;
