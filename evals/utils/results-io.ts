import fs from "fs";
import path from "path";

/**
 * Shared results storage so the individual runners (each its own process) can
 * publish structured metrics that `run-all.ts` aggregates for the HTML report,
 * Slack alert, and regression baselines. Previously those utilities existed but
 * were never wired to anything.
 */

export interface SuiteResult {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs?: number;
  skipped?: boolean;
  updatedAt: string;
}

export const resultsDir = path.join(__dirname, "../results");

function ensureResultsDir(): void {
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
}

/** Persist a single suite's result to `results/<suite>.json`. */
export function writeSuiteResult(result: Omit<SuiteResult, "updatedAt">): void {
  ensureResultsDir();
  const payload: SuiteResult = { ...result, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(resultsDir, `${result.suite}.json`), JSON.stringify(payload, null, 2));
}

/** Read every persisted suite result. */
export function readAllSuiteResults(): SuiteResult[] {
  ensureResultsDir();
  return fs
    .readdirSync(resultsDir)
    .filter((f) => f.endsWith(".json") && f !== "aggregate.json")
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf8")) as SuiteResult;
      } catch {
        return null;
      }
    })
    .filter((r): r is SuiteResult => r !== null);
}

/** Delete stale per-suite result files and reports before a fresh full run. */
export function clearSuiteResults(): void {
  ensureResultsDir();
  for (const f of fs.readdirSync(resultsDir)) {
    if (f.endsWith(".json") || f.endsWith(".html")) fs.rmSync(path.join(resultsDir, f));
  }
}
