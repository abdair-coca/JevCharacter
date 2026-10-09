import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://jev-bot-sigma.vercel.app";
const report = { date: new Date().toISOString(), base, checks: [], responses: [], errors: [] };
const check = (ok, label) => { assert(ok, label); report.checks.push(label); console.log(`PASS ${label}`); };
for (const path of ["/", "/features", "/about"]) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) });
  check(response.status === 200, `${path}: direct load HTTP 200`);
  await response.body?.cancel();
}
for (const name of ["decide", "talk"]) {
  const response = await fetch(`${base}/api/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20000) });
  check(response.status === 400, `${name}: live function rejects invalid input before provider`);
  await response.body?.cancel();
}
const browser = await chromium.launch();
const timeout = setTimeout(() => { void browser.close(); }, 60000);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es" });
  await context.addInitScript(() => localStorage.setItem("jevling.language", JSON.stringify("es")));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
  await page.goto(base);
  await page.locator('.character-rive[data-ready="true"]').waitFor({ timeout: 45000 });
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/decide" && response.request().method() === "POST");
  await page.locator("#creature-context").fill("Hola Jev");
  await page.locator("#creature-context").press("Enter");
  const response = await responsePromise;
  const decision = await response.json();
  report.responses.push({ status: response.status(), decision });
  check(response.status() === 200 && decision.source === "jev", "Home receives a real remote decision (source jev)");
  check(typeof decision.action?.kind === "string" && Number.isFinite(decision.actionConfidence), "remote decision has a typed action and confidence");
  await page.locator(".brain-hud__signal--online").waitFor();
  check(await page.locator(".brain-hud__source-label").textContent() === "Decisión de Jev", "HUD reflects the remote source");
  check(await page.locator(".home-page canvas").count() === 1, "one existing character handles remote decision");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: fileURLToPath(new URL("remote-decision.png", import.meta.url)) });
  check(report.errors.length === 0, "zero application or console errors");
  await writeFile(new URL("results.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(`PASS: ${report.checks.length} checks with live production provider`);
} finally {
  clearTimeout(timeout);
  await browser.close();
}
