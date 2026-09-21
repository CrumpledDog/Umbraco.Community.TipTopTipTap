// Appends a pass/fail table for this run to the GitHub Actions job summary, using the
// "json" reporter's output. Schema confirmed by running a throwaway Playwright test and
// inspecting the real output - Playwright's own docs don't publish the exact shape:
// { suites: [ { title, specs: [ { title, ok, tests: [ { results: [ { status, duration } ] } ] } ],
//              suites: [ ...nested... ] } ] }
import fs from "node:fs";

const resultsPath = "results.json";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!fs.existsSync(resultsPath)) {
  console.log(`No ${resultsPath} found - skipping job summary.`);
  process.exit(0);
}
if (!summaryPath) {
  console.log("GITHUB_STEP_SUMMARY is not set - skipping job summary.");
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

const rows = [];
function walk(suite, titlePath) {
  for (const spec of suite.specs ?? []) {
    const lastResults = (spec.tests ?? []).map((t) => t.results?.at(-1)).filter(Boolean);
    const durationMs = lastResults.reduce((sum, r) => sum + (r.duration ?? 0), 0);
    rows.push({
      title: [...titlePath, spec.title].join(" › "),
      ok: spec.ok !== false,
      durationSeconds: (durationMs / 1000).toFixed(1),
    });
  }
  for (const child of suite.suites ?? []) {
    walk(child, suite.title ? [...titlePath, suite.title] : titlePath);
  }
}
for (const suite of data.suites ?? []) walk(suite, []);

const passed = rows.filter((r) => r.ok).length;
const failed = rows.length - passed;

const lines = [
  "## Playwright E2E Results",
  "",
  failed === 0 ? `**${passed}/${rows.length} passed** ✅` : `**${passed} passed, ${failed} failed** out of ${rows.length}`,
  "",
  "| Status | Test | Duration |",
  "| --- | --- | --- |",
  ...rows.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.title} | ${r.durationSeconds}s |`),
  "",
];

fs.appendFileSync(summaryPath, lines.join("\n"));
console.log(`Wrote summary for ${rows.length} test(s) to GITHUB_STEP_SUMMARY.`);
