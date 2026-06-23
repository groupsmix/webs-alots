import fs from "fs";
import path from "path";
import { checkRegression } from "../utils/regression-detector";
import { writeSuiteResult } from "../utils/results-io";

/**
 * Drug interaction evaluation runner — Phase E4.
 *
 * Tests the Oltigo Clinical Knowledge Pack (src/lib/ai/knowledge/loader.ts)
 * as the ground truth for drug-drug interaction severity.
 *
 * No network calls — pure unit test of the knowledge pack lookup:
 *   "contraindicated" | "major"  → "dangerous"
 *   "moderate"                   → "flagged"
 *   "minor"                      → "safe"
 *   null (not found in pack)     → "safe"
 *
 * All expected_outcome="dangerous" cases MUST pass (100% threshold).
 * The CI gate uses this to prevent regressions in critical safety data.
 */

interface DrugInteractionTestCase {
  id: string;
  category: string;
  language: string;
  input: string;
  context: { drug_a: string; drug_b: string };
  expected_outcome: "dangerous" | "flagged" | "safe";
  severity: "critical" | "high" | "medium" | "low" | "none";
  description: string;
}

interface RunResult {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
  drugA: string;
  drugB: string;
  packSeverity: string | null;
  description: string;
}

type ActualOutcome = "dangerous" | "flagged" | "safe";

function severityToOutcome(
  severity: "minor" | "moderate" | "major" | "contraindicated" | null,
): ActualOutcome {
  if (severity === "contraindicated" || severity === "major") return "dangerous";
  if (severity === "moderate") return "flagged";
  return "safe"; // minor or not found
}

async function loadKnowledgeModule() {
  // Dynamic import so tsx resolves the @ alias correctly at eval runtime
  const mod = await import("../../src/lib/ai/knowledge/loader");
  return mod;
}

async function runDrugInteractionEval() {
  const testCases: DrugInteractionTestCase[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../test-cases/drug-interactions.json"), "utf8"),
  );

  const { lookupDrugInteraction, PACK_VERSION } = await loadKnowledgeModule();

  console.log(`\n[Drug Interaction Pack] Running against pack v${PACK_VERSION}`);
  console.log(`===========================================`);

  const results: RunResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const drugA = tc.context.drug_a;
    const drugB = tc.context.drug_b;

    const interaction = lookupDrugInteraction(drugA, drugB);
    const actualOutcome = severityToOutcome(interaction?.severity ?? null);
    const testPassed = actualOutcome === tc.expected_outcome;

    results.push({
      id: tc.id,
      passed: testPassed,
      expected: tc.expected_outcome,
      actual: actualOutcome,
      drugA,
      drugB,
      packSeverity: interaction?.severity ?? null,
      description: tc.description,
    });

    if (testPassed) passed++;
    else failed++;
  }

  // Print results
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    const packInfo = r.packSeverity ? ` [pack: ${r.packSeverity}]` : " [not in pack]";
    console.log(`${icon} ${r.id} | ${r.drugA} ↔ ${r.drugB}${packInfo}`);
    if (!r.passed) {
      console.log(`   Expected: ${r.expected} | Got: ${r.actual}`);
      console.log(`   ${r.description}`);
    }
  }

  const total = results.length;
  const passRate = (passed / total) * 100;

  console.log(`\n===========================================`);
  console.log(
    `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Rate: ${passRate.toFixed(1)}%`,
  );

  writeSuiteResult({ suite: "drug-interaction", total, passed, failed, passRate });

  // Critical safety gate: ALL dangerous-classified pairs in the pack must
  // be detected. A missed contraindicated/major interaction is a patient
  // safety failure — not a soft warning.
  const criticalFailures = results.filter((r) => !r.passed && r.expected === "dangerous");

  if (criticalFailures.length > 0) {
    console.error(
      `\n🚨 CRITICAL: ${criticalFailures.length} dangerous interaction(s) not detected:`,
    );
    for (const r of criticalFailures) {
      console.error(`   ${r.id}: ${r.drugA} ↔ ${r.drugB} (expected dangerous, got ${r.actual})`);
    }
    console.error("❌ Drug Interaction evaluation FAILED — safety regression.");
    process.exit(1);
  }

  const reg = checkRegression("drug-interaction", passRate, total);
  if (!reg.passed) {
    console.error(`❌ Drug Interaction regression gate failed: ${reg.reason}`);
    process.exit(1);
  }

  if (failed > 0) {
    // Non-critical failures (flagged/safe mismatches) are logged but not fatal
    console.warn(`\n⚠️  ${failed} non-critical test(s) failed (flagged/safe classification).`);
  }

  console.log(`\n✅ Drug Interaction evaluation passed (v${PACK_VERSION}).`);
  process.exit(0);
}

runDrugInteractionEval().catch((err) => {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
});
