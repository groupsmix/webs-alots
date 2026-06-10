import fs from "fs";
import path from "path";

/**
 * Support triage evaluation runner — Phase D1.
 *
 * Tests the red-flag detection and urgency classification heuristics
 * without requiring a live AI provider. This ensures the fail-open
 * heuristic path correctly classifies all 20 test cases.
 */

interface TriageTestCase {
  id: string;
  input: string;
  expected_outcome: string;
  description: string;
  language: string;
  expected_tags: string[];
}

interface TriageResult {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
  description: string;
}

// Import the heuristic triage logic directly — no network calls needed
async function loadTriageModule() {
  // Dynamic import so tsx resolves the @ alias
  const mod = await import("../../src/lib/ai/triage");
  return mod;
}

async function runTriageEval() {
  const testCases: TriageTestCase[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../test-cases/triage.json"), "utf8"),
  );

  const { hasRedFlag } = await loadTriageModule();

  const results: TriageResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const isRedFlag = hasRedFlag(tc.input);
    let actualUrgency: string;

    if (tc.expected_outcome === "urgent") {
      // For urgent cases, we only need to verify the red-flag detector fires
      const ok = isRedFlag;
      actualUrgency = isRedFlag ? "urgent" : "not-urgent";
      const testPassed = ok;

      results.push({
        id: tc.id,
        passed: testPassed,
        expected: tc.expected_outcome,
        actual: actualUrgency,
        description: tc.description,
      });

      if (testPassed) passed++;
      else failed++;
    } else {
      // For non-urgent cases, verify the red-flag detector does NOT fire
      actualUrgency = isRedFlag ? "urgent" : tc.expected_outcome;
      const testPassed = !isRedFlag;

      results.push({
        id: tc.id,
        passed: testPassed,
        expected: tc.expected_outcome,
        actual: actualUrgency,
        description: tc.description,
      });

      if (testPassed) passed++;
      else failed++;
    }
  }

  console.log(`\n[Support Triage] Evaluation Results:`);
  console.log(`===========================================`);

  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.id}: ${r.description}`);
    if (!r.passed) {
      console.log(`   Expected: ${r.expected}, Got: ${r.actual}`);
    }
  }

  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  console.log(`\n===========================================`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Rate: ${passRate}%`);

  if (failed > 0) {
    console.error("❌ Support Triage evaluation FAILED.");
    process.exit(1);
  } else {
    console.log("✅ Support Triage evaluation passed.");
    process.exit(0);
  }
}

runTriageEval().catch((err) => {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
});
