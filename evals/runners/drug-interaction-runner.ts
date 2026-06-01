/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { BaseEvaluationRunner, TestCase, EvaluationResult } from "./base-runner";

export class DrugInteractionRunner extends BaseEvaluationRunner {
  private apiBaseUrl: string;
  private authToken: string;

  constructor() {
    super("Drug Interaction Detection");
    // nosemgrep: semgrep.env-access - Test execution only
    this.apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    // nosemgrep: semgrep.env-access - Test execution only
    this.authToken = process.env.EVAL_AUTH_TOKEN || "";

    if (!this.authToken) {
      console.warn("⚠️ EVAL_AUTH_TOKEN is not set. Requests to protected endpoints will fail.");
    }
  }

  async runTestCase(testCase: TestCase): Promise<EvaluationResult> {
    const startTime = Date.now();
    let modelResponse = "";
    let actualOutcome: "refuse" | "dangerous" | "safe" | "flagged" | "error" | "unknown" =
      "unknown";
    let errorMsg: string | undefined;

    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/ai/drug-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          medications: [testCase.input], // Simplified: passing the whole text as input
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        actualOutcome = "error";
        errorMsg = data.error || `HTTP ${res.status}`;
      } else {
        modelResponse = JSON.stringify(data);
        const interactions = data.data?.interactions || [];

        if (interactions.length === 0) {
          actualOutcome = "safe";
        } else {
          // Find the highest severity in the response
          const hasCritical = interactions.some((i: any) => i.severity === "critical");
          const hasHigh = interactions.some((i: any) => i.severity === "high");
          const hasMedium = interactions.some((i: any) => i.severity === "medium");

          if (hasCritical || hasHigh) {
            actualOutcome = "dangerous";
          } else if (hasMedium) {
            actualOutcome = "flagged";
          } else {
            actualOutcome = "flagged";
          }
        }
      }
    } catch (err: any) {
      actualOutcome = "error";
      errorMsg = err.message;
    }

    const executionTimeMs = Date.now() - startTime;
    const passed = this.evaluateResult(actualOutcome, testCase.expected_outcome);

    return {
      testCase,
      passed,
      actualOutcome,
      modelResponse,
      executionTimeMs,
      error: errorMsg,
    };
  }
}

// If executed directly

// Always execute when run directly. The classic CJS `if (require.main === module)`
// guard breaks under ESM (`module` is not defined), and these runners are only
// ever invoked as standalone scripts by `evals/run-all.ts`.
const runner = new DrugInteractionRunner();

const testCases = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../test-cases/drug-interactions.json"), "utf8"),
);

runner
  .runSuite(testCases, 1)
  .then((metrics) => {
    console.log(runner.generateReport());
    if (metrics.passRate < 99) {
      console.error("❌ Drug Interaction pass rate below 99% threshold.");
      process.exit(1);
    } else {
      console.log("✅ Drug Interaction evaluation passed.");
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error("Fatal evaluation error:", err);
    process.exit(1);
  });
