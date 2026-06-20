import { spawn } from "child_process";
import path from "path";

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

    const child = spawn("npx", ["tsx", path.join(__dirname, scriptPath)], {
      stdio: "inherit",
      // nosemgrep: semgrep.env-access - Test execution only
      env: process.env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function runAll() {
  console.log("Starting full AI Medical Evaluation Suite...");

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
