#!/usr/bin/env node
/**
 * Strip in-source (`// nosemgrep`) suppressed results from a Semgrep SARIF file
 * before it is uploaded to GitHub code scanning.
 *
 * Why this exists
 * ---------------
 * Semgrep includes results that were suppressed via an inline `// nosemgrep`
 * annotation in its SARIF output — each carries a `suppressions: [{ kind:
 * "inSource" }]` entry rather than being omitted. GitHub code scanning then
 * renders those suppressed results as PR review comments on the changed lines
 * anyway. Under the repo's `require conversation resolution` branch-protection
 * rule those bot comments block merge, which defeats the entire purpose of the
 * reviewed `nosemgrep` annotation (see PRs #1082 / #1084 for a worked example).
 *
 * Removing only the in-source-suppressed results keeps every genuine,
 * unsuppressed finding intact and still blocking, while honouring annotations a
 * human has explicitly reviewed and signed off with a documented reason.
 *
 * Usage: node scripts/strip-suppressed-sarif.mjs [path-to-sarif]
 *        (defaults to semgrep.sarif in the working directory)
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] ?? "semgrep.sarif";

let sarif;
try {
  sarif = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`strip-suppressed-sarif: could not read/parse ${file}: ${err.message}`);
  process.exit(1);
}

let dropped = 0;
let kept = 0;
for (const run of sarif.runs ?? []) {
  run.results = (run.results ?? []).filter((result) => {
    const isSuppressed = (result.suppressions ?? []).some((s) => s.kind === "inSource");
    if (isSuppressed) {
      dropped += 1;
      return false;
    }
    kept += 1;
    return true;
  });
}

writeFileSync(file, JSON.stringify(sarif));
console.log(
  `strip-suppressed-sarif: removed ${dropped} nosemgrep-suppressed result(s), kept ${kept} in ${file}`,
);
