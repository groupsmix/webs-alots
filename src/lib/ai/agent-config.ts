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
import {
  ROLE_TO_PERSONA,
  canonicalPersona,
  type CoreRole,
} from "@/lib/config/capabilities";
import type { UserRole } from "@/lib/types/database";

/** Maximum tool execution steps before forcing a final answer (Task A5). */
export const MAX_AGENT_STEPS = 5;

/**
 * Canonical mapping from a user's role to the agent persona they may use.
 *
 * P3: the role→persona relationship (including the `receptionist`→`secretary`
 * rename) now lives in `src/lib/config/capabilities.ts` as `ROLE_TO_PERSONA`,
 * so the DB role system and the AI persona layer reference ONE mapping instead
 * of independent constants. This constant is a typed view over that source.
 * (`UserRole` and `CoreRole` are the same 5 roles by construction.)
 */
export const ROLE_TO_AGENT: Record<UserRole, SiteTeamAgentType> = ROLE_TO_PERSONA as Record<
  CoreRole,
  SiteTeamAgentType
>;

/**
 * Returns true when `role` is permitted to drive `agentType`.
 *
 * A role may use the agent it maps to in {@link ROLE_TO_AGENT}. Legacy persona
 * aliases (e.g. `"receptionist"` → `"secretary"`) are normalised via
 * `canonicalPersona` from the canonical capability layer, so the alias is
 * defined in exactly one place.
 */
export function assertAgentAllowed(role: UserRole, agentType: SiteTeamAgentType): boolean {
  const expectedAgent = ROLE_TO_AGENT[role];
  return expectedAgent === canonicalPersona(agentType);
}
