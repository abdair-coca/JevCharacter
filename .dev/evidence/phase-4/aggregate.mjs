import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = ".dev/evidence/phase-4";
const variants = ["desktop", "mobile"].flatMap(device => ["light", "dark"].flatMap(theme => ["es", "en"].map(language => `${device}-${theme}-${language}`)));
const selected = ["desktop-light-es", "desktop-dark-en", "mobile-light-es", "mobile-dark-en"];
const cases = [...variants.map(name => `${name}-layout`), ...selected.flatMap(name => ["controls", "reduced", "cold"].map(part => `${name}-${part}`)), "lifecycle-layout", "isolation-layout", "fallback-layout"];
const reports = await Promise.all(cases.map(async name => JSON.parse(await readFile(`${directory}/results-${name}.json`, "utf8"))));
const sources = reports[0].sources;
const hash = createHash("sha256"); let latest = 0;
for (const path of sources) { hash.update(path); hash.update(await readFile(path)); latest = Math.max(latest, (await stat(path)).mtimeMs); }
const fingerprint = hash.digest("hex");
for (const report of reports) {
  if (report.failure || report.errors.length || !report.checks.length) throw new Error(`Failed or incomplete: ${report.case}/${report.part}`);
  if (report.sourceFingerprint !== fingerprint || Date.parse(report.date) < latest) throw new Error(`Stale report: ${report.case}/${report.part}`);
}
const screenshots = [...new Set(reports.flatMap(report => report.screenshots))];
for (const path of screenshots) await stat(`${directory}/${path}`);
const summary = { status: "PASS", date: new Date().toISOString(), browser: reports[0].browser, conditions: reports[0].conditions, sourceFingerprint: fingerprint, sources, runs: reports.length, checks: reports.reduce((sum, report) => sum + report.checks.length, 0), screenshots, errors: reports.flatMap(report => report.errors), warnings: reports.flatMap(report => report.warnings), expectedResourceErrors: reports.flatMap(report => report.expectedResourceErrors), cases: reports.map(report => ({ case: report.case, part: report.part, checks: report.checks.length })) };
await writeFile(`${directory}/results.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: summary.status, runs: summary.runs, checks: summary.checks, screenshots: screenshots.length, errors: summary.errors.length, warnings: summary.warnings.length, expectedResourceErrors: summary.expectedResourceErrors.length }, null, 2));
