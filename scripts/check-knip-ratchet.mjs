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

// Extract the list of unused files from the knip JSON report.
//
// knip@6's JSON reporter emits `{ issues: [ { file, files: [...], exports,
// types, ... }, ... ] }`, where a file is reported as UNUSED when its
// per-file `files` array is non-empty (it contains the file itself). The
// previous implementation read a top-level `report.files` array, which does
// not exist in this knip version — so it always counted 0 and the ratchet
// silently passed regardless of how much dead code existed. Parse the
// per-issue `files` arrays, with a fallback to the legacy top-level shape.
function extractUnusedFiles(rep) {
  const out = [];
  if (Array.isArray(rep.issues)) {
    for (const issue of rep.issues) {
      if (Array.isArray(issue.files) && issue.files.length > 0) {
        for (const f of issue.files) {
          out.push(typeof f === "string" ? f : f.name || issue.file);
        }
      }
    }
  }
  // Backward-compat: older knip versions exposed a top-level `files` array.
  if (out.length === 0 && Array.isArray(rep.files)) {
    for (const f of rep.files) {
      out.push(typeof f === "string" ? f : f.path || JSON.stringify(f));
    }
  }
  return out;
}

const unusedFiles = extractUnusedFiles(report);
const count = unusedFiles.length;

// ---------------------------------------------------------------------------
// Unused exports + types ratchet.
//
// knip reports far more unused *exports* and *types* than unused files. These
// were previously ungated (the exports rule is "warn" in knip.json and this
// script only counted files), so dead export surface could accumulate
// unchecked. Count them here and enforce a second monotonic ratchet against
// .knip-exports-baseline so the backlog can only shrink.
// ---------------------------------------------------------------------------
const EXPORTS_BASELINE_PATH = ".knip-exports-baseline";
let exportsBaseline = Number.POSITIVE_INFINITY;
try {
  const raw = readFileSync(EXPORTS_BASELINE_PATH, "utf8").trim();
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    console.error(`::error::Could not parse ${EXPORTS_BASELINE_PATH} as a number (got "${raw}")`);
    process.exit(1);
  }
  exportsBaseline = parsed;
} catch {
  console.error(
    `::error::${EXPORTS_BASELINE_PATH} not found — cannot enforce the unused-export ratchet`,
  );
  process.exit(1);
}

function countExportsAndTypes(rep) {
  let n = 0;
  if (Array.isArray(rep.issues)) {
    for (const issue of rep.issues) {
      if (Array.isArray(issue.exports)) n += issue.exports.length;
      if (Array.isArray(issue.types)) n += issue.types.length;
      if (Array.isArray(issue.nsExports)) n += issue.nsExports.length;
      if (Array.isArray(issue.nsTypes)) n += issue.nsTypes.length;
    }
  }
  return n;
}

const exportsCount = countExportsAndTypes(report);

if (exportsCount > exportsBaseline) {
  console.error(
    `::error::Knip unused-export ratchet failed: ${exportsCount} unused exports/types found ` +
      `(baseline ${exportsBaseline}). Remove the dead export (or delete the symbol) before merging.`,
  );
  process.exit(1);
} else if (exportsCount < exportsBaseline) {
  console.log(
    `Knip unused-export count improved: ${exportsCount} unused exports/types ` +
      `(baseline ${exportsBaseline}). Lower ${EXPORTS_BASELINE_PATH} to ${exportsCount} to lock in the gain.`,
  );
} else {
  console.log(
    `Knip unused-export count: ${exportsCount} unused exports/types (at baseline ${exportsBaseline}).`,
  );
}

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
