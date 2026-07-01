import path from "path";
import { assertAgentAllowed, MAX_AGENT_STEPS } from "../../src/lib/ai/agent-config";
import type { SiteTeamAgentType } from "../../src/lib/ai/prompts";
import { buildSDKTools, getAgentTools, type AgentToolContext } from "../../src/lib/ai/tools";
import type { UserRole } from "../../src/lib/types/database";
import { loadToolLoopCases, type ToolLoopTestCase } from "../utils/load-cases";
import { checkRegression } from "../utils/regression-detector";
import { writeSuiteResult } from "../utils/results-io";

/**
 * Tool loop evaluation runner — Phase E2.
 *
 * Exercises the REAL production logic (no re-implemented copies, no regex over
 * source text):
 *  1. RBAC: imports `assertAgentAllowed` from the same module the route uses.
 *  2. Multi-step budget: imports `MAX_AGENT_STEPS`.
 *  3. Tool schema: runs `buildSDKTools` and checks the generated zod schema
 *     enforces the `required` contract (rejects/accepts an empty payload).
 *  4. Read-only guard: asserts no tool is named with a mutation verb AND that
 *     write-capable tools (e.g. handoff_to_agent, which creates tasks + audit
 *     rows) are exposed only to roles allowed to mutate — never to the
 *     read-only patient/doctor/super_admin agents.
 */

const MUTATION_VERBS = /(delete|remove|cancel|drop|destroy|purge|wipe)/i;

/**
 * Tools that mutate durable state. `handoff_to_agent` creates a team task,
 * writes a history event, and emits an audit log (see executeAgentTool in
 * src/lib/ai/tools.ts) — it is NOT read-only despite its neutral name, which
 * is exactly why a name-only guard gives false assurance.
 *
 * Keep this set in sync with any new write-capable tool. The guard fails if a
 * tool that is not declared here turns out to be exposed under a name that
 * matches a mutation verb, OR if a known write tool leaks to a role that must
 * stay read-only.
 */
const WRITE_TOOLS = new Set<string>(["handoff_to_agent"]);

/**
 * Roles permitted to hold a write-capable tool. Mirrors HANDOFF_ALLOWED_SOURCES
 * in src/lib/ai/tools.ts. Patient, doctor, and super_admin agents MUST remain
 * strictly read-only.
 */
const WRITE_CAPABLE_ROLES = new Set<SiteTeamAgentType>([
  "secretary",
  "receptionist",
  "clinic_admin",
]);

function stubCtx(agentType: SiteTeamAgentType): AgentToolContext {
  return {
    // execute() is never called during schema inspection
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

function checkToolSchema(tc: ToolLoopTestCase): { ok: boolean; reason?: string } {
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
  const agentTypes: SiteTeamAgentType[] = [
    "doctor",
    "secretary",
    "receptionist",
    "clinic_admin",
    "super_admin",
    "patient",
  ];
  const offenders: string[] = [];
  for (const at of agentTypes) {
    for (const def of getAgentTools(at)) {
      // (a) No tool may be named with a mutation verb...
      if (MUTATION_VERBS.test(def.name)) {
        offenders.push(`${at}:${def.name} (mutation-verb name)`);
      }
      // (b) ...and any write-capable tool may only be exposed to roles that
      // are explicitly allowed to mutate. Read-only roles (patient/doctor/
      // super_admin) must carry no write tools at all.
      if (WRITE_TOOLS.has(def.name) && !WRITE_CAPABLE_ROLES.has(at)) {
        offenders.push(`${at}:${def.name} (write tool exposed to read-only role)`);
      }
    }
  }
  return offenders.length === 0
    ? { ok: true }
    : { ok: false, reason: `read-only guard violated: ${offenders.join(", ")}` };
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
  const passRate = (passed / total) * 100;
  console.log(`\n===========================================`);
  console.log(
    `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Rate: ${passRate.toFixed(1)}%`,
  );

  writeSuiteResult({ suite: "tool-loop", total, passed, failed, passRate });

  const reg = checkRegression("tool-loop", passRate, total);
  if (!reg.passed) {
    console.error(`❌ Tool Loop regression gate failed: ${reg.reason}`);
    process.exit(1);
  }

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
