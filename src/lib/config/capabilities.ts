/**
 * Canonical identity & capability layer (P3).
 *
 * SINGLE SOURCE OF TRUTH for the platform's identity vocabulary.
 *
 * Historically identity was split across three hand-synced lists:
 *   1. The 5 DB `UserRole`s (auth/RBAC).
 *   2. 9 specialist route slugs (`SPECIALIST_PROTECTED_PREFIXES` in
 *      `src/lib/middleware/routes.ts`, mirrored again in `next.config.ts`).
 *   3. The AI persona layer, where `secretary` is canonical and
 *      `receptionist` is a legacy alias.
 *
 * These drifted (`speech-therapist` vs `speech_therapist`,
 * `secretary` vs `receptionist`) and had to be edited in several places at
 * once. This module collapses them into one map.
 *
 * DESIGN DECISION (matches `src/middleware.ts` today):
 *   Specialists / pharmacist are **capabilities layered on the existing 5
 *   core roles**, NOT new DB roles. `src/middleware.ts` already gates
 *   `SPECIALIST_PROTECTED_PREFIXES` to `SPECIALIST_STAFF_ROLES`
 *   (`clinic_admin`, `receptionist`, `doctor`). We keep that: a capability is
 *   an operational surface that one of the 5 roles may access, never a new
 *   principal in the auth system.
 *
 * This file lives in the EDIT layer (`src/lib/config/`). The SEALED Layer-1
 * files (`src/lib/middleware/routes.ts`, `src/middleware.ts`) only IMPORT the
 * derived constants below; they do not re-declare identity.
 */

import type { SiteTeamAgentType } from "@/lib/ai/prompts";
import type { UserRole } from "@/lib/types/database";

/* ────────────────────────────────────────────────────────────────────────
 * 1. Core roles — the ONLY principals in the DB / auth system.
 *    Kept in exact lock-step with `UserRole` in `src/lib/types/database.ts`,
 *    and that lock-step is COMPILER-ENFORCED below (see the mutual
 *    assignability check) rather than relying on this comment.
 *
 * NOTE: both imports above are `import type`, so they are erased at compile
 * time. This module therefore keeps ZERO runtime dependencies and stays safe
 * to import from `next.config.ts` (which loads outside the bundler).
 * ──────────────────────────────────────────────────────────────────────── */

export type CoreRole = "super_admin" | "clinic_admin" | "receptionist" | "doctor" | "patient";

/**
 * COMPILER-ENFORCED lock-step between `CoreRole` (this module) and the DB
 * `UserRole` (`src/lib/types/database.ts`). If either union gains, loses, or
 * renames a member, one of the `satisfies` checks below stops compiling —
 * turning a silent divergence into a build error instead of a doc-comment
 * promise.
 *
 * Pure type-level guard: `AssertMutuallyAssignable` resolves to `true` only
 * when the two unions are mutually assignable (i.e. identical member sets).
 * The two `satisfies true` lines then fail to compile on any drift. No runtime
 * value is emitted (types are erased), so ZERO runtime deps are added.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertCoreRoleMatchesUserRole =
  MutuallyAssignable<CoreRole, UserRole> extends true ? true : never;
// If CoreRole and UserRole ever diverge, the next line is a compile error:
const _coreRoleUserRoleLockStep = true satisfies _AssertCoreRoleMatchesUserRole;
void _coreRoleUserRoleLockStep;

/** Privilege order, highest first. Informational (auth ordering lives in Layer 1). */
export const CORE_ROLE_ORDER: readonly CoreRole[] = [
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
  "patient",
] as const;

/* ────────────────────────────────────────────────────────────────────────
 * 2. Capabilities — operational surfaces layered on core roles.
 *    NOT DB roles. NOT auth principals.
 * ──────────────────────────────────────────────────────────────────────── */

export type Capability =
  | "manage_platform"
  | "manage_clinic"
  | "front_desk"
  | "clinical_care"
  | "pharmacy"
  | "radiology"
  | "nutrition"
  | "optics"
  | "physio"
  | "psychology"
  | "speech_therapy"
  | "parapharmacy"
  | "equipment";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "manage_platform",
  "manage_clinic",
  "front_desk",
  "clinical_care",
  "pharmacy",
  "radiology",
  "nutrition",
  "optics",
  "physio",
  "psychology",
  "speech_therapy",
  "parapharmacy",
  "equipment",
] as const;

