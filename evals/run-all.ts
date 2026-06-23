import { spawn } from "child_process";
import path from "path";
import { alertOnFailure } from "./utils/alerter";
import { generateHtmlReport } from "./utils/report-generator";
import { clearSuiteResults, readAllSuiteResults, resultsDir } from "./utils/results-io";

const scripts = [
  "runners/rag-groundedness-runner.ts",
  "runners/triage-runner.ts",
  "runners/tool-loop-runner.ts",
  "runners/drug-interaction-runner.ts",
];

async function runScript(scriptPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n===========================================`);
    console.log(`🚀 RUNNING: ${scriptPath}`);
    console.log(`===========================================\n`);

    // Run via the current Node binary + tsx loader — cross-platform, no shell
    // (avoids the .cmd-on-Windows spawn restriction and the shell-escaping
    // deprecation warning).
    const child = spawn(process.execPath, ["--import", "tsx", path.join(__dirname, scriptPath)], {
      stdio: "inherit",
      // nosemgrep: semgrep.env-access - Test execution only
      env: process.env,
    });

    child.on("close", (code) => resolve(code === 0));
  });
}

async function runAll() {
  console.log("Starting full AI Medical Evaluation Suite...");

  // Start each run from a clean slate so the aggregate report reflects only
  // this invocation's results.
  clearSuiteResults();

  let allPassed = true;

  for (const script of scripts) {
    const passed = await runScript(script);
    if (!passed) {
      allPassed = false;
      console.error(`\n❌ FAILED: ${script}`);
    } else {
      console.log(`\n✅ PASSED: ${script}`);
    }
  }

  // Aggregate structured results published by each runner.
  const suites = readAllSuiteResults();
  const total = suites.reduce((a, s) => a + s.total, 0);
  const passed = suites.reduce((a, s) => a + s.passed, 0);
  const failed = suites.reduce((a, s) => a + s.failed, 0);
  const summary = {
    total,
    passed,
    failed,
    passRate: total > 0 ? (passed / total) * 100 : 100,
    suites,
  };

  const reportPath = generateHtmlReport(summary, resultsDir);
  console.log(`\n📄 HTML report written to: ${reportPath}`);

  // Fire Slack alert (no-ops with a log line when SLACK_WEBHOOK_URL is unset).
  await alertOnFailure(summary);

  console.log(`\n===========================================`);
  if (allPassed) {
    console.log(`🎉 ALL EVALUATIONS PASSED SUCCESSFULLY!`);
    process.exit(0);
  } else {
    console.error(`🚨 ONE OR MORE EVALUATIONS FAILED! See logs above.`);
    process.exit(1);
  }
}

runAll();
