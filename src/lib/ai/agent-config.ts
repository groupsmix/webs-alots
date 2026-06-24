/**
 * Shared site-team AI agent configuration.
 *
 * Extracted from `src/app/api/ai/agent/route.ts` so the same RBAC mapping,
 * step budget, and tool-conversion logic can be imported by both the route
 * handler and the evaluation harness (evals/runners/tool-loop-runner.ts) —
 * the eval previously re-implemented the RBAC table and grepped the route
 * source for `MAX_AGENT_STEPS`, which could silently drift from production.
 *
 * Behaviour is identical to the previous in-route definitions.
 */

import { tool as aiTool } from "ai";
import { z } from "zod";
import type { SiteTeamAgentType } from "@/lib/ai/prompts";
import { executeAgentTool, type AgentToolContext, type AgentToolDefinition } from "@/lib/ai/tools";
import type { UserRole } from "@/lib/types/database";

/** Maximum tool execution steps before forcing a final answer (Task A5). */
export const MAX_AGENT_STEPS = 5;

/** Canonical mapping from a user's role to the agent persona they may use. */
export const ROLE_TO_AGENT: Record<UserRole, SiteTeamAgentType> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
};

/**
 * Returns true when `role` is permitted to use `agentType`. A receptionist may
 * use either the secretary persona (canonical mapping) or the receptionist
 * persona (alias).
 */
export function assertAgentAllowed(role: UserRole, agentType: SiteTeamAgentType): boolean {
  const expectedAgent = ROLE_TO_AGENT[role];
  if (expectedAgent === agentType) return true;
  return role === "receptionist" && agentType === "receptionist";
}

export type AgentToolSet = Record<string, unknown>;

/**
 * Convert {@link AgentToolDefinition}s to AI SDK `tool()` definitions with zod
 * schemas. Required properties stay required; everything else is marked
 * optional. The `execute` functions delegate to {@link executeAgentTool} so
 * RBAC scoping, the read-only guard, and tenant context are unchanged.
 */
export function buildSDKTools(
  toolDefs: AgentToolDefinition[],
  ctx: AgentToolContext,
): AgentToolSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const def of toolDefs) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, prop] of Object.entries(def.input_schema.properties)) {
      const p = prop as { type?: string; description?: string; enum?: string[] };
      if (p.enum) {
        shape[key] = z.enum(p.enum as [string, ...string[]]).describe(p.description ?? key);
      } else {
        shape[key] = z.string().describe(p.description ?? key);
      }
    }

    const required = new Set(def.input_schema.required ?? []);
    for (const key of Object.keys(shape)) {
      if (!required.has(key)) {
        shape[key] = shape[key].optional();
      }
    }

    tools[def.name] = aiTool({
      description: def.description,
      inputSchema: z.object(shape),
      execute: async (input: Record<string, unknown>) => {
        const result = await executeAgentTool(def.name, input, ctx);
        return result;
      },
    });
  }

  return tools;
}
