/**
 * Tests for src/lib/whatsapp/whatsapp-templates-darija.ts
 *
 * Covers:
 *   - DARIJA_TEMPLATES structure and completeness
 *   - renderDarijaTemplate variable replacement
 *   - toMetaPositionalBody conversion
 *   - getTemplatesByCategory filtering
 */
import { describe, it, expect } from "vitest";
import {
  DARIJA_TEMPLATES,
  renderDarijaTemplate,
  toMetaPositionalBody,
  getTemplatesByCategory,
} from "@/lib/whatsapp/whatsapp-templates-darija";

describe("whatsapp-templates-darija — DARIJA_TEMPLATES", () => {
  it("contains all expected template keys", () => {
    const expectedKeys = [
      "booking_confirmation_darija",
      "reminder_24h_darija",
      "reminder_2h_darija",
      "cancellation_darija",
      "prescription_ready_darija",
      "lab_results_ready_darija",
      "payment_reminder_darija",
      "voice_booking_confirmed_darija",
      "consent_request_darija",
      "no_show_followup_darija",
    ];

    for (const key of expectedKeys) {
      expect(DARIJA_TEMPLATES[key]).toBeDefined();
    }
  });

  it("all templates have required fields", () => {
    for (const [key, template] of Object.entries(DARIJA_TEMPLATES)) {
      expect(template.metaTemplateName, `${key}: metaTemplateName`).toBeTruthy();
      expect(template.category, `${key}: category`).toMatch(/^(UTILITY|MARKETING|AUTHENTICATION)$/);
      expect(template.language, `${key}: language`).toBe("ar");
      expect(template.bodyTemplate, `${key}: bodyTemplate`).toBeTruthy();
      expect(template.variables, `${key}: variables`).toBeInstanceOf(Array);
      expect(template.variables.length, `${key}: variables length`).toBeGreaterThan(0);
      expect(template.description, `${key}: description`).toBeTruthy();
    }
  });

  it("all templates reference their variables in the body", () => {
    for (const [key, template] of Object.entries(DARIJA_TEMPLATES)) {
      for (const varName of template.variables) {
        expect(
          template.bodyTemplate.includes(`{{${varName}}}`),
          `${key}: body missing {{${varName}}}`,
        ).toBe(true);
      }
    }
  });
});

describe("whatsapp-templates-darija — renderDarijaTemplate", () => {
  it("replaces all variables with provided values", () => {
    const rendered = renderDarijaTemplate("consent_request_darija", {
      patient_name: "Ahmed",
      clinic_name: "Clinique Test",
    });

    expect(rendered).not.toBeNull();
    expect(rendered).toContain("Ahmed");
    expect(rendered).toContain("Clinique Test");
    expect(rendered).not.toContain("{{patient_name}}");
    expect(rendered).not.toContain("{{clinic_name}}");
  });

  it("returns null for unknown template key", () => {
    const rendered = renderDarijaTemplate("nonexistent_template", {});
    expect(rendered).toBeNull();
  });

  it("replaces missing variables with empty string", () => {
    const rendered = renderDarijaTemplate("consent_request_darija", {
      patient_name: "Ahmed",
    });

    expect(rendered).not.toBeNull();
    expect(rendered).toContain("Ahmed");
    expect(rendered).not.toContain("{{patient_name}}");
    expect(rendered).not.toContain("{{clinic_name}}");
  });
});

describe("whatsapp-templates-darija — toMetaPositionalBody", () => {
  it("converts named variables to positional {{1}} {{2}} etc.", () => {
    const body = toMetaPositionalBody("consent_request_darija");
    expect(body).not.toBeNull();
    expect(body).toContain("{{1}}");
    expect(body).toContain("{{2}}");
    expect(body).not.toContain("{{patient_name}}");
    expect(body).not.toContain("{{clinic_name}}");
  });

  it("returns null for unknown template key", () => {
    const body = toMetaPositionalBody("nonexistent_template");
    expect(body).toBeNull();
  });

  it("booking_confirmation_darija has 8 positional variables", () => {
    const body = toMetaPositionalBody("booking_confirmation_darija");
    expect(body).not.toBeNull();
    expect(body).toContain("{{8}}");
  });
});

describe("whatsapp-templates-darija — getTemplatesByCategory", () => {
  it("returns all UTILITY templates", () => {
    const utility = getTemplatesByCategory("UTILITY");
    expect(utility.length).toBeGreaterThan(0);
    for (const t of utility) {
      expect(t.category).toBe("UTILITY");
    }
  });

  it("returns empty array for MARKETING category (none defined)", () => {
    const marketing = getTemplatesByCategory("MARKETING");
    expect(marketing).toEqual([]);
  });
});
