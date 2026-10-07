import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch();
const directory = ".dev/evidence/phase-1/organic-controls";
const result = { date: new Date().toISOString(), browser: browser.version(), checks: [], screenshots: [], contrast: [], errors: [], warnings: [] };
const check = (value, label) => { if (!value) throw new Error(label); result.checks.push(label); };
let activePage;
try {
  for (const mobile of [false, true]) {
    for (const theme of ["light", "dark"]) {
      const label = `${mobile ? "mobile" : "desktop"}-${theme}`;
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: "es", colorScheme: theme, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      activePage = page;
      page.setDefaultTimeout(12000);
      let requests = 0;
      page.on("pageerror", error => result.errors.push(`${label}: ${error.message}`));
      page.on("console", message => { if (message.type() === "error") result.errors.push(message.text()); if (message.type() === "warning") result.warnings.push(message.text()); });
      await page.route("**/api/decide", async route => {
        requests++;
        await new Promise(resolve => setTimeout(resolve, 1600));
        await route.fulfill({ json: { action: { kind: "reaction", reaction: "HELLO" }, actionConfidence: 0.84, reaction: "HELLO", reactionConfidence: 0.84, probabilities: { HELLO: 0.84, BASE: 0.1, FLOWER: 0.04, GHOST: 0.02 }, intensity: 0.6, wantsAttention: 0.75, source: "jev" } });
      });
      await page.route("**/api/talk", route => route.abort());
      await page.goto("http://127.0.0.1:5174/");
      await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
      await page.waitForTimeout(2200);
      const capture = async suffix => {
        const path = `${directory}/${label}-${suffix}.png`;
        await page.screenshot({ path, fullPage: true });
        result.screenshots.push(path);
      };
      const centered = () => page.locator(".whisper").evaluate(element => { const rect = element.getBoundingClientRect(); return Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 1; });
      check(await centered(), `${label}: composer centered independently of HUD`);
      check(await page.evaluate(mobile => {
        const input = document.querySelector(".whisper").getBoundingClientRect();
        const hud = document.querySelector(".brain-hud").getBoundingClientRect();
        return mobile ? hud.bottom <= input.top && Math.abs(hud.right - input.right) < 1 : hud.left > input.right;
      }, mobile), `${label}: HUD ${mobile ? "above and right" : "to the right"}`);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no horizontal overflow`);
      check(await page.locator("input").evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), `${label}: input visible on load`);
      check(await page.locator("canvas").count() === 1, `${label}: single original Rive canvas`);
      const contrast = await page.evaluate(() => {
        const probe = document.createElement("span");
        document.body.append(probe);
        const color = value => { probe.style.color = value; return getComputedStyle(probe).color; };
        const luminance = value => {
          const numbers = value.match(/[\d.]+/g).map(Number);
          const rgb = value.startsWith("color(srgb") ? numbers.slice(0, 3) : numbers.slice(0, 3).map(value => value / 255);
          const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        };
        const ratio = (a, b) => { const x = luminance(color(a)), y = luminance(color(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const backgrounds = ["var(--control-glass)", "var(--color-background-secondary)", "var(--color-surface)"];
        const text = Math.min(...backgrounds.map(bg => ratio("var(--color-muted)", bg)));
        const border = ratio("var(--color-control-edge)", "var(--color-background)");
        probe.remove();
        return { text, border };
      });
      result.contrast.push({ label, ...contrast });
      check(contrast.text >= 4.5 && contrast.border >= 3, `${label}: control text and boundary contrast meet AA targets`);
      await page.waitForFunction(() => [...document.querySelectorAll(".organic-light")].every(element => element.dataset.running === "true"));
      const before = await page.locator(".whisper-shell .organic-light__bloom").evaluate(element => getComputedStyle(element).transform);
      await page.waitForTimeout(250);
      const after = await page.locator(".whisper-shell .organic-light__bloom").evaluate(element => getComputedStyle(element).transform);
      check(before !== after, `${label}: real idle breathing animates`);
      const pulseTiming = () => page.locator(".brain-hud .organic-light__bloom").evaluate(element => {
        const animation = element.getAnimations().find(animation => animation.effect.getTiming().iterations === Infinity);
        return animation ? { duration: animation.effect.getTiming().duration, peak: Math.max(...animation.effect.getKeyframes().map(frame => Number(frame.opacity))) } : null;
      });
      const idlePulse = await pulseTiming();
      check(idlePulse?.duration === 4800, `${label}: idle duration follows breathing token`);
      await capture("idle-es");
      const canvas = await page.locator("canvas").elementHandle();
      await page.locator("input").fill("Hola Jev, me gusta estar aquí");
      await page.waitForTimeout(350);
      check(await centered(), `${label}: focus scale preserves composer center`);
      await capture("focus-es");
      await page.getByRole("button", { name: "English", exact: true }).click();
      check(await page.locator("input").inputValue() === "Hola Jev, me gusta estar aquí", `${label}: language preserves draft`);
      check(await canvas.evaluate(element => element.isConnected), `${label}: preferences preserve character`);
      await page.locator(".brain-hud__summary").click();
      await page.waitForTimeout(600);
      check(await page.getByText("Reaction probabilities", { exact: true }).isVisible(), `${label}: HUD expanded and localized`);
      check(await centered(), `${label}: expanded HUD does not shift composer horizontally`);
      await capture("expanded-en");
      await page.locator(".brain-hud__summary").click();
      await page.waitForTimeout(400);
      check(await page.locator("#brain-details").count() === 0, `${label}: closing HUD unmounts details`);
      await page.getByRole("button", { name: "Español", exact: true }).click();
      await page.locator("input").fill("   ");
      await page.locator("input").press("Enter");
      check(requests === 0, `${label}: blank input and controls do not call AI`);
      await page.locator("input").fill("Hola Jev");
      await page.locator("input").press("Enter");
      await page.waitForFunction(() => document.querySelector(".whisper-wrap").dataset.activity === "deciding");
      check(await page.locator(".brain-hud").getAttribute("data-activity") === "deciding", `${label}: both controls follow real deciding state`);
      await page.waitForTimeout(100);
      check((await pulseTiming())?.duration === 1600, `${label}: deciding actually accelerates breathing`);
      await capture("deciding-es");
      await page.waitForFunction(() => document.querySelector(".brain-hud__headline").textContent === "Saluda");
      check((await page.locator(".brain-hud__confidence").textContent()).includes("84"), `${label}: exact returned confidence, not synthetic progress`);
      check((await pulseTiming())?.peak > idlePulse.peak, `${label}: returned attention actually modulates aura`);
      check(await page.locator("input").inputValue() === "", `${label}: submission clears draft`);
      await page.getByRole("button", { name: "Borrar contexto", exact: true }).click();
      await page.waitForTimeout(1800);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForFunction(() => [...document.querySelectorAll(".organic-light")].every(element => element.dataset.running === "false"));
      check(true, `${label}: simulated background event suspends control breathing`);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => [...document.querySelectorAll(".organic-light")].every(element => element.dataset.running === "false"));
      const stillA = await page.locator(".organic-light__bloom").first().evaluate(element => getComputedStyle(element).transform);
      await page.waitForTimeout(250);
      check(stillA === await page.locator(".organic-light__bloom").first().evaluate(element => getComputedStyle(element).transform), `${label}: reduced motion is actually static`);
      await page.locator(".brain-hud__summary").focus();
      await page.keyboard.press("Enter");
      check(await page.locator("#brain-details").isVisible(), `${label}: keyboard and reduced-motion expansion`);
      if (mobile) {
        await page.setViewportSize({ width: 320, height: 568 });
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: narrow reflow`);
        await page.setViewportSize({ width: 390, height: 420 });
        await page.locator("input").scrollIntoViewIfNeeded();
        check(await page.locator("input").evaluate(element => { const r = element.getBoundingClientRect(); return r.top >= 120 && r.bottom <= innerHeight; }), `${label}: input reachable with simulated keyboard viewport`);
      }
      await page.getByRole("link", { name: "Capacidades", exact: true }).click();
      await page.getByRole("heading", { name: "Capacidades", exact: true }).waitFor();
      check(await page.locator(".organic-light").count() === 0, `${label}: navigation removes animated controls`);
      await context.close();
    }
  }
} catch (error) {
  result.errors.push(error.message);
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${directory}/diagnostic-failure.png`, fullPage: true });
    result.errors.push(await activePage.evaluate(() => `${location.href}\n${document.body.innerText}`));
  }
}
finally {
  await browser.close();
  await writeFile(`${directory}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(JSON.stringify({ checks: result.checks.length, screenshots: result.screenshots.length, errors: result.errors, warnings: result.warnings }, null, 2));
if (result.errors.length) process.exitCode = 1;
