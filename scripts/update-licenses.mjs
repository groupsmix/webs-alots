#!/usr/bin/env node
/**
 * FR-30: Regenerate THIRD_PARTY_LICENSES.md from the current dependency tree.
 *
 * Usage:
 *   npx tsx scripts/update-licenses.mjs
 *
 * Requires: license-checker (auto-installed via npx)
 *   npx license-checker --production --csv > /tmp/licenses.csv
 *
 * Then this script reads the CSV and writes THIRD_PARTY_LICENSES.md.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const csv = execSync("npx -y license-checker --production --csv", {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

const lines = csv.trim().split("\n");
const rows = lines.slice(1);

const output = [
  "# Third-Party Licenses",
  "",
  `> Auto-generated on ${new Date().toISOString().split("T")[0]} by \`scripts/update-licenses.mjs\`.`,
  "> Do not edit manually. Re-run the script after dependency changes.",
  "",
  "| Package | License | Repository |",
  "| ------- | ------- | ---------- |",
];

for (const row of rows) {
  const parts = row.split('","').map((s) => s.replace(/^"|"$/g, ""));
  const name = parts[0] ?? "";
  const license = parts[1] ?? "";
  const repo = parts[2] ?? "";
  if (name) {
    output.push(`| ${name} | ${license} | ${repo} |`);
  }
}

output.push("");

writeFileSync("THIRD_PARTY_LICENSES.md", output.join("\n"));
console.log(`Written ${rows.length} entries to THIRD_PARTY_LICENSES.md`);