/**
 * Which capabilities each core role carries.
 *
 * Mirrors the live gating in `src/middleware.ts`:
 *   - Specialist surfaces are gated to SPECIALIST_STAFF_ROLES =
 *     { clinic_admin, receptionist, doctor }. So every specialist capability
 *     is granted to exactly those three roles.
 *   - `super_admin` is platform-level and implicitly transcends clinic gating,
 *     but is NOT itself a specialist operator, so it carries only
 *     `manage_platform` here (platform control-plane), consistent with it not
 *     appearing in SPECIALIST_STAFF_ROLES.
 *   - `patient` carries no operational capabilities.
 *
 * This map is the authority; `SPECIALIST_STAFF_ROLES` in routes.ts and the
 * `next.config.ts` prefix list are DERIVED from it (see §3/§4 below).
 */
export const CAPABILITIES: Record<CoreRole, Capability[]> = {
  super_admin: ["manage_platform"],
  clinic_admin: [
    "manage_clinic",
    "front_desk",
    "clinical_care",
    "pharmacy",
    "radiology",
    "nutrition",
    "optics",
    "physio",
    "psychology",
    "speech_therapy",
    "parapharmacy",
    "equipment",
  ],
  receptionist: [
    "front_desk",
    "pharmacy",
    "radiology",
    "nutrition",
    "optics",
    "physio",
    "psychology",
    "speech_therapy",
    "parapharmacy",
    "equipment",
  ],
  doctor: [
    "clinical_care",
    "pharmacy",
    "radiology",
    "nutrition",
    "optics",
    "physio",
    "psychology",
    "speech_therapy",
    "parapharmacy",
    "equipment",
  ],
  patient: [],
};

/* ────────────────────────────────────────────────────────────────────────
 * 3. Specialist slug ↔ capability mapping.
 *    Resolves the `speech-therapist` vs `speech_therapist` naming drift ONCE.
 *
 *    `slug` is the canonical URL segment used by the (specialist) route group
 *    and therefore by the protected-prefix lists. Canonical spellings are
 *    picked per the P3 decision; `aliases` documents the other spellings that
 *    have appeared in the codebase so lookups never silently miss.
 * ──────────────────────────────────────────────────────────────────────── */

export interface SpecialistCapabilityDef {
  /** Capability this specialist surface maps to. */
  capability: Capability;
  /**
   * Canonical URL slug (route segment) for this specialist surface.
   * This is what appears in SPECIALIST_PROTECTED_PREFIXES / next.config.ts.
   */
  slug: string;
  /**
   * Documented alternate spellings that resolve to the same capability.
   * Kept so historical / drifted identifiers still resolve fail-safely.
   * (e.g. canonical capability `speech_therapy` uses URL slug
   * `speech-therapist`, and `speech_therapist` is the documented alias.)
   */
  aliases: string[];
}

/**
 * Ordered so derived prefix lists reproduce the existing ordering in
 * routes.ts / next.config.ts (pharmacist first).
 */
export const SPECIALIST_CAPABILITIES: readonly SpecialistCapabilityDef[] = [
  { capability: "pharmacy", slug: "pharmacist", aliases: ["pharmacy"] },
  { capability: "nutrition", slug: "nutritionist", aliases: ["nutrition"] },
  { capability: "optics", slug: "optician", aliases: ["optics", "optic"] },
  { capability: "parapharmacy", slug: "parapharmacy", aliases: [] },
  { capability: "physio", slug: "physiotherapist", aliases: ["physio", "physiotherapy"] },
  { capability: "psychology", slug: "psychologist", aliases: ["psychology"] },
  { capability: "radiology", slug: "radiology", aliases: ["radiologist"] },
  {
    // Canonical capability id is `speech_therapy`; canonical URL slug is
    // `speech-therapist` (hyphen). `speech_therapist` (underscore) is the
    // documented alias that resolves the historical naming drift.
    capability: "speech_therapy",
    slug: "speech-therapist",
    aliases: ["speech_therapist", "speech-therapy", "orthophoniste"],
  },
  { capability: "equipment", slug: "equipment", aliases: [] },
] as const;

/**
 * Extra protected route prefixes that are NOT specialist capabilities but are
 * gated staff surfaces. Documented here so the `next.config.ts` list can be
 * FULLY derived from this module with zero drift, without inventing a DB role
 * or a phantom capability.
 *
 * `lab-panel`: a protected staff surface present in `next.config.ts` only.
 */
export const EXTRA_PROTECTED_SLUGS: readonly string[] = ["lab-panel"] as const;

/**
 * Canonical DB core role → dashboard route (leading-slash prefix).
 *
 * SINGLE SOURCE OF TRUTH for the role→route mapping. `ROLE_ROUTE_MAP` in the
 * SEALED `src/lib/middleware/routes.ts` is DERIVED from this (import-only), so
 * no core-role→route mapping is hand-synced anywhere.
 *
 * Ordered to preserve the existing protected-prefix ordering used by
 * `next.config.ts` (patient, doctor, receptionist, admin, super-admin).
 */
