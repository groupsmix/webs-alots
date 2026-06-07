/**
 * Tests for `notification-preferences-server.ts`. Covers:
 *   - reads existing rows and merges them on top of DEFAULT_NOTIFICATION_PREFERENCES
 *   - returns defaults when no row exists for the user
 *   - fails open to DEFAULT_NOTIFICATION_PREFERENCES when the admin client throws
 *   - upsert path persists the merged settings
 *   - shouldDeliverNotification combines preferences with channel/trigger gating
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));
const mockCreate = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: mockCreate,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("getNotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockCreate.mockReturnValue({ from: mockFrom });
  });

  it("returns DEFAULT_NOTIFICATION_PREFERENCES when no row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { getNotificationPreferences } = await import("../notification-preferences-server");
    const { DEFAULT_NOTIFICATION_PREFERENCES } = await import("../notification-preferences");

    const prefs = await getNotificationPreferences("user-1");
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(mockFrom).toHaveBeenCalledWith("notification_preferences");
  });

  it("merges row data onto defaults when a row exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: "user-1",
        clinic_id: "clinic-1",
        whatsapp_enabled: false,
        email_enabled: true,
        in_app_enabled: true,
        appointment_reminders: true,
        booking_confirmations: false,
        payment_receipts: true,
        prescription_updates: true,
        marketing_updates: true,
      },
      error: null,
    });
    const { getNotificationPreferences } = await import("../notification-preferences-server");
    const prefs = await getNotificationPreferences("user-1");

    expect(prefs.whatsapp_enabled).toBe(false);
    expect(prefs.booking_confirmations).toBe(false);
    expect(prefs.marketing_updates).toBe(true);
    expect(prefs.email_enabled).toBe(true);
  });

  it("fails open to DEFAULT_NOTIFICATION_PREFERENCES if the admin client throws", async () => {
    mockCreate.mockImplementationOnce(() => {
      throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
    });
    const { getNotificationPreferences } = await import("../notification-preferences-server");
    const { DEFAULT_NOTIFICATION_PREFERENCES } = await import("../notification-preferences");

    const prefs = await getNotificationPreferences("user-1");
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it("fails open if the query rejects", async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error("connection refused"));
    const { getNotificationPreferences } = await import("../notification-preferences-server");
    const { DEFAULT_NOTIFICATION_PREFERENCES } = await import("../notification-preferences");

    const prefs = await getNotificationPreferences("user-1");
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });
});

describe("saveNotificationPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockCreate.mockReturnValue({ from: mockFrom });
  });

  it("upserts the merged preferences and returns the next state", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const { saveNotificationPreferences } = await import("../notification-preferences-server");
    const next = await saveNotificationPreferences("user-1", "clinic-1", {
      marketing_updates: true,
      whatsapp_enabled: false,
    });

    expect(next.marketing_updates).toBe(true);
    expect(next.whatsapp_enabled).toBe(false);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0] as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(payload.user_id).toBe("user-1");
    expect(payload.clinic_id).toBe("clinic-1");
    expect(payload.marketing_updates).toBe(true);
    expect(payload.whatsapp_enabled).toBe(false);
    expect(options.onConflict).toBe("user_id");
    // Updated-at must be an ISO timestamp.
    expect(typeof payload.updated_at).toBe("string");
    expect(() => new Date(payload.updated_at as string).toISOString()).not.toThrow();
  });

  it("throws when the upsert fails", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: { message: "permission denied" } });

    const { saveNotificationPreferences } = await import("../notification-preferences-server");
    await expect(
      saveNotificationPreferences("user-1", null, { email_enabled: false }),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("shouldDeliverNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockCreate.mockReturnValue({ from: mockFrom });
  });

  it("returns true for an in_app booking_confirmation by default", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { shouldDeliverNotification } = await import("../notification-preferences-server");
    expect(await shouldDeliverNotification("user-1", "in_app", "booking_confirmation")).toBe(true);
  });

  it("returns false when the user has opted out of the channel", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: "user-1",
        clinic_id: "clinic-1",
        whatsapp_enabled: false,
        email_enabled: true,
        in_app_enabled: true,
        appointment_reminders: true,
        booking_confirmations: true,
        payment_receipts: true,
        prescription_updates: true,
        marketing_updates: false,
      },
      error: null,
    });
    const { shouldDeliverNotification } = await import("../notification-preferences-server");
    expect(await shouldDeliverNotification("user-1", "whatsapp", "booking_confirmation")).toBe(
      false,
    );
  });

  it("fails open when preference lookup throws", async () => {
    mockCreate.mockImplementationOnce(() => {
      throw new Error("env missing");
    });
    const { shouldDeliverNotification } = await import("../notification-preferences-server");
    // DEFAULT_NOTIFICATION_PREFERENCES allows whatsapp + booking_confirmation
    expect(await shouldDeliverNotification("user-1", "whatsapp", "booking_confirmation")).toBe(
      true,
    );
  });
});
