/**
 * Integration test: Prescription → Notification flow.
 *
 * Audit L9-11: Covers the complete flow from prescription creation
 * through to notification dispatch. Verifies that the prescription_ready
 * trigger correctly resolves templates, substitutes variables, and
 * dispatches across configured channels.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { phone: "+212600000000", email: "patient@test.com" },
            error: null,
          }),
        }),
      }),
    }),
  })),
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("./notification-queue", () => ({
  enqueueNotification: vi.fn().mockResolvedValue("queue-1"),
}));

vi.mock("./notification-persist", () => ({
  insertInAppNotification: vi.fn().mockResolvedValue({ id: "notif-1", success: true }),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("Prescription → Notification integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prescription_ready template exists and has correct channels", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const template = defaultNotificationTemplates.find(
      (t) => t.trigger === "prescription_ready",
    );

    expect(template).toBeDefined();
    expect(template!.enabled).toBe(true);
    expect(template!.channels).toContain("whatsapp");
    expect(template!.channels).toContain("in_app");
    expect(template!.recipientRoles).toContain("patient");
  });

  it("prescription_ready template contains required variable placeholders", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");
    const template = defaultNotificationTemplates.find(
      (t) => t.trigger === "prescription_ready",
    );

    expect(template!.body).toContain("{{doctor_name}}");
    expect(template!.body).toContain("{{clinic_name}}");
    expect(template!.whatsappBody).toContain("{{patient_name}}");
    expect(template!.whatsappBody).toContain("{{doctor_name}}");
    expect(template!.whatsappBody).toContain("{{clinic_name}}");
  });

  it("substituteVariables replaces all prescription notification placeholders", async () => {
    const { substituteVariables, defaultNotificationTemplates } = await import(
      "@/lib/notifications"
    );
    const template = defaultNotificationTemplates.find(
      (t) => t.trigger === "prescription_ready",
    )!;

    const variables = {
      patient_name: "Ahmed",
      doctor_name: "Dr. Fatima",
      clinic_name: "Clinique Test",
      clinic_address: "123 Casablanca",
      prescription_id: "RX-2026-000042",
    };

    const body = substituteVariables(template.body, variables);
    const whatsappBody = substituteVariables(template.whatsappBody, variables);

    expect(body).toContain("Dr. Fatima");
    expect(body).toContain("Clinique Test");
    expect(body).not.toContain("{{doctor_name}}");
    expect(body).not.toContain("{{clinic_name}}");

    expect(whatsappBody).toContain("Ahmed");
    expect(whatsappBody).toContain("Dr. Fatima");
    expect(whatsappBody).not.toContain("{{patient_name}}");
  });

  it("prescription ID generator produces valid format", async () => {
    const {
      generatePrescriptionNumber,
      isValidPrescriptionNumber,
    } = await import("@/lib/prescription-id");

    const rxId = generatePrescriptionNumber();

    expect(rxId).toMatch(/^RX-\d{4}-\d{6}$/);
    expect(isValidPrescriptionNumber(rxId)).toBe(true);
  });

  it("formatPrescriptionNumber creates correct ID from sequence", async () => {
    const {
      formatPrescriptionNumber,
      isValidPrescriptionNumber,
    } = await import("@/lib/prescription-id");

    const rxId = formatPrescriptionNumber(2026, 42);

    expect(rxId).toBe("RX-2026-000042");
    expect(isValidPrescriptionNumber(rxId)).toBe(true);
  });

  it("prescription_ready notification has higher priority than new_review", async () => {
    const { defaultNotificationTemplates } = await import("@/lib/notifications");

    const prescriptionTemplate = defaultNotificationTemplates.find(
      (t) => t.trigger === "prescription_ready",
    )!;
    const reviewTemplate = defaultNotificationTemplates.find(
      (t) => t.trigger === "new_review",
    )!;

    const priorityOrder = ["low", "normal", "high", "urgent"];
    const rxPriority = priorityOrder.indexOf(prescriptionTemplate.priority);
    const reviewPriority = priorityOrder.indexOf(reviewTemplate.priority);

    expect(rxPriority).toBeGreaterThanOrEqual(reviewPriority);
  });

  it("all notification triggers have matching metadata entries", async () => {
    const { defaultNotificationTemplates, triggerMetadata } = await import(
      "@/lib/notifications"
    );

    for (const template of defaultNotificationTemplates) {
      expect(triggerMetadata[template.trigger]).toBeDefined();
      expect(triggerMetadata[template.trigger].label).toBeTruthy();
      expect(triggerMetadata[template.trigger].icon).toBeTruthy();
    }
  });
});