export const CORE_ROLE_ROUTE: Record<CoreRole, string> = {
  patient: "/patient",
  doctor: "/doctor",
  receptionist: "/receptionist",
  clinic_admin: "/admin",
  super_admin: "/super-admin",
};

/**
 * Core-role route slugs (the 5 principals), for prefix derivation.
 * DERIVED from `CORE_ROLE_ROUTE` (drop the leading `/`) so the two never drift.
 * Preserves order: patient, doctor, receptionist, admin, super-admin.
 */
export const CORE_ROLE_SLUGS: readonly string[] = Object.values(CORE_ROLE_ROUTE).map((r) =>
  r.replace(/^\//, ""),
);

/* ────────────────────────────────────────────────────────────────────────
 * 4. Derived constants — consumed by SEALED files & next.config.ts.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Specialist route prefixes, derived from SPECIALIST_CAPABILITIES.
 * IMPORTED by `src/lib/middleware/routes.ts` (SEALED) as
 * `SPECIALIST_PROTECTED_PREFIXES` — do not hand-maintain that list.
 */
export const SPECIALIST_PROTECTED_PREFIXES: readonly string[] = SPECIALIST_CAPABILITIES.map(
  (s) => `/${s.slug}`,
);

/**
 * Full protected route prefixes WITH the `:path*` wildcard variants, in the
 * shape `next.config.ts` needs. Derived so next.config never drifts from the
 * capability layer. Order: core role slugs, then specialists, then extras.
 */
export const PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS: readonly string[] = [
  ...CORE_ROLE_SLUGS,
  ...SPECIALIST_CAPABILITIES.map((s) => s.slug),
  ...EXTRA_PROTECTED_SLUGS,
].flatMap((slug) => [`/${slug}`, `/${slug}/:path*`]);

/* ────────────────────────────────────────────────────────────────────────
 * 5. AI persona alias reconciliation.
 *    `secretary` (canonical AI persona) ↔ `receptionist` (DB core role).
 *    The AI layer (`src/lib/ai/agent-config.ts`) references THIS mapping
 *    instead of an independent constant.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * DB core role → canonical AI persona name.
 * Only `receptionist` differs from its role name; it is exposed to the AI
 * layer as the `secretary` persona.
 */
export const ROLE_TO_PERSONA: Record<CoreRole, SiteTeamAgentType> = {
  super_admin: "super_admin",
  clinic_admin: "clinic_admin",
  receptionist: "secretary",
  doctor: "doctor",
  patient: "patient",
} satisfies Record<CoreRole, SiteTeamAgentType>;

/**
 * Legacy AI persona aliases → canonical persona.
 * `receptionist` is the legacy alias for the canonical `secretary` persona.
 */
export const PERSONA_ALIASES: Record<string, string> = {
  receptionist: "secretary",
};

/** Canonicalize any (possibly legacy) persona name. */
export function canonicalPersona(persona: string): string {
  return PERSONA_ALIASES[persona] ?? persona;
}

/* ────────────────────────────────────────────────────────────────────────
 * 6. Resolvers — the ONE place slugs/roles become capabilities.
 *    All resolvers FAIL CLOSED: unknown input → no capability.
 * ──────────────────────────────────────────────────────────────────────── */

/** Precomputed slug/alias → capability index. */
const SLUG_TO_CAPABILITY: ReadonlyMap<string, Capability> = (() => {
  const m = new Map<string, Capability>();
  for (const def of SPECIALIST_CAPABILITIES) {
    m.set(def.slug, def.capability);
    for (const alias of def.aliases) m.set(alias, def.capability);
  }
  return m;
})();

const CORE_ROLE_SET: ReadonlySet<string> = new Set<string>(CORE_ROLE_ORDER);

/** True if `value` is one of the 5 DB core roles. */
export function isCoreRole(value: string): value is CoreRole {
  return CORE_ROLE_SET.has(value);
}

/**
 * Resolve a specialist slug (canonical or documented alias) to its capability.
 * Returns `null` for unknown slugs (fail-closed).
 */
export function capabilityForSlug(slug: string): Capability | null {
  return SLUG_TO_CAPABILITY.get(slug) ?? null;
}

/**
 * Capabilities granted to a role. Unknown roles → `[]` (fail-closed), matching
 * the deny-by-default posture of `src/middleware.ts`.
 */
export function capabilitiesForRole(role: string): Capability[] {
  return isCoreRole(role) ? CAPABILITIES[role] : [];
}

/** True if `role` holds `capability`. Unknown role → false (fail-closed). */
export function roleHasCapability(role: string, capability: Capability): boolean {
  return capabilitiesForRole(role).includes(capability);
}
