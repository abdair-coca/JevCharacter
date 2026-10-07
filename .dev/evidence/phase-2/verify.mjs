import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";

const directory = ".dev/evidence/phase-2";
const report = { date: new Date().toISOString(), checks: [], errors: [], warnings: [], expectedNetworkErrors: [], screenshots: [], conditions: "Chromium production preview; local HTTP/SSE fixtures, no provider calls; mobile/visibility simulated" };
const records = [];
const openResponses = new Set();
const heldStart = new Map();
const heldCompletion = new Map();
const server = createServer((request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  void (async () => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const record = { path: request.url, body, aborted: false, completed: false };
    records.push(record);
    openResponses.add(response);
    const timers = new Set();
    response.on("close", () => {
      record.aborted = !record.completed;
      for (const timer of timers) clearTimeout(timer);
      openResponses.delete(response);
      heldStart.delete(record);
      heldCompletion.delete(record);
    });
    const later = (callback, milliseconds) => {
      const timer = setTimeout(() => { timers.delete(timer); if (!response.destroyed) callback(); }, milliseconds);
      timers.add(timer);
    };
    const json = (data, status = 200) => {
      record.completed = true;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    };
    if (request.url === "/api/decide") {
      const message = body.state.userContext;
      const decide = () => {
        if (message === "LOCAL") { json({ unavailable: true }); return; }
        const action = !message
          ? { kind: "reaction", reaction: "BASE" }
          : message.includes("MORPH") ? { kind: "morph", form: "triangle" }
          : message.includes("YES") ? { kind: "answer", answer: "yes" }
          : { kind: "talk", state: "talkb" };
        json({ action, actionConfidence: 0.91, reaction: "BASE", reactionConfidence: 0.91, probabilities: { BASE: 0.91, HELLO: 0.04, GHOST: 0.02, FLOWER: 0.03 }, intensity: 0.5, wantsAttention: 0.4, source: "jev" });
      };
      later(decide, message.includes("DECISION-WAIT") ? 3000 : 80);
      return;
    }
    if (request.url !== "/api/talk") { json({ error: "unknown route" }, 404); return; }
    if (body.message.includes("HTTP-FAIL")) { json({ error: "Speech unavailable" }, 503); return; }
    if (body.message.includes("NETWORK-FAIL")) { response.destroy(); return; }
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
    response.flushHeaders();
    const emit = (event, payload) => response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    const begin = () => {
      emit("delta", { text: body.language === "en" ? "Hello " : "Hola " });
      const finish = () => {
        if (body.message.includes("SSE-FAIL")) emit("error", {});
        else {
          emit("delta", { text: body.language === "en" ? "from the test." : "desde la prueba." });
          emit("done", {});
        }
        record.completed = true;
        response.end();
      };
      if (body.message === "STREAM-LOCALE") heldCompletion.set(record, finish);
      else later(finish, ["STREAM-NAV", "STREAM-TAB"].includes(body.message) ? 8000 : body.message.includes("STREAM") ? 2200 : 150);
    };
    if (body.message === "WAIT-FIRST") heldStart.set(record, begin);
    else later(begin, 10);
  })().catch(error => {
    report.errors.push(`fixture: ${error.message}`);
    if (!response.destroyed) response.end();
  });
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const fixtureOrigin = `http://127.0.0.1:${server.address().port}`;
let browser;
const check = (condition, label) => { if (!condition) throw new Error(label); report.checks.push(label); };
const wait = async (predicate, label, timeout = 10000) => {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error(label); await new Promise(resolve => setTimeout(resolve, 30)); }
};
const talks = (message) => records.filter(record => record.path === "/api/talk" && (!message || record.body.message === message));
let activePage;
async function open({ mobile = false, theme = "light", language = "es", path = "/", expectedFailure = false } = {}) {
  // Isolate test cases at the process boundary so discarded WASM/GPU contexts
  // do not accumulate under the host's memory pressure. Navigation within each
  // case still exercises the same persistent Home/Rive instance.
  if (browser) await browser.close();
  browser = await chromium.launch();
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: language, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(() => {
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.__phase2Frames = 0;
    window.requestAnimationFrame = callback => { window.__phase2Frames++; return nativeFrame(callback); };
  });
  await context.route("**/api/**", route => route.continue({ url: `${fixtureOrigin}${new URL(route.request().url()).pathname}` }));
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") (expectedFailure && /Failed to load resource/.test(message.text()) ? report.expectedNetworkErrors : report.errors).push(message.text());
    if (message.type() === "warning") report.warnings.push(message.text());
  });
  await page.goto(`http://127.0.0.1:5174${path}`);
  if (path === "/") await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  return { page, context };
}
async function submit(page, message) {
  await page.getByRole("textbox").fill(message);
  await page.getByRole("textbox").press("Enter");
}
async function capture(page, name) {
  const path = `${directory}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}

try {
  // Streaming replacement and bounded, untranslated history.
  {
    const { page, context } = await open();
    await submit(page, "STREAM-LOCALE");
    await page.waitForFunction(() => document.querySelector(".speech-caption")?.textContent.includes("Hola"));
    await page.getByRole("button", { name: "English", exact: true }).click();
    await wait(() => talks("STREAM-LOCALE").length === 2, "replacement speech request");
    check(talks("STREAM-LOCALE")[1].body.language === "en", "language: replacement request explicitly sends en");
    await wait(() => talks("STREAM-LOCALE")[0].aborted, "old SSE disconnected");
    check(true, "language: switching cancels the real HTTP/SSE reader");
    await wait(() => heldCompletion.has(talks("STREAM-LOCALE")[1]), "replacement ready to complete");
    heldCompletion.get(talks("STREAM-LOCALE")[1])();
    await page.getByText("Hello from the test.", { exact: true }).first().waitFor();
    check(await page.locator(".speech-caption").getAttribute("lang") === "en", "language: caption carries the generation locale");
    check(!(await page.locator(".speech-caption").textContent()).includes("Hola"), "language: no mixed fragments");
    await capture(page, "english-reply");
    const completedCount = talks().length;
    await page.getByRole("button", { name: "Español", exact: true }).click();
    check(await page.locator(".speech-caption").getAttribute("lang") === "en", "language: completed reply is not translated retroactively");
    check(talks().length === completedCount, "language: completed reply does not regenerate");
    await submit(page, "NEXT-MESSAGE");
    await wait(() => talks("NEXT-MESSAGE").length === 1, "next speech");
    check(JSON.stringify(talks("NEXT-MESSAGE")[0].body.history) === JSON.stringify([{ user: "STREAM-LOCALE", assistant: "Hello from the test." }]), "history: original message + one completed replacement only");
    await page.getByText("Hola desde la prueba.", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Borrar conversación", exact: true }).click();
    await page.waitForTimeout(150);
    await submit(page, "AFTER-CLEAR");
    await wait(() => talks("AFTER-CLEAR").length === 1, "speech after clear");
    check(talks("AFTER-CLEAR")[0].body.history.length === 0, "clear: all conversation history removed");
    check(await page.evaluate(() => !localStorage.getItem("jevling.context") && !Object.entries(localStorage).some(([key, value]) => key.includes("history") || value.includes("STREAM-LOCALE"))), "storage: messages and replies not persisted");
    await context.close();
  }

  // Home retains identity/UI while network, timers and render frames suspend.
  {
    const { page, context } = await open({ theme: "dark" });
    await submit(page, "COMPLETED-BEFORE-NAV");
    await page.getByText("Hola desde la prueba.", { exact: true }).first().waitFor();
    await submit(page, "STREAM-NAV");
    await wait(() => talks("STREAM-NAV").length === 1, "navigation stream started");
    await page.waitForFunction(() => document.querySelector(".speech-caption")?.textContent.includes("Hola"));
    await page.getByRole("textbox").fill("Borrador conservado");
    await page.locator(".brain-hud__summary").click();
    const canvas = await page.locator("canvas").elementHandle();
    await page.getByRole("link", { name: "Capacidades", exact: true }).click();
    await page.getByRole("heading", { name: "Capacidades", exact: true }).waitFor();
    check(await canvas.evaluate(element => element.isConnected), "navigation: canvas stays mounted");
    check(await page.locator(".home-session").getAttribute("hidden") !== null && await page.locator(".home-session").getAttribute("inert") !== null, "navigation: hidden Home inaccessible and inert");
    check(await page.getByRole("textbox").count() === 0, "navigation: hidden input absent from accessible controls");
    await wait(() => talks("STREAM-NAV")[0].aborted, "navigation aborts SSE");
    const count = records.length;
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.waitForTimeout(1200);
    const frames = await page.evaluate(() => window.__phase2Frames);
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.__phase2Frames) === frames, "navigation: no main-window animation frames while Home is hidden");
    check(records.length === count, "navigation: hidden Home and locale changes make no API calls");
    await capture(page, "features-home-suspended");
    await page.goBack();
    await page.getByRole("textbox", { name: "Give Jev context" }).waitFor();
    check(await page.getByRole("textbox").inputValue() === "Borrador conservado", "history back: Home session retained");
    await page.goForward();
    await page.getByRole("heading", { name: "Features", exact: true }).waitFor();
    check(await page.getByRole("textbox").count() === 0, "history forward: Home suspended again");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("textbox", { name: "Give Jev context" }).waitFor();
    check(await page.getByRole("textbox").inputValue() === "Borrador conservado", "navigation: draft retained");
    check(await page.locator(".brain-hud__summary").getAttribute("aria-expanded") === "true", "navigation: HUD expansion retained");
    check(await canvas.evaluate(element => element === document.querySelector("canvas")), "navigation: same Rive canvas on return");
    check(await page.locator(".speech-caption").count() === 0, "navigation: obsolete reply is not replayed");
    await page.waitForTimeout(700);
    check(records.length === count, "navigation: returning from an internal route does not request AI");
    await submit(page, "AFTER-RETURN");
    await wait(() => talks("AFTER-RETURN").length === 1, "speech on return");
    check(talks("AFTER-RETURN")[0].body.language === "en", "navigation: new reply uses selected locale");
    check(JSON.stringify(talks("AFTER-RETURN")[0].body.history) === JSON.stringify([{ user: "COMPLETED-BEFORE-NAV", assistant: "Hola desde la prueba." }]), "navigation: completed history retained, aborted text excluded");
    await context.close();
  }

  // Visibility before first SSE text + rapid language changes.
  {
    const { page, context } = await open();
    await submit(page, "WAIT-FIRST");
    await wait(() => talks("WAIT-FIRST").length === 1, "first pending speech");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await wait(() => talks("WAIT-FIRST").length === 2, "second pending speech");
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await wait(() => talks("WAIT-FIRST").length === 3, "third pending speech");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await wait(() => talks("WAIT-FIRST").length === 4, "fourth pending speech");
    await wait(() => talks("WAIT-FIRST").slice(0, -1).every(record => record.aborted), "superseded speech disconnected");
    await wait(() => heldStart.has(talks("WAIT-FIRST")[3]), "latest generation ready");
    heldStart.get(talks("WAIT-FIRST")[3])();
    await page.getByText("Hello from the test.", { exact: true }).first().waitFor();
    check(talks("WAIT-FIRST").slice(0, -1).every(record => record.aborted), "rapid language changes: every superseded request aborted");
    check(talks("WAIT-FIRST").every(record => record.body.history.length === 0), "rapid changes: no duplicate or partial history");
    await submit(page, "STREAM-TAB");
    await page.waitForFunction(() => document.querySelector(".speech-caption")?.textContent.includes("Hello"));
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await wait(() => talks("STREAM-TAB")[0].aborted, "tab hide aborts SSE");
    check(await page.locator(".character-rive").getAttribute("data-active") === "false", "tab: character suspended");
    const count = records.length;
    await page.waitForTimeout(1200);
    check(records.length === count, "tab: no hidden API activity");
    await page.evaluate(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForFunction(() => document.querySelector(".character-rive").dataset.active === "true");
    check(talks("STREAM-TAB").length === 1 && await page.locator(".speech-caption").count() === 0, "tab: resume without an obsolete speech restart");
    await context.close();
  }

  // Decision cancellation and failure states in both locales.
  {
    const { page, context } = await open({ language: "en", expectedFailure: true });
    await submit(page, "DECISION-WAIT");
    await wait(() => records.some(record => record.path === "/api/decide" && record.body.state.userContext === "DECISION-WAIT"), "pending decision");
    await page.getByRole("link", { name: "About", exact: true }).click();
    await page.getByRole("heading", { name: "About", exact: true }).waitFor();
    await page.waitForTimeout(3300);
    check(talks("DECISION-WAIT").length === 0, "decision: leaving Home prevents stale decision from starting speech");
    check(records.find(record => record.body.state?.userContext === "DECISION-WAIT").aborted, "decision: network request aborted on navigation");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await submit(page, "HTTP-FAIL");
    await page.getByText("Speech is unavailable. Please try again.", { exact: true }).waitFor();
    check(await page.locator(".speech-caption").count() === 0, "HTTP failure: status instead of an invented answer");
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.getByText("El habla no está disponible. Inténtalo de nuevo.", { exact: true }).waitFor();
    check(true, "HTTP failure: notice localized to Spanish without another request");
    await capture(page, "speech-unavailable-es");
    await submit(page, "SSE-FAIL");
    await page.getByText("El habla no está disponible. Inténtalo de nuevo.", { exact: true }).waitFor();
    check(await page.locator(".speech-caption").count() === 0, "SSE failure: partial text discarded");
    await submit(page, "NETWORK-FAIL");
    await page.getByText("El habla no está disponible. Inténtalo de nuevo.", { exact: true }).waitFor();
    check(await page.locator(".speech-caption").count() === 0, "network failure: disconnected speech becomes localized status");
    await submit(page, "LOCAL");
    await page.getByText("Instinto local", { exact: true }).waitFor();
    check(talks("LOCAL").length === 0, "decision unavailable: local reaction without fake speech");
    await context.close();
  }

  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) for (const language of ["es", "en"]) {
    const label = `${mobile ? "mobile" : "desktop"}-${theme}-${language}`;
    const { page, context } = await open({ mobile, theme, language });
    await page.waitForTimeout(2100);
    check(await page.getByRole("textbox").getAttribute("maxlength") === "280", `${label}: input limit`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: responsive reflow`);
    check(await page.locator(".whisper").evaluate(element => { const box = element.getBoundingClientRect(); return Math.abs(box.x + box.width / 2 - innerWidth / 2) < 1; }), `${label}: approved composition preserved`);
    await capture(page, label);
    await context.close();
  }
  {
    const { page, context } = await open({ path: "/features" });
    check(await page.locator(".home-session").count() === 0 && await page.locator("canvas").count() === 0, "direct link: Features does not initialize Home runtime");
    await context.close();
  }
} catch (error) {
  report.errors.push(error.message);
  if (activePage && !activePage.isClosed()) {
    try {
      await capture(activePage, "diagnostic-failure");
      report.errors.push(await activePage.evaluate(() => `${location.href}\n${document.body.innerText}`));
    } catch (diagnosticError) { report.errors.push(`diagnostic: ${diagnosticError.message}`); }
  }
} finally {
  await browser?.close();
  for (const response of openResponses) response.destroy();
  await new Promise(resolve => server.close(resolve));
  await writeFile(`${directory}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, errors: report.errors, warnings: report.warnings, expectedNetworkErrors: report.expectedNetworkErrors }, null, 2));
if (report.errors.length) process.exitCode = 1;
