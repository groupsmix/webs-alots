/**
 * Shared site-team agent configuration & RBAC.
 *
 * Single source of truth for:
 * - The role → agent-type mapping
 * - The `assertAgentAllowed` access-control check
 * - The multi-step tool loop budget (`MAX_AGENT_STEPS`)
 *
 * This lives in its own module (rather than inline in the route handler) so
 * that the evaluation harness can import and exercise the *real* logic instead
 * of re-implementing a copy. Any change here is automatically reflected in both
 * the production route and the RBAC eval.
 */

import type { SiteTeamAgentType } from "@/lib/ai/prompts";
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
 * Returns true when `role` is permitted to drive `agentType`.
 *
 * A role may use the agent it maps to in {@link ROLE_TO_AGENT}. Receptionists
 * additionally accept the legacy `"receptionist"` agent alias (normalised to
 * `"secretary"` elsewhere).
 */
export function assertAgentAllowed(role: UserRole, agentType: SiteTeamAgentType): boolean {
  const expectedAgent = ROLE_TO_AGENT[role];
  if (expectedAgent === agentType) return true;
  return role === "receptionist" && agentType === "receptionist";
}
