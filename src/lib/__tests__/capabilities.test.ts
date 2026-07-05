/**
 * P3 — Canonical identity / capability layer.
 *
 * Asserts the three formerly hand-synced identity vocabularies are now derived
 * from ONE source (`src/lib/config/capabilities.ts`):
 *   1. Every specialist slug maps to exactly one capability.
 *   2. `SPECIALIST_PROTECTED_PREFIXES` (routes.ts) and the `next.config.ts`
 *      prefix list are FULLY derived from capabilities.ts (no drift).
 *   3. Unknown roles/slugs resolve to no capabilities (fail-closed).
 *   4. The AI persona alias (`secretary` ↔ `receptionist`) references the one
 *      canonical mapping.
 */
import { describe, it, expect } from "vitest";
import { assertAgentAllowed, ROLE_TO_AGENT } from "@/lib/ai/agent-config";
import {
  ALL_CAPABILITIES,
  CAPABILITIES,
  CORE_ROLE_ORDER,
  CORE_ROLE_SLUGS,
  EXTRA_PROTECTED_SLUGS,
  PERSONA_ALIASES,
  PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS,
  ROLE_TO_PERSONA,
  SPECIALIST_CAPABILITIES,
  SPECIALIST_PROTECTED_PREFIXES,
  canonicalPersona,
  capabilitiesForRole,
  capabilityForSlug,
  isCoreRole,
  roleHasCapability,
  type Capability,
  type CoreRole,
} from "@/lib/config/capabilities";
import {
  SPECIALIST_PROTECTED_PREFIXES as ROUTES_SPECIALIST_PREFIXES,
} from "@/lib/middleware/routes";

