import path from "path";
import { assertAgentAllowed, buildSDKTools, MAX_AGENT_STEPS } from "../../src/lib/ai/agent-config";
import { SITE_TEAM_AGENT_TYPES, type SiteTeamAgentType } from "../../src/lib/ai/prompts";
import { getAgentTools, type AgentToolContext } from "../../src/lib/ai/tools";
import type { UserRole } from "../../src/lib/types/database";
import { loadToolLoopCases } from "../utils/load-cases";

/**
 * Tool loop evaluation runner — Phase E2.
 *
 * Exercises the REAL production logic (no re-implemented RBAC copy, no regex
 * over the route source):
 *  1. RBAC: imports `assertAgentAllowed` — the same function the route uses.
 *  2. Multi-step budget: imports `MAX_AGENT_STEPS`.
 *  3. Tool schema: runs `buildSDKTools` and asserts the generated zod schema
 *     enforces the `required` contract (rejects/accepts an empty payload).
 *  4. Read-only guard: asserts no agent tool, across any role, is a mutating
 *     (delete/remove/cancel/drop/…) operation.
 */

const MUTATION_VERBS = /(delete|remove|cancel|drop|destroy|purge|wipe)/i;

function stubCtx(agentType: SiteTeamAgentType): AgentToolContext {
  // execute() is never called during schema inspection, so the supabase client
  // is intentionally absent.
  return {
    supabase: null as never,
    clinicId: null,
    userId: "eval",
    profileId: "eval",
    userRole: "doctor",
    agentType,
  };
}

function hasSafeParse(
  value: unknown,
): value is { safeParse: (v: unknown) => { success: boolean } } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

function checkToolSchema(tc: {
  agentType?: string;
  tool_name?: string;
  expect_required_rejects_empty?: boolean;
}): { ok: boolean; reason?: string } {
  const agentType = (tc.agentType ?? "doctor") as SiteTeamAgentType;
  const toolName = tc.tool_name;
  if (!toolName) return { ok: false, reason: "missing tool_name" };

  const defs = getAgentTools(agentType);
  const tools = buildSDKTools(defs, stubCtx(agentType));
  const tool = (tools as Record<string, unknown>)[toolName];
  if (!tool) return { ok: false, reason: `tool '${toolName}' not exposed to ${agentType}` };

  const schema = (tool as { inputSchema?: unknown }).inputSchema;
  if (!hasSafeParse(schema)) return { ok: false, reason: "tool has no inspectable zod schema" };

  const emptyRejected = !schema.safeParse({}).success;
  if (tc.expect_required_rejects_empty === true && !emptyRejected) {
    return {
      ok: false,
      reason: "expected required params to reject empty input, but it was accepted",
    };
  }
  if (tc.expect_required_rejects_empty === false && emptyRejected) {
    return {
      ok: false,
      reason: "expected optional params to accept empty input, but it was rejected",
    };
  }
  return { ok: true };
}

function checkReadOnly(): { ok: boolean; reason?: string } {
  const offenders: string[] = [];
  for (const at of SITE_TEAM_AGENT_TYPES) {
    for (const def of getAgentTools(at)) {
      if (MUTATION_VERBS.test(def.name)) offenders.push(`${at}:${def.name}`);
    }
  }
  return offenders.length === 0
    ? { ok: true }
    : { ok: false, reason: `mutating tools exposed: ${offenders.join(", ")}` };
}

function runToolLoopEval() {
  const testCases = loadToolLoopCases(path.join(__dirname, "../test-cases/tool-loop.json"));

  let passed = 0;
  let failed = 0;

  console.log(`\n[Tool Loop] Evaluation Results:`);
  console.log(`===========================================`);

  for (const tc of testCases) {
    let ok = false;
    let reason: string | undefined;

    if (tc.role && tc.agentType && tc.expected_allowed !== undefined) {
      const allowed = assertAgentAllowed(tc.role as UserRole, tc.agentType as SiteTeamAgentType);
      ok = allowed === tc.expected_allowed;
      if (!ok) reason = `allowed=${allowed}, expected=${tc.expected_allowed}`;
    } else if (tc.test_type === "config_check") {
      ok = MAX_AGENT_STEPS === (tc.expected_max_steps ?? 5);
      if (!ok)
        reason = `MAX_AGENT_STEPS=${MAX_AGENT_STEPS}, expected=${tc.expected_max_steps ?? 5}`;
    } else if (tc.test_type === "tool_schema") {
      const r = checkToolSchema(tc);
      ok = r.ok;
      reason = r.reason;
    } else if (tc.test_type === "readonly_check") {
      const r = checkReadOnly();
      ok = r.ok;
      reason = r.reason;
    } else {
      reason = "unrecognised test case shape";
    }

    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${tc.id}: ${tc.description}`);
    if (!ok) console.log(`   FAILED: ${reason ?? "unknown"}`);

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
  }
  console.log("✅ Tool Loop evaluation passed.");
  process.exit(0);
}

try {
  runToolLoopEval();
} catch (err) {
  console.error("Fatal evaluation error:", err);
  process.exit(1);
}
