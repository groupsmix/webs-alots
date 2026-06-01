export type TestCaseCategory = "jailbreak" | "drug-interaction" | "hallucination" | "bias";
export type TestCaseOutcome = "refuse" | "dangerous" | "safe" | "flagged";
export type TestCaseSeverity = "critical" | "high" | "medium" | "low" | "none";
export type TestCaseLanguage = "fr" | "ar" | "dr" | "en";

export interface TestCase {
  id: string;
  category: TestCaseCategory;
  language: TestCaseLanguage;
  input: string;
  context?: Record<string, any>;
  expected_outcome: TestCaseOutcome;
  severity: TestCaseSeverity;
  description: string;
}

export interface EvaluationResult {
  testCase: TestCase;
  passed: boolean;
  actualOutcome: TestCaseOutcome | "error" | "unknown";
  modelResponse: string;
  executionTimeMs: number;
  error?: string;
}

export interface EvaluationMetrics {
  total: number;
  passed: number;
  failed: number;
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
   * Run a batch of test cases sequentially or in parallel
   */
  async runSuite(testCases: TestCase[], concurrency = 1): Promise<EvaluationMetrics> {
    console.log(`[${this.name}] Starting evaluation suite with ${testCases.length} cases...`);
    this.results = [];

    if (concurrency === 1) {
      for (const tc of testCases) {
        const result = await this.runTestCase(tc);
        this.results.push(result);
        this.logProgress(result);
      }
    } else {
      // Basic parallel execution (can be optimized with p-map or similar if needed)
      const promises = testCases.map(async (tc) => {
        const result = await this.runTestCase(tc);
        this.results.push(result);
        this.logProgress(result);
        return result;
      });
      await Promise.all(promises);
    }

    return this.calculateMetrics();
  }

  /**
   * Compare actual vs expected outcomes
   */
  protected evaluateResult(actual: TestCaseOutcome | "error" | "unknown", expected: TestCaseOutcome): boolean {
    return actual === expected;
  }

  /**
   * Calculate suite metrics
   */
  calculateMetrics(): EvaluationMetrics {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    
    const executionTimes = this.results.map((r) => r.executionTimeMs);
    const avgExecutionTimeMs = executionTimes.reduce((a, b) => a + b, 0) / (total || 1);

    const failuresByCategory: Record<string, number> = {};
    const failuresByLanguage: Record<string, number> = {};

    this.results.filter(r => !r.passed).forEach(r => {
      failuresByCategory[r.testCase.category] = (failuresByCategory[r.testCase.category] || 0) + 1;
      failuresByLanguage[r.testCase.language] = (failuresByLanguage[r.testCase.language] || 0) + 1;
    });

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      avgExecutionTimeMs,
      failuresByCategory,
      failuresByLanguage
    };
  }

  /**
   * Log individual test progress
   */
  private logProgress(result: EvaluationResult) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`  ${status} | ${result.testCase.id} | expected: ${result.testCase.expected_outcome} | actual: ${result.actualOutcome} | ${result.executionTimeMs}ms`);
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
    report += `Avg Response Time: ${metrics.avgExecutionTimeMs.toFixed(0)}ms\n\n`;

    if (metrics.failed > 0) {
      report += `## Failures\n`;
      this.results
        .filter((r) => !r.passed)
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
