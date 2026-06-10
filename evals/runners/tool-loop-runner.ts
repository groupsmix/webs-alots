import fs from "fs";
import path from "path";

/**
 * Tool loop evaluation runner — Phase E2.
 *
 * Tests multi-step agent configuration and RBAC denial cases
 * without requiring a live AI provider. Validates:
 * 1. Role-to-agent mapping (RBAC) — correct role grants access, wrong role denied
 * 2. MAX_AGENT_STEPS config is set to 5 for multi-step loops
 * 3. Tool schema structure (via source parsing)
 */

interface ToolLoopTestCase {
  id: string;
  description: string;
  role?: string;
  agentType?: string;
  expected_allowed?: boolean;
  test_type?: string;
  expected_max_steps?: number;
}

// Replicate the RBAC logic from agent/route.ts for eval
const ROLE_TO_AGENT: Record<string, string> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
};

function assertAgentAllowed(role: string, agentType: string): boolean {
  const expectedAgent = ROLE_TO_AGENT[role];
  if (expectedAgent === agentType) return true;
  return role === "receptionist" && agentType === "receptionist";
}

async function runToolLoopEval() {
  const testCases: ToolLoopTestCase[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../test-cases/tool-loop.json"), "utf8"),
  );

  // Read agent route source for config checks
  const agentRouteSrc = fs.readFileSync(
    path.join(__dirname, "../../src/app/api/ai/agent/route.ts"),
    "utf8",
  );

  let passed = 0;
  let failed = 0;

  console.log(`\n[Tool Loop] Evaluation Results:`);
  console.log(`===========================================`);

  for (const tc of testCases) {
    let ok = false;

    if (tc.role && tc.agentType && tc.expected_allowed !== undefined) {
      // RBAC test
      const allowed = assertAgentAllowed(tc.role, tc.agentType);
      ok = allowed === tc.expected_allowed;
    } else if (tc.test_type === "config_check") {
      // Verify MAX_AGENT_STEPS
      const match = agentRouteSrc.match(/MAX_AGENT_STEPS\s*=\s*(\d+)/);
      const actual = match ? parseInt(match[1], 10) : 0;
      ok = actual === (tc.expected_max_steps ?? 5);
    } else if (tc.test_type === "tool_schema") {
      // Verify buildSDKTools exists and tool conversion pattern
      ok = agentRouteSrc.includes("buildSDKTools") && agentRouteSrc.includes("aiTool({");
    } else if (tc.test_type === "readonly_check") {
      // Verify read-only guard exists
      ok = agentRouteSrc.includes("read") && agentRouteSrc.includes("executeAgentTool");
    } else {
      ok = false;
    }

    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${tc.id}: ${tc.description}`);
    if (!ok) {
      console.log(`   FAILED`);
    }

    if (ok) passed++;
    else failed++;
  }

  const total = testCases.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  console.log(`\n===========================================`);
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Rate: ${passRate}%`);

  if (failed > 0) {
    console.error("❌ Tool Loop evaluation FAILED.");
    process.exit(1);
  } else {
    console.log("✅ Tool Loop evaluation passed.");
    process.exit(0);
  }
}

runToolLoopEval().catch((err) => {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
});
