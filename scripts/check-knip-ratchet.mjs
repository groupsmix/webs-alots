#!/usr/bin/env node
/**
 * CI guard: knip dead-code ratchet.
 *
 * Runs knip in JSON reporter mode, counts the number of unused files
 * reported, and compares against .knip-baseline (a plain integer).
 *
 * The baseline is a monotonic ratchet: a PR may lower it (by removing
 * dead code) but never raise it. This prevents new dead code from
 * accumulating while the existing backlog is cleaned up.
 *
 * Lower the baseline number whenever you remove dead files to lock in
 * the gain.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASELINE_PATH = ".knip-baseline";

// Read the current baseline (a plain integer in the file).
const baselineRaw = readFileSync(BASELINE_PATH, "utf8").trim();
const baseline = parseInt(baselineRaw, 10);
if (Number.isNaN(baseline)) {
  console.error(`::error::Could not parse .knip-baseline as a number (got "${baselineRaw}")`);
  process.exit(1);
}

// Run knip with JSON reporter. knip exits non-zero when it finds issues,
// so we must tolerate a non-zero exit code and inspect the output instead.
let output;
try {
  output = execSync("npx knip --reporter json", {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (err) {
  // knip exits non-zero when findings exist; stdout still has valid JSON.
  if (err.stdout) {
    output = err.stdout;
  } else {
    console.error("::error::knip failed to run:");
    console.error(err.stderr || err.message);
    process.exit(1);
  }
}

// Parse the JSON output and count unused files.
let report;
try {
  report = JSON.parse(output);
} catch (err) {
  console.error("::error::Failed to parse knip JSON output:");
  console.error(err.message);
  console.error("Raw output (first 500 chars):", output.slice(0, 500));
  process.exit(1);
}

// knip JSON reporter outputs an object with a "files" array for unused files.
const unusedFiles = Array.isArray(report.files) ? report.files : [];
const count = unusedFiles.length;

if (count > baseline) {
  console.error(
    `::error::Knip dead-code ratchet failed: ${count} unused files found (baseline ${baseline}). ` +
      `Remove dead files or ensure new files are referenced before merging.`,
  );
  if (unusedFiles.length > 0) {
    console.error("Unused files:");
    for (const file of unusedFiles.slice(0, 30)) {
      console.error(`  ${typeof file === "string" ? file : file.path || JSON.stringify(file)}`);
    }
    if (unusedFiles.length > 30) {
      console.error(`  ... and ${unusedFiles.length - 30} more`);
    }
  }
  process.exit(1);
} else if (count < baseline) {
  console.log(
    `Knip dead-code count improved: ${count} unused files (baseline ${baseline}). ` +
      `Lower .knip-baseline to ${count} to lock in the gain.`,
  );
} else {
  console.log(`Knip dead-code count: ${count} unused files (at baseline ${baseline}).`);
}

console.log("Knip ratchet OK.");