describe("capabilities: specialist slug → capability", () => {
  it("every specialist slug (canonical + aliases) maps to exactly one capability", () => {
    for (const def of SPECIALIST_CAPABILITIES) {
      expect(capabilityForSlug(def.slug)).toBe(def.capability);
      for (const alias of def.aliases) {
        expect(capabilityForSlug(alias)).toBe(def.capability);
      }
    }
  });

  it("each canonical slug is unique", () => {
    const slugs = SPECIALIST_CAPABILITIES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("no slug/alias collides across two different capabilities", () => {
    const seen = new Map<string, Capability>();
    for (const def of SPECIALIST_CAPABILITIES) {
      for (const id of [def.slug, ...def.aliases]) {
        if (seen.has(id)) {
          expect(seen.get(id)).toBe(def.capability);
        }
        seen.set(id, def.capability);
      }
    }
  });

  it("resolves the historical speech-therapist / speech_therapist drift to one capability", () => {
    expect(capabilityForSlug("speech-therapist")).toBe("speech_therapy");
    expect(capabilityForSlug("speech_therapist")).toBe("speech_therapy");
  });

  it("every mapped capability is a member of the Capability union", () => {
    for (const def of SPECIALIST_CAPABILITIES) {
      expect(ALL_CAPABILITIES).toContain(def.capability);
    }
  });
});

describe("capabilities: derived lists have NO drift", () => {
  it("SPECIALIST_PROTECTED_PREFIXES is derived from SPECIALIST_CAPABILITIES", () => {
    const expected = SPECIALIST_CAPABILITIES.map((s) => `/${s.slug}`);
    expect([...SPECIALIST_PROTECTED_PREFIXES]).toEqual(expected);
  });

  it("routes.ts re-exports the SAME derived prefix list", () => {
    expect([...ROUTES_SPECIALIST_PREFIXES]).toEqual([...SPECIALIST_PROTECTED_PREFIXES]);
  });

  it("next.config prefix list is fully derived (core + specialist + extras, each with wildcard)", () => {
    const expected = [
      ...CORE_ROLE_SLUGS,
      ...SPECIALIST_CAPABILITIES.map((s) => s.slug),
      ...EXTRA_PROTECTED_SLUGS,
    ].flatMap((slug) => [`/${slug}`, `/${slug}/:path*`]);
    expect([...PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS]).toEqual(expected);
  });

  it("every specialist prefix appears in the next.config-derived list", () => {
    for (const prefix of SPECIALIST_PROTECTED_PREFIXES) {
      expect(PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS).toContain(prefix);
      expect(PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS).toContain(`${prefix}/:path*`);
    }
  });

  it("every core role slug appears in the next.config-derived list", () => {
    for (const slug of CORE_ROLE_SLUGS) {
      expect(PROTECTED_ROUTE_PREFIXES_WITH_WILDCARDS).toContain(`/${slug}`);
    }
  });
});

describe("capabilities: role → capability map", () => {
  it("defines capabilities for exactly the 5 core roles", () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual([...CORE_ROLE_ORDER].sort());
  });

  it("only grants capabilities from the Capability union", () => {
    for (const role of CORE_ROLE_ORDER) {
      for (const cap of CAPABILITIES[role]) {
        expect(ALL_CAPABILITIES).toContain(cap);
      }
    }
  });

  it("grants every specialist capability to clinic_admin, receptionist and doctor (matches SPECIALIST_STAFF_ROLES gating)", () => {
    const staffRoles: CoreRole[] = ["clinic_admin", "receptionist", "doctor"];
    for (const def of SPECIALIST_CAPABILITIES) {
      for (const role of staffRoles) {
        expect(roleHasCapability(role, def.capability)).toBe(true);
      }
    }
  });

  it("patient carries no operational capabilities", () => {
    expect(capabilitiesForRole("patient")).toEqual([]);
  });

  it("super_admin is platform-only, not a specialist operator", () => {
    expect(CAPABILITIES.super_admin).toEqual(["manage_platform"]);
    for (const def of SPECIALIST_CAPABILITIES) {
      expect(roleHasCapability("super_admin", def.capability)).toBe(false);
    }
  });
});

describe("capabilities: fail-closed on unknown input", () => {
  it("unknown roles resolve to no capabilities", () => {
    expect(capabilitiesForRole("hacker")).toEqual([]);
    expect(capabilitiesForRole("")).toEqual([]);
    expect(capabilitiesForRole("SUPER_ADMIN")).toEqual([]); // case-sensitive
    expect(roleHasCapability("nope", "pharmacy")).toBe(false);
  });

  it("unknown slugs resolve to no capability", () => {
    expect(capabilityForSlug("dentist")).toBeNull();
    expect(capabilityForSlug("")).toBeNull();
    expect(capabilityForSlug("pharmacistt")).toBeNull();
  });

  it("isCoreRole is strict", () => {
    expect(isCoreRole("doctor")).toBe(true);
    expect(isCoreRole("secretary")).toBe(false); // persona, not a DB role
    expect(isCoreRole("pharmacist")).toBe(false); // capability slug, not a role
  });
});

describe("capabilities: AI persona alias reconciliation", () => {
  it("secretary is the canonical persona for the receptionist DB role", () => {
    expect(ROLE_TO_PERSONA.receptionist).toBe("secretary");
  });

  it("receptionist is the documented legacy alias for secretary", () => {
    expect(PERSONA_ALIASES.receptionist).toBe("secretary");
    expect(canonicalPersona("receptionist")).toBe("secretary");
    expect(canonicalPersona("secretary")).toBe("secretary");
  });

  it("the AI layer references the same mapping (ROLE_TO_AGENT === ROLE_TO_PERSONA)", () => {
    expect(ROLE_TO_AGENT).toEqual(ROLE_TO_PERSONA);
  });

  it("assertAgentAllowed honours the alias without independent constants", () => {
    // receptionist may drive both the canonical and the legacy alias
    expect(assertAgentAllowed("receptionist", "secretary")).toBe(true);
    expect(assertAgentAllowed("receptionist", "receptionist")).toBe(true);
    // other roles may only drive their own persona
    expect(assertAgentAllowed("doctor", "doctor")).toBe(true);
    expect(assertAgentAllowed("doctor", "secretary")).toBe(false);
    // a non-receptionist cannot smuggle in via the legacy alias
    expect(assertAgentAllowed("doctor", "receptionist")).toBe(false);
    expect(assertAgentAllowed("patient", "receptionist")).toBe(false);
  });
});
