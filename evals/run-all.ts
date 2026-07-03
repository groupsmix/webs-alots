import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    //
    // Security: forward only the env vars the runners actually need, not the
    // entire process.env (which includes all secrets at runtime).
    // nosemgrep: semgrep.env-access - Test execution only; explicit allowlist
    const child = spawn(process.execPath, ["--import", "tsx", path.join(__dirname, scriptPath)], {
      stdio: "inherit",
      env: {
        // Runtime — Node.js + tsx resolution
        PATH: process.env.PATH,
        NODE_PATH: process.env.NODE_PATH,
        NODE_ENV: process.env.NODE_ENV,
        // RAG runner
        EVAL_AUTH_TOKEN: process.env.EVAL_AUTH_TOKEN,
        API_BASE_URL: process.env.API_BASE_URL,
        // Alerter
        SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
        // OS path resolution (cross-platform)
        PATHEXT: process.env.PATHEXT,
        USERPROFILE: process.env.USERPROFILE,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        TMP: process.env.TMP,
        TEMP: process.env.TEMP,
        // tsconfig path aliases (needed by tsx for @ imports)
        TS_NODE_PROJECT: process.env.TS_NODE_PROJECT,
      },
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
    passRate: total > 0 ? (passed / total) * 100 : 0,
    suites,
  };

  const reportPath = generateHtmlReport(summary, resultsDir);
  console.log(`\n📄 HTML report written to: ${reportPath}`);

  // Fire Slack alert (no-ops with a log line when SLACK_WEBHOOK_URL is unset).
  await alertOnFailure(summary);

  console.log(`\n===========================================`);
  if (total === 0) {
    console.error(`🚨 No test cases evaluated — check runner output above.`);
    process.exit(1);
  } else if (allPassed) {
    console.log(`🎉 ALL EVALUATIONS PASSED SUCCESSFULLY!`);
    process.exit(0);
  } else {
    console.error(`🚨 ONE OR MORE EVALUATIONS FAILED! See logs above.`);
    process.exit(1);
  }
}

runAll();
