import { spawn } from "child_process";
import path from "path";
import { alertOnFailure } from "./utils/alerter";
import { generateHtmlReport, type SuiteSummary } from "./utils/report-generator";

const scripts = [
  "runners/rag-groundedness-runner.ts",
  "runners/triage-runner.ts",
  "runners/tool-loop-runner.ts",
  "runners/drug-interaction-runner.ts",
];

const resultsDir = path.join(__dirname, "results");

async function runScript(scriptPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n===========================================`);
    console.log(`🚀 RUNNING: ${scriptPath}`);
    console.log(`===========================================\n`);

    // Run via the current Node binary + the tsx loader rather than spawning the
    // `npx` shim. On Windows `npx` resolves to `npx.cmd`, and spawning a `.cmd`
    // without `shell: true` throws EINVAL under modern Node — so the previous
    // `spawn("npx", …)` broke the aggregate run on Windows. This form is
    // cross-platform and needs no shell.
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

  const suites: SuiteSummary[] = [];
  let allPassed = true;

  for (const script of scripts) {
    const passed = await runScript(script);
    suites.push({ name: path.basename(script, ".ts"), status: passed ? "PASS" : "FAIL" });
    if (!passed) {
      allPassed = false;
      console.error(`\n❌ FAILED: ${script}`);
    } else {
      console.log(`\n✅ PASSED: ${script}`);
    }
  }

  const total = suites.length;
  const passedCount = suites.filter((s) => s.status === "PASS").length;
  const failedCount = total - passedCount;
  const summary = {
    total,
    passed: passedCount,
    failed: failedCount,
    passRate: total > 0 ? (passedCount / total) * 100 : 100,
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
