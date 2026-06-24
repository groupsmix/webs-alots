/* eslint-disable @typescript-eslint/no-explicit-any */
export type TestCaseCategory =
  | "jailbreak"
  | "drug-interaction"
  | "hallucination"
  | "bias"
  | "rag-groundedness";
export type TestCaseOutcome = "refuse" | "dangerous" | "safe" | "flagged" | "grounded" | "refused";
export type TestCaseSeverity = "critical" | "high" | "medium" | "low" | "none";
export type TestCaseLanguage = "fr" | "ar" | "dr" | "darija" | "en";

export interface TestCase {
  id: string;
  category: TestCaseCategory;
  language: TestCaseLanguage;
  input: string;
  context?: Record<string, any>;
  expected_outcome: TestCaseOutcome;
  severity: TestCaseSeverity;
  description: string;
  /** Ground-truth positive anchors — a grounded answer must contain all of these (case-insensitive). */
  expected_contains?: string[];
  /** Negative anchors — the answer must contain none of these (e.g. a fabricated dosage). */
  must_not_contain?: string[];
}

export interface EvaluationResult {
  testCase: TestCase;
  passed: boolean;
  actualOutcome: TestCaseOutcome | "hallucinated" | "error" | "unknown" | "skipped";
  modelResponse: string;
  executionTimeMs: number;
  error?: string;
  /** True when the case could not be evaluated (e.g. AI globally disabled). */
  skipped?: boolean;
}

export interface EvaluationMetrics {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  avgExecutionTimeMs: number;
  failuresByCategory: Record<string, number>;
  failuresByLanguage: Record<string, number>;
}

export abstract class BaseEvaluationRunner {
  protected results: EvaluationResult[] = [];
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Execute a single test case against the AI endpoints
   */
  abstract runTestCase(testCase: TestCase): Promise<EvaluationResult>;

  /**
   * Run a batch of test cases sequentially or with bounded concurrency.
   *
   * The concurrent path preserves input order in `this.results` — a previous
   * implementation pushed results as they resolved, producing nondeterministic
   * ordering in reports and metrics.
   */
  async runSuite(testCases: TestCase[], concurrency = 1): Promise<EvaluationMetrics> {
    console.log(`[${this.name}] Starting evaluation suite with ${testCases.length} cases...`);
    this.results = [];

    if (concurrency <= 1) {
      for (const tc of testCases) {
        const result = await this.runTestCase(tc);
        this.results.push(result);
        this.logProgress(result);
      }
    } else {
      const ordered: EvaluationResult[] = new Array(testCases.length);
      let cursor = 0;

      const worker = async () => {
        for (;;) {
          const index = cursor++;
          if (index >= testCases.length) return;
          const result = await this.runTestCase(testCases[index]);
          ordered[index] = result;
          this.logProgress(result);
        }
      };

      const pool = Array.from({ length: Math.min(concurrency, testCases.length) }, () => worker());
      await Promise.all(pool);
      this.results = ordered;
    }

    return this.calculateMetrics();
  }

  /**
   * Compare actual vs expected outcomes
   */
  protected evaluateResult(
    actual: EvaluationResult["actualOutcome"],
    expected: TestCaseOutcome,
  ): boolean {
    return actual === expected;
  }

  /**
   * Calculate suite metrics. Skipped cases (e.g. AI globally disabled) are
   * excluded from totals so they neither inflate nor deflate the pass rate.
   */
  calculateMetrics(): EvaluationMetrics {
    const evaluated = this.results.filter((r) => !r.skipped);
    const total = evaluated.length;
    const passed = evaluated.filter((r) => r.passed).length;
    const failed = total - passed;

    const executionTimes = evaluated.map((r) => r.executionTimeMs);
    const avgExecutionTimeMs = executionTimes.reduce((a, b) => a + b, 0) / (total || 1);

    const failuresByCategory: Record<string, number> = {};
    const failuresByLanguage: Record<string, number> = {};

    evaluated
      .filter((r) => !r.passed)
      .forEach((r) => {
        failuresByCategory[r.testCase.category] =
          (failuresByCategory[r.testCase.category] || 0) + 1;
        failuresByLanguage[r.testCase.language] =
          (failuresByLanguage[r.testCase.language] || 0) + 1;
      });

    return {
      total,
      passed,
      failed,
      skipped: this.results.length - evaluated.length,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      avgExecutionTimeMs,
      failuresByCategory,
      failuresByLanguage,
    };
  }

  /**
   * Log individual test progress
   */
  private logProgress(result: EvaluationResult) {
    const status = result.skipped ? "⏭️  SKIP" : result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(
      `  ${status} | ${result.testCase.id} | expected: ${result.testCase.expected_outcome} | actual: ${result.actualOutcome} | ${result.executionTimeMs}ms`,
    );
  }

  /**
   * Generate human-readable report of the suite
   */
  generateReport(): string {
    const metrics = this.calculateMetrics();
    let report = `\n# Evaluation Report: ${this.name}\n`;
    report += `Date: ${new Date().toISOString()}\n`;
    report += `Total Cases: ${metrics.total}\n`;
    report += `Passed: ${metrics.passed} (${metrics.passRate.toFixed(2)}%)\n`;
    report += `Failed: ${metrics.failed}\n`;
    report += `Skipped: ${metrics.skipped}\n`;
    report += `Avg Response Time: ${metrics.avgExecutionTimeMs.toFixed(0)}ms\n\n`;

    if (metrics.failed > 0) {
      report += `## Failures\n`;
      this.results
        .filter((r) => !r.skipped && !r.passed)
        .forEach((r) => {
          report += `- **${r.testCase.id}** (${r.testCase.language}): Expected '${r.testCase.expected_outcome}', got '${r.actualOutcome}'\n`;
          report += `  - Input: "${r.testCase.input}"\n`;
          report += `  - Response: "${r.modelResponse.substring(0, 150)}..."\n`;
          if (r.error) report += `  - Error: ${r.error}\n`;
        });
    }

    return report;
  }
}
