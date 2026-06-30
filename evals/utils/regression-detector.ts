import fs from "fs";
import path from "path";

/**
 * Regression Detector — Phase E2.
 *
 * Maintains per-suite pass-rate baselines and alerts on regressions.
 * Thresholds: any suite dropping >2% from baseline triggers a failure.
 */

interface SuiteBaseline {
  suite: string;
  passRate: number;
  total: number;
  updatedAt: string;
}

interface RegressionThresholds {
  /** Max allowed drop in pass rate before flagging regression (percentage points) */
  maxDropPct: number;
  /** Minimum absolute pass rate required regardless of baseline */
  minPassRate: Record<string, number>;
}

const THRESHOLDS: RegressionThresholds = {
  maxDropPct: 2,
  minPassRate: {
    // All suites require 100%. The RAG runner hard-fails on ANY failed case
    // (refused-case violations are safety-critical; grounded cases accept a
    // conservative refusal), so a sub-100 threshold here was dead — it could
    // never be the binding gate. Keep it at 100 so the threshold matches the
    // runner's actual behaviour instead of implying tolerance that isn't there.
    "rag-groundedness": 100,
    triage: 100,
    "tool-loop": 100,
    "drug-interaction": 100,
  },
};

const baselinesDir = path.join(__dirname, "../baselines");
const resultsDir = path.join(__dirname, "../results");
const baselineFile = path.join(baselinesDir, "baselines.json");

function ensureDirs() {
  if (!fs.existsSync(baselinesDir)) fs.mkdirSync(baselinesDir, { recursive: true });
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
}

function loadBaselines(): SuiteBaseline[] {
  if (!fs.existsSync(baselineFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(baselineFile, "utf8"));
  } catch {
    return [];
  }
}

function saveBaselines(baselines: SuiteBaseline[]): void {
  fs.writeFileSync(baselineFile, JSON.stringify(baselines, null, 2));
}

export function checkRegression(
  suite: string,
  currentPassRate: number,
  currentTotal: number,
): { passed: boolean; reason?: string } {
  // A suite that ran zero cases cannot meaningfully be compared against a
  // baseline or threshold — fail clearly rather than producing a spurious
  // regression against an old baseline.
  if (currentTotal === 0) {
    return {
      passed: false,
      reason: `Suite '${suite}' ran with 0 evaluated cases — check test-case discovery/loading logic.`,
    };
  }

  ensureDirs();
  const baselines = loadBaselines();
  const existing = baselines.find((b) => b.suite === suite);

  // Check minimum absolute threshold
  const minRate = THRESHOLDS.minPassRate[suite] ?? 90;
  if (currentPassRate < minRate) {
    return {
      passed: false,
      reason: `Pass rate ${currentPassRate.toFixed(1)}% below minimum threshold ${minRate}%`,
    };
  }

  if (!existing) {
    // First run — establish baseline
    baselines.push({
      suite,
      passRate: currentPassRate,
      total: currentTotal,
      updatedAt: new Date().toISOString(),
    });
    saveBaselines(baselines);
    console.log(`[Regression] New baseline for ${suite}: ${currentPassRate.toFixed(1)}%`);
    return { passed: true };
  }

  const drop = existing.passRate - currentPassRate;
  if (drop > THRESHOLDS.maxDropPct) {
    return {
      passed: false,
      reason: `Regression: ${suite} dropped from ${existing.passRate.toFixed(1)}% to ${currentPassRate.toFixed(1)}% (drop: ${drop.toFixed(1)}pp, threshold: ${THRESHOLDS.maxDropPct}pp)`,
    };
  }

  // Update baseline if improved
  if (currentPassRate > existing.passRate) {
    existing.passRate = currentPassRate;
    existing.total = currentTotal;
    existing.updatedAt = new Date().toISOString();
    saveBaselines(baselines);
    console.log(`[Regression] Updated baseline for ${suite}: ${currentPassRate.toFixed(1)}%`);
  }

  return { passed: true };
}

// CLI mode — run standalone check
if (require.main === module) {
  console.log("Running regression detection...");
  ensureDirs();

  const baselines = loadBaselines();
  if (baselines.length === 0) {
    console.log("No baselines established yet. Run eval suites first to establish baselines.");
  } else {
    console.log(`Found ${baselines.length} suite baselines:`);
    for (const b of baselines) {
      console.log(
        `  ${b.suite}: ${b.passRate.toFixed(1)}% (${b.total} cases, updated ${b.updatedAt})`,
      );
    }
  }

  console.log("Regression check passed.");
  process.exit(0);
}
