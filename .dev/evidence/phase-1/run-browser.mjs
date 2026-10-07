import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { runInThisContext } from "node:vm";
import { setTimeout as delay } from "node:timers/promises";

// Standalone recovery/reproduction of the same MCP harness; API remains mocked.
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
try {
  const source = await readFile(".dev/evidence/phase-1/browser-check.js", "utf8");
  const verify = runInThisContext(`(${source})`);
  await verify(page);
  const started = Date.now();
  while (!page.__phase1Done) {
    if (Date.now() - started > 240000) throw new Error("Browser harness timeout");
    await delay(500);
  }
  const result = { date: new Date().toISOString(), browser: browser.version(), ...page.__phase1Report };
  await writeFile(".dev/evidence/phase-1/browser-results.json", `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ checks: result.checks.length, screenshots: result.screenshots.length, errors: result.errors, warnings: result.warnings, failures: result.failures }, null, 2));
  if (result.errors.length || result.failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
