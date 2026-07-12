/**
 * ADR 0013: Operations-First Scope Enforcement — Acceptance Tests.
 *
 * Verifies that a freshly-provisioned doctor-type clinic sees only operational
 * surfaces, with every specialty/vertical dashboard and API group hidden until
 * explicitly enabled via feature flags.
 *
 * These are pure unit tests — no database or network required.
 */
import { describe, it, expect } from "vitest";
import {
  VERTICAL_SCOPES,
  ALL_GATED_API_GROUPS,
  ALL_GATED_DASHBOARDS,
  ALL_GATED_FLAGS,
  getVerticalForApiGroup,
  getScopedDashboardForPathname,
  isApiGroupEnabled,
  isDashboardEnabled,
} from "@/lib/config/verticals";
import { isFeatureEnabled, type FeaturesConfig } from "@/lib/features";

describe("ADR 0013: Operations-First Scope Enforcement", () => {
  describe("fresh doctor-type clinic (no flags enabled)", () => {
    // A freshly provisioned general_medicine clinic has NO features_config
    const emptyConfig: FeaturesConfig = {};
    const nullConfig = null;

    it("should deny access to all gated API groups with empty config", () => {
      for (const group of ALL_GATED_API_GROUPS) {
        expect(isApiGroupEnabled(group, emptyConfig)).toBe(false);
      }
    });

    it("should deny access to all gated API groups with null config", () => {
      for (const group of ALL_GATED_API_GROUPS) {
        expect(isApiGroupEnabled(group, nullConfig)).toBe(false);
      }
    });

    it("should deny access to all gated dashboards with empty config", () => {
      for (const dashboard of ALL_GATED_DASHBOARDS) {
        expect(isDashboardEnabled(dashboard, emptyConfig)).toBe(false);
      }
    });

    it("should deny access to all gated dashboards with null config", () => {
      for (const dashboard of ALL_GATED_DASHBOARDS) {
        expect(isDashboardEnabled(dashboard, nullConfig)).toBe(false);
      }
    });

    it("should deny all gated feature flags with empty config", () => {
      for (const flag of ALL_GATED_FLAGS) {
        expect(isFeatureEnabled(emptyConfig, flag)).toBe(false);
      }
    });

    it("should deny all gated feature flags with null config", () => {
      for (const flag of ALL_GATED_FLAGS) {
        expect(isFeatureEnabled(nullConfig, flag)).toBe(false);
      }
    });

    it("should have clinical, ADT, and patient vertical scopes defined (non-healthcare verticals removed)", () => {
      const ids = VERTICAL_SCOPES.map((v) => v.id);
      expect(ids).toContain("clinical");
      expect(ids).toContain("adt");
      expect(ids).toContain("patient");
      expect(ids).not.toContain("veterinary");
      expect(ids).not.toContain("restaurant");
    });
  });

  describe("gated scope inventory", () => {
    it("keeps deleted/stubbed Architecture-B API groups modeled", () => {
      expect(ALL_GATED_API_GROUPS).toEqual(
        expect.arrayContaining([
          "prescriptions",
          "vitals",
          "radiology",
          "insurance-claims",
          "admissions",
        ]),
      );
      expect(ALL_GATED_API_GROUPS).not.toEqual(
        expect.arrayContaining(["pets", "menus", "restaurant-orders", "restaurant-tables"]),
      );
    });

    it("keeps surviving Architecture-B dashboards modeled", () => {
      expect(ALL_GATED_DASHBOARDS).toEqual(
        expect.arrayContaining([
          "doctor/dialysis-sessions",
          "doctor/ivf-cycles",
          "doctor/cardiology",
          "radiology-dashboard",
          "nutritionist",
          "pharmacist",
          "equipment",
        ]),
      );
    });
  });

  describe("operational API groups and dashboards (not gated)", () => {
    it("should allow access to operational routes regardless of config", () => {
      const operationalGroups = [
        "booking",
        "appointments",
        "auth",
        "admin",
        "super-admin",
        "notifications",
        "webhooks",
        "payments",
        "billing",
        "invoices",
        "cron",
      ];

      for (const group of operationalGroups) {
        expect(getVerticalForApiGroup(group)).toBeUndefined();
        expect(isApiGroupEnabled(group, null)).toBe(true);
        expect(isApiGroupEnabled(group, {})).toBe(true);
      }
    });

    it("should allow access to operational dashboard paths regardless of config", () => {
      expect(getScopedDashboardForPathname("/doctor/schedule")).toBeUndefined();
      expect(isDashboardEnabled("doctor/schedule", null)).toBe(true);
      expect(isDashboardEnabled("doctor/schedule", {})).toBe(true);
    });
  });

  describe("explicit vertical enablement", () => {
    it("should allow prescriptions when prescriptions flag is enabled", () => {
      const config: FeaturesConfig = { prescriptions: true };
      expect(isApiGroupEnabled("prescriptions", config)).toBe(true);
    });

    it("should allow admissions when bed_management flag is enabled", () => {
      const config: FeaturesConfig = { bed_management: true };
      expect(isApiGroupEnabled("admissions", config)).toBe(true);
    });

    it("should allow a gated dashboard only when one of its flags is enabled", () => {
      expect(isDashboardEnabled("doctor/dialysis-sessions", {})).toBe(false);
      expect(isDashboardEnabled("doctor/dialysis-sessions", { dialysis_sessions: true })).toBe(
        true,
      );
    });

    it("should allow radiology dashboard when radiology reports are enabled", () => {
      expect(isDashboardEnabled("radiology-dashboard", {})).toBe(false);
      expect(isDashboardEnabled("radiology-dashboard", { radiology_reports: true })).toBe(true);
    });

    it("should NOT allow clinical access with non-clinical flags", () => {
      const config: FeaturesConfig = {
        appointments: true,
        website: true,
      };
      expect(isApiGroupEnabled("prescriptions", config)).toBe(false);
      expect(isApiGroupEnabled("vitals", config)).toBe(false);
      expect(isApiGroupEnabled("radiology", config)).toBe(false);
      expect(isApiGroupEnabled("admissions", config)).toBe(false);
      expect(isDashboardEnabled("doctor/cardiology", config)).toBe(false);
      expect(isDashboardEnabled("radiology-dashboard", config)).toBe(false);
    });
  });

  describe("getVerticalForApiGroup mapping", () => {
    it("maps clinical API groups to the clinical vertical", () => {
      expect(getVerticalForApiGroup("prescriptions")?.id).toBe("clinical");
      expect(getVerticalForApiGroup("vitals")?.id).toBe("clinical");
      expect(getVerticalForApiGroup("radiology")?.id).toBe("clinical");
      expect(getVerticalForApiGroup("insurance-claims")?.id).toBe("clinical");
    });

    it("maps admissions to the ADT vertical", () => {
      expect(getVerticalForApiGroup("admissions")?.id).toBe("adt");
    });

    it("returns undefined for removed non-healthcare API groups", () => {
      expect(getVerticalForApiGroup("pets")).toBeUndefined();
      expect(getVerticalForApiGroup("menus")).toBeUndefined();
      expect(getVerticalForApiGroup("restaurant-orders")).toBeUndefined();
      expect(getVerticalForApiGroup("restaurant-tables")).toBeUndefined();
    });

    it("returns undefined for operational groups", () => {
      expect(getVerticalForApiGroup("booking")).toBeUndefined();
      expect(getVerticalForApiGroup("payments")).toBeUndefined();
      expect(getVerticalForApiGroup("auth")).toBeUndefined();
    });
  });

  describe("getScopedDashboardForPathname mapping", () => {
    it("maps gated doctor dashboards from pathnames", () => {
      expect(getScopedDashboardForPathname("/doctor/dialysis-sessions")).toBe(
        "doctor/dialysis-sessions",
      );
      expect(getScopedDashboardForPathname("/doctor/ivf-cycles/123")).toBe("doctor/ivf-cycles");
    });

    it("maps gated specialist dashboards from pathnames", () => {
      expect(getScopedDashboardForPathname("/radiology/orders")).toBe("radiology-dashboard");
      expect(getScopedDashboardForPathname("/nutritionist/meal-plans")).toBe("nutritionist");
      expect(getScopedDashboardForPathname("/pharmacist/stock")).toBe("pharmacist");
      expect(getScopedDashboardForPathname("/equipment/maintenance")).toBe("equipment");
    });

    it("returns undefined for operational dashboard paths", () => {
      expect(getScopedDashboardForPathname("/doctor/schedule")).toBeUndefined();
      expect(getScopedDashboardForPathname("/admin/dashboard")).toBeUndefined();
    });
  });
});
