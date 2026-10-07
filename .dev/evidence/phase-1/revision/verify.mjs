import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const report = { date: new Date().toISOString(), browser: browser.version(), checks: [], errors: [], warnings: [], screenshots: [] };
const output = ".dev/evidence/phase-1/revision";
function check(value, label) {
  if (!value) throw new Error(label);
  report.checks.push(label);
}
try {
  for (const mobile of [false, true]) {
    for (const theme of ["light", "dark"]) {
      const label = `${mobile ? "mobile" : "desktop"}-${theme}`;
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: "es", colorScheme: theme, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      let requests = 0;
      page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
      page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); if (message.type() === "warning") report.warnings.push(message.text()); });
      await page.route("**/api/**", route => { requests++; return route.fulfill({ json: { unavailable: true } }); });
      await page.goto("http://127.0.0.1:5174");
      await page.locator('.character-rive[data-ready="true"]').waitFor();
      await page.waitForTimeout(2100);
      check(await page.locator("canvas").count() === 1, `${label}: single direct Rive canvas`);
      check(await page.locator("select").count() === 0, `${label}: no system dropdown`);
      const initial = await page.evaluate(() => {
        const input = document.querySelector(".whisper").getBoundingClientRect();
        const hud = document.querySelector(".brain-hud").getBoundingClientRect();
        const character = document.querySelector(".creature-presence").getBoundingClientRect();
        const styles = getComputedStyle(document.querySelector(".character-rive"));
        return { center: input.x + input.width / 2, pageCenter: innerWidth / 2, input: input.toJSON(), hud: hud.toJSON(), character: character.toJSON(), mask: styles.maskImage, scale: getComputedStyle(document.documentElement).getPropertyValue("--character-canvas-scale"), width: document.documentElement.scrollWidth, height: innerHeight, theme: document.documentElement.dataset.theme };
      });
      check(Math.abs(initial.center - initial.pageCenter) < 1, `${label}: input centered independently of HUD`);
      check(Math.abs(initial.character.width - initial.character.height) < 1, `${label}: proportional square character wrapper`);
      check(initial.mask.includes("radial-gradient") && Number(initial.scale) === 1.72, `${label}: original radial mask and 1.72 scale`);
      check(initial.theme === theme, `${label}: automatic system theme`);
      check(initial.width <= (mobile ? 390 : 1440), `${label}: no horizontal overflow`);
      check(initial.input.bottom <= initial.height, `${label}: input visible`);
      check(mobile ? initial.hud.bottom <= initial.input.top && Math.abs(initial.hud.right - initial.input.right) < 1 : initial.hud.left > initial.input.right, `${label}: HUD ${mobile ? "above and right" : "to the right"}`);
      const canvas = await page.locator("canvas").elementHandle();
      for (const language of ["es", "en"]) {
        await page.getByRole("button", { name: language === "es" ? "Español" : "English", exact: true }).click();
        await page.waitForTimeout(350);
        const file = `${output}/${label}-${language}.png`;
        await page.screenshot({ path: file, fullPage: true });
        report.screenshots.push(file);
      }
      await page.locator("input").fill("Borrador conservado");
      const toggle = page.getByRole("button", { name: "Theme", exact: true });
      await toggle.focus();
      await page.keyboard.press("Space");
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme === "light" ? "dark" : "light");
      check(await canvas.evaluate(element => element.isConnected), `${label}: toggle does not remount character`);
      check(await page.locator("input").inputValue() === "Borrador conservado", `${label}: toggle preserves draft`);
      check(await toggle.evaluate(element => element === document.activeElement), `${label}: keyboard toggle preserves focus`);
      await page.getByRole("button", { name: "Español", exact: true }).click();
      check(await page.locator("input").inputValue() === "Borrador conservado", `${label}: ES/EN preserves draft`);
      await page.locator(".brain-hud__summary").click();
      check(await page.locator("#brain-details").isVisible(), `${label}: expanded HUD reachable`);
      await page.reload();
      check(await page.evaluate(() => document.documentElement.lang === "es" && JSON.parse(localStorage.getItem("jevling.theme")) === document.documentElement.dataset.theme), `${label}: language and manual theme persist`);
      await page.emulateMedia({ colorScheme: theme });
      check(await page.evaluate(() => document.documentElement.dataset.theme) !== theme, `${label}: manual override ignores later system change`);
      check(requests === 0, `${label}: presentation controls never invoke AI`);
      if (mobile) {
        await page.locator("canvas").tap();
        check(requests === 0, `${label}: canvas touch remains local`);
        await page.setViewportSize({ width: 390, height: 420 });
        await page.locator("input").scrollIntoViewIfNeeded();
        check(await page.locator("input").evaluate(element => { const r = element.getBoundingClientRect(); return r.top >= 120 && r.bottom <= innerHeight; }), `${label}: short viewport input reachable`);
        await page.setViewportSize({ width: 320, height: 568 });
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: 320px reflow`);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.getByRole("button", { name: "Tema", exact: true }).click();
        await page.getByRole("button", { name: "English", exact: true }).click();
        check(await page.getByRole("button", { name: "English", exact: true }).getAttribute("aria-pressed") === "true", `${label}: reduced-motion controls work`);
      }
      await context.close();
    }
  }
} catch (error) {
  report.errors.push(error.message);
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors, warnings: report.warnings, screenshots: report.screenshots.length }, null, 2));
if (report.errors.length) process.exitCode = 1;
