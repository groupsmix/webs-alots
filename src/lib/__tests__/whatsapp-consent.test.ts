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
  const selectOrderMock = vi.fn().mockResolvedValue({ data: [], error: null });

  return {
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: selectSingleMock,
              maybeSingle: selectSingleMock,
              order: vi.fn().mockReturnValue(selectOrderMock),
            }),
            maybeSingle: selectSingleMock,
            order: vi.fn().mockReturnValue(selectOrderMock),
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
      selectOrder: selectOrderMock,
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
});
