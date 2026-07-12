import { describe, it, expect, vi } from "vitest";
import { getWhatsAppTemplate } from "@/lib/whatsapp";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockSupabase = createMockSupabaseClient({
  whatsapp_templates: [
    {
      clinic_id: "clinic-1",
      template_name: "booking_confirmation",
      language: "fr",
      status: "approved",
      body_template: "Custom template for {{patient_name}}",
    },
  ],
});

vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe("getWhatsAppTemplate", () => {
  it("loads a custom template from the database when available", async () => {
    const body = await getWhatsAppTemplate("clinic-1", "booking_confirmation", "fr");
    expect(body).toContain("Custom template");
  });

  it("falls back to the default French booking confirmation template", async () => {
    vi.mocked(mockSupabase.from).mockImplementationOnce(() => {
      const builder = createMockSupabaseClient({}).from("whatsapp_templates");
      return builder.eq("clinic_id", "clinic-1").eq("template_name", "booking_confirmation");
    });
    const body = await getWhatsAppTemplate("clinic-2", "booking_confirmation", "fr");
    expect(body).toContain("Bonjour");
    expect(body).toContain("{{patient_name}}");
  });

  it("returns the Darija template for darija locale", async () => {
    const body = await getWhatsAppTemplate("clinic-3", "appointment_reminder", "darija");
    expect(body).toContain("تذكار");
    expect(body).toContain("{{doctor_name}}");
  });

  it("returns the Arabic template for ar locale", async () => {
    const body = await getWhatsAppTemplate("clinic-4", "nps_survey", "ar");
    expect(body).toContain("شاركنا");
    expect(body).toContain("{{survey_url}}");
  });

  it("returns null for unknown template name", async () => {
    const body = await getWhatsAppTemplate("clinic-5", "unknown_template", "fr");
    expect(body).toBeNull();
  });

  it("returns null for unknown language", async () => {
    const body = await getWhatsAppTemplate("clinic-6", "booking_confirmation", "de");
    expect(body).toBeNull();
  });
});
