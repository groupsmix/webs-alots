import path from "path";
import { loadTriageCases } from "../utils/load-cases";
import { checkRegression } from "../utils/regression-detector";
import { writeSuiteResult } from "../utils/results-io";

/**
 * Support triage evaluation runner — Phase D1.
 *
 * Exercises the REAL deterministic triage fallback (`hasRedFlag` +
 * `heuristicTriage` from src/lib/ai/triage.ts) — the safety-critical path used
 * whenever the AI provider is unavailable. For every case we assert the full
 * heuristic output, not just the red-flag boolean:
 *
 *  - urgent cases: red flag MUST fire, heuristic urgency MUST be "urgent", and
 *    the tags MUST include "medical_urgent".
 *  - non-urgent cases: red flag MUST NOT fire and heuristic urgency MUST be
 *    "normal" (i.e. no false medical escalation).
 *
 * Fine-grained priority (high/normal/low) and taxonomy tags for non-urgent
 * tickets depend on the live LLM and are not deterministically reproducible
 * here; that is intentionally out of scope for this offline gate.
 */

interface TriageResult {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
  reason?: string;
  description: string;
}

async function loadTriageModule() {
  // Dynamic import so tsx resolves the @ alias.
  return import("../../src/lib/ai/triage");
}

async function runTriageEval() {
  const testCases = loadTriageCases(path.join(__dirname, "../test-cases/triage.json"));

  const { hasRedFlag, heuristicTriage } = await loadTriageModule();

  const results: TriageResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const isRedFlag = hasRedFlag(tc.input);
    const triage = heuristicTriage(tc.input);
    let testPassed: boolean;
    let reason: string | undefined;

    if (tc.expected_outcome === "urgent") {
      // Red flag must fire AND the heuristic must escalate AND tag it urgent.
      testPassed =
        isRedFlag && triage.urgency === "urgent" && triage.tags.includes("medical_urgent");
      if (!testPassed) {
        reason = `redFlag=${isRedFlag} urgency=${triage.urgency} tags=[${triage.tags.join(",")}]`;
      }
    } else {
      // Non-urgent: red flag must NOT fire and heuristic must not escalate.
      testPassed = !isRedFlag && triage.urgency !== "urgent";
      if (!testPassed) {
        reason = `false escalation: redFlag=${isRedFlag} urgency=${triage.urgency}`;
      }
    }

    results.push({
      id: tc.id,
      passed: testPassed,
      expected: tc.expected_outcome,
      actual: triage.urgency,
      reason,
      description: tc.description,
    });

    if (testPassed) passed++;
    else failed++;
  }

  console.log(`\n[Support Triage] Evaluation Results:`);
  console.log(`===========================================`);
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.id}: ${r.description}`);
    if (!r.passed) console.log(`   Expected: ${r.expected}, Got: ${r.actual} (${r.reason})`);
  }

  const total = results.length;
  const passRate = (passed / total) * 100;
  console.log(`\n===========================================`);
  console.log(
    `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Rate: ${passRate.toFixed(1)}%`,
  );

  writeSuiteResult({ suite: "triage", total, passed, failed, passRate });

  const reg = checkRegression("triage", passRate, total);
  if (!reg.passed) {
    console.error(`❌ Support Triage regression gate failed: ${reg.reason}`);
    process.exit(1);
  }

  if (failed > 0) {
    console.error("❌ Support Triage evaluation FAILED.");
    process.exit(1);
  }
  console.log("✅ Support Triage evaluation passed.");
  process.exit(0);
}

runTriageEval().catch((err) => {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
});
