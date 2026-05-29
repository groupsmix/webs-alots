/**
 * Tests for src/lib/whatsapp/whatsapp-consent.ts
 *
 * Covers:
 *   - grantWhatsAppConsent
 *   - revokeWhatsAppConsent
 *   - hasWhatsAppConsent
 *   - getConsentStatus
 *   - exportConsentData
 *   - deletePatientWhatsAppData
 *   - handleConsentReply
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Supabase client ──

function createMockConsentClient() {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const insertSelectMock = vi.fn().mockResolvedValue({ data: [{}], error: null });
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
  const selectSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });

  return {
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: selectSingleMock,
              maybeSingle: selectSingleMock,
              order: orderMock,
            }),
            maybeSingle: selectSingleMock,
            order: orderMock,
          }),
        }),
        upsert: upsertMock,
        insert: vi.fn().mockReturnValue({
          select: insertSelectMock,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: updateEqMock,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: deleteEqMock,
          }),
        }),
      }),
    },
    mocks: {
      upsert: upsertMock,
      insertSelect: insertSelectMock,
      updateEq: updateEqMock,
      deleteEq: deleteEqMock,
      selectSingle: selectSingleMock,
      orderMock,
    },
  };
}

// ── Tests ──

describe("whatsapp-consent — grantWhatsAppConsent", () => {
  beforeEach(() => {
    vi.resetModules();

    vi.doMock("@/lib/audit-log", () => ({
      logAuditEvent: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records consent and logs audit event", async () => {
    const { client, mocks } = createMockConsentClient();

    const { grantWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await grantWhatsAppConsent(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      method: "whatsapp_reply",
    });

    expect(result.success).toBe(true);
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.insertSelect).toHaveBeenCalled();
  });

  it("returns error when upsert fails", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.upsert.mockResolvedValueOnce({ error: { message: "DB error" } });

    const { grantWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await grantWhatsAppConsent(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      method: "web_form",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("whatsapp-consent — revokeWhatsAppConsent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({
      logAuditEvent: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("revokes consent and logs audit event", async () => {
    const { client, mocks } = createMockConsentClient();

    const { revokeWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await revokeWhatsAppConsent(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
    });

    expect(result.success).toBe(true);
    expect(mocks.updateEq).toHaveBeenCalled();
  });
});

describe("whatsapp-consent — hasWhatsAppConsent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({
      logAuditEvent: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when consent is granted", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.selectSingle.mockResolvedValueOnce({
      data: { status: "granted" },
      error: null,
    });

    const { hasWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await hasWhatsAppConsent(client, "clinic-123", "patient-456");
    expect(result).toBe(true);
  });

  it("returns false when consent is revoked", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.selectSingle.mockResolvedValueOnce({
      data: { status: "revoked" },
      error: null,
    });

    const { hasWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await hasWhatsAppConsent(client, "clinic-123", "patient-456");
    expect(result).toBe(false);
  });

  it("returns false when no consent record exists", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.selectSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { hasWhatsAppConsent } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await hasWhatsAppConsent(client, "clinic-123", "patient-456");
    expect(result).toBe(false);
  });
});

describe("whatsapp-consent — handleConsentReply", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({
      logAuditEvent: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("grants consent when reply is OUI", async () => {
    const { client, mocks } = createMockConsentClient();

    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "OUI",
    });

    expect(result).toBe(true);
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("revokes consent when reply is STOP", async () => {
    const { client, mocks } = createMockConsentClient();

    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "STOP",
    });

    expect(result).toBe(true);
    expect(mocks.updateEq).toHaveBeenCalled();
  });

  it("returns false for unrecognized reply", async () => {
    const { client } = createMockConsentClient();

    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");

    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "hello",
    });

    expect(result).toBe(false);
  });

  it("grants consent when reply is YES", async () => {
    const { client, mocks } = createMockConsentClient();
    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "YES",
    });
    expect(result).toBe(true);
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it("revokes consent when reply is NON", async () => {
    const { client, mocks } = createMockConsentClient();
    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "NON",
    });
    expect(result).toBe(true);
    expect(mocks.updateEq).toHaveBeenCalled();
  });

  it("revokes consent when reply is لا (Arabic NO)", async () => {
    const { client, mocks } = createMockConsentClient();
    const { handleConsentReply } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await handleConsentReply(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
      patientPhone: "+212600000000",
      replyText: "لا",
    });
    expect(result).toBe(true);
    expect(mocks.updateEq).toHaveBeenCalled();
  });
});

describe("whatsapp-consent — getConsentStatus", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns full consent record when exists", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.selectSingle.mockResolvedValueOnce({
      data: {
        id: "consent-1",
        clinic_id: "clinic-123",
        patient_id: "patient-456",
        patient_phone: "+212600000000",
        status: "granted",
        granted_at: "2026-01-01T00:00:00Z",
        revoked_at: null,
        ip_address: null,
        consent_method: "whatsapp_reply",
        consent_version: "1.0",
        data_categories: ["appointment_notifications"],
      },
      error: null,
    });
    const { getConsentStatus } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await getConsentStatus(client, "clinic-123", "patient-456");
    expect(result).not.toBeNull();
    expect(result!.status).toBe("granted");
    expect(result!.consent_method).toBe("whatsapp_reply");
  });

  it("returns null when no record", async () => {
    const { client } = createMockConsentClient();
    const { getConsentStatus } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await getConsentStatus(client, "clinic-123", "patient-456");
    expect(result).toBeNull();
  });
});

describe("whatsapp-consent — exportConsentData", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports consent and history for Art. 15 compliance", async () => {
    const { client, mocks } = createMockConsentClient();
    // First call: getConsentStatus -> maybeSingle
    mocks.selectSingle.mockResolvedValueOnce({
      data: {
        id: "consent-1",
        clinic_id: "c",
        patient_id: "p",
        patient_phone: "+212",
        status: "granted",
        granted_at: "2026-01-01",
        revoked_at: null,
        ip_address: null,
        consent_method: "whatsapp_reply",
        consent_version: "1.0",
        data_categories: ["appointment_notifications"],
      },
      error: null,
    });
    // Second call: consent_logs -> order
    mocks.orderMock.mockResolvedValueOnce({
      data: [
        {
          consent_type: "whatsapp_communications",
          granted: true,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          consent_type: "whatsapp_communications",
          granted: false,
          created_at: "2026-02-01T00:00:00Z",
        },
      ],
      error: null,
    });
    const { exportConsentData } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await exportConsentData(client, "clinic-123", "patient-456");
    expect(result.consent).not.toBeNull();
    expect(result.consentHistory).toHaveLength(2);
    expect(result.consentHistory[0].action).toBe("granted");
    expect(result.consentHistory[1].action).toBe("revoked");
  });

  it("returns empty history when no consent logs", async () => {
    const { client } = createMockConsentClient();
    const { exportConsentData } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await exportConsentData(client, "clinic-123", "patient-456");
    expect(result.consent).toBeNull();
    expect(result.consentHistory).toHaveLength(0);
  });
});

describe("whatsapp-consent — deletePatientWhatsAppData", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("@/lib/whatsapp", () => ({
      sendTextMessage: vi.fn().mockResolvedValue({ success: true }),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes consent, conversations, and transcriptions for Art. 17", async () => {
    const { client, mocks } = createMockConsentClient();
    const { deletePatientWhatsAppData } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await deletePatientWhatsAppData(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
    });
    expect(result.success).toBe(true);
    expect(result.deletedRecords).toBe(3);
    expect(mocks.deleteEq).toHaveBeenCalledTimes(3);
  });

  it("counts only successful deletions", async () => {
    const { client, mocks } = createMockConsentClient();
    mocks.deleteEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "fail" } })
      .mockResolvedValueOnce({ error: null });
    const { deletePatientWhatsAppData } = await import("@/lib/whatsapp/whatsapp-consent");
    const result = await deletePatientWhatsAppData(client, {
      clinicId: "clinic-123",
      clinicName: "Test Clinic",
      patientId: "patient-456",
    });
    expect(result.success).toBe(true);
    expect(result.deletedRecords).toBe(2);
  });
});
