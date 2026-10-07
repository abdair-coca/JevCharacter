import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const directory = ".dev/evidence/phase-3";
const variants = ["desktop-light-es", "desktop-light-en", "desktop-dark-es", "desktop-dark-en", "mobile-light-es", "mobile-light-en", "mobile-dark-es", "mobile-dark-en"];
const selected = ["desktop-light-es", "desktop-dark-en", "mobile-light-es", "mobile-dark-en"];
const cases = [
  ...variants.map(name => `results-${name}-layout.json`),
  ...selected.flatMap(name => ["controls", "reduced"].map(part => `results-${name}-${part}.json`)),
  ...Array.from({ length: 8 }, (_, index) => `results-desktop-light-es-action-${index}.json`),
  "results-desktop-light-es-scroll.json", "results-desktop-light-es-lifecycle.json",
  "results-desktop-light-es-navigation.json", "results-mobile-dark-en-navigation.json", "results-isolation.json",
];
const sources = [
  "package.json", "package-lock.json", "src/App.tsx", "src/components/Character.tsx", "src/styles/tokens.css",
  "src/pages/FeaturesPage.tsx", "src/features/presentation/scrollRuntime.ts",
  "src/features/showcase/catalog.ts", "src/features/showcase/player.ts", "src/features/showcase/useShowcasePlayer.ts",
  "src/features/showcase/useShowcaseScroll.ts", "src/features/showcase/useStageVisibility.ts", "src/features/showcase/showcase.css",
];
const sourceStats = await Promise.all(sources.map(path => stat(path)));
const latestSource = Math.max(...sourceStats.map(info => info.mtimeMs));
const hash = createHash("sha256");
for (const path of sources) { hash.update(path); hash.update(await readFile(path)); }
const reports = [];
for (const filename of cases) {
  const report = JSON.parse(await readFile(`${directory}/${filename}`, "utf8"));
  if (report.failure || report.errors.length || !report.checks.length) throw new Error(`Failed/incomplete case: ${filename}`);
  if (Date.parse(report.date) < latestSource) throw new Error(`Case predates final source: ${filename}`);
  reports.push({ filename, ...report });
}
const screenshots = [...new Set(reports.flatMap(report => report.screenshots))];
for (const filename of screenshots) await stat(`${directory}/${filename}`);
const summary = {
  date: new Date().toISOString(), status: "PASS", conditions: reports[0].conditions, browser: reports[0].browser,
  sourceFingerprint: hash.digest("hex"), sourceFiles: sources, allCasesAfterLastSourceChange: true,
  runs: reports.length, checks: reports.reduce((total, report) => total + report.checks.length, 0),
  screenshots, errors: reports.flatMap(report => report.errors), warnings: reports.flatMap(report => report.warnings),
  expectedResourceErrors: reports.flatMap(report => report.expectedResourceErrors),
  cases: reports.map(report => ({ file: report.filename, checks: report.checks.length, case: report.case, part: report.part })),
};
await writeFile(`${directory}/results.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: summary.status, runs: summary.runs, checks: summary.checks, screenshots: screenshots.length, errors: summary.errors.length, warnings: summary.warnings.length, expectedResourceErrors: summary.expectedResourceErrors.length }, null, 2));
