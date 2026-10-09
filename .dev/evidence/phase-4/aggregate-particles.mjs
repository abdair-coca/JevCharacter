import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const folder = ".dev/evidence/phase-4";
const cases = ["desktop-light-es", "desktop-dark-en", "mobile-light-es", "mobile-dark-en"];
const files = [...cases.flatMap(name => ["images", "finale"].map(block => `particles-${name}-${block}.json`)), ...["reduced", "fallback", "lifecycle"].map(name => `particles-${name}-checks.json`)];
const reports = await Promise.all(files.map(file => readFile(`${folder}/${file}`, "utf8").then(JSON.parse)));
const hash = createHash("sha256");
for (const file of reports[0].sources) { hash.update(file); hash.update(await readFile(file)); }
const fingerprint = hash.digest("hex");
for (const report of reports) {
  if (report.failure || report.errors.length || report.fingerprint !== fingerprint) throw new Error(`Incomplete or stale ${report.case}/${report.block}`);
  for (const file of report.screenshots) await stat(`${folder}/${file}`);
}
const result = {
  date: new Date().toISOString(), fingerprint, reports: files,
  checks: reports.reduce((sum, report) => sum + report.checks.length, 0),
  screenshots: reports.flatMap(report => report.screenshots),
  errors: reports.flatMap(report => report.errors),
  expectedErrors: reports.flatMap(report => report.expectedErrors),
  warnings: reports.flatMap(report => report.warnings),
  timings: reports.flatMap(report => report.measurements.filter(measurement => measurement.timing).map(measurement => ({ case: report.case, block: report.block, ...measurement }))),
  conditions: "Chromium 153 production preview, desktop Windows host; viewport, touch, visibility, DPR and reduced motion emulated. No physical mobile, Safari, LCP or real AI calls.",
};
await writeFile(`${folder}/particles-results.json`, JSON.stringify(result, null, 2));
console.log(`PASS ${files.length} blocks, ${result.checks} checks, ${result.screenshots.length} captures, ${result.errors.length} unexpected errors`);
