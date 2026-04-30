/**
 * Mutation-testing gap coverage for notification-persist.ts.
 *
 * Gaps identified in the audit:
 *   #1 (dispatchNotification): Drop clinic_id from notification insert — the
 *       insert in notification-persist.ts MUST include clinic_id. Without it,
 *       a cross-tenant leak could occur because downstream queries on the
 *       notifications table may only filter by user_id.
 *
 * This test verifies the full insert path through insertInAppNotification,
 * asserting that clinic_id is always included in the Supabase insert call.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn((_row: Record<string, unknown>) => ({ select: mockSelect }));
const mockUserSingle = vi.fn();
const mockUserEq = vi.fn(() => ({ single: mockUserSingle }));
const mockUserSelect = vi.fn(() => ({ eq: mockUserEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === "users") {
    return { select: mockUserSelect };
  }
  if (table === "notifications") {
    return { insert: mockInsert };
  }
  return {};
});

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("insertInAppNotification — clinic_id inclusion (mutation gap #1)", () => {
  const TEST_USER_ID = "user-uuid-1234";
  const TEST_CLINIC_ID = "clinic-uuid-5678";

  beforeEach(() => {
    vi.clearAllMocks();

    // User lookup returns a clinic_id
    mockUserSingle.mockResolvedValue({
      data: { clinic_id: TEST_CLINIC_ID },
      error: null,
    });

    // Notification insert succeeds
    mockSingle.mockResolvedValue({
      data: { id: "notif-uuid-001" },
      error: null,
    });
  });

  it("includes clinic_id in the notification insert payload", async () => {
    const { insertInAppNotification } = await import("../notification-persist");

    await insertInAppNotification({
      userId: TEST_USER_ID,
      trigger: "booking_confirmation",
      title: "Appointment Confirmed",
      message: "Your appointment is confirmed.",
    });

    // Verify the insert was called
    expect(mockInsert).toHaveBeenCalledTimes(1);

    // Extract the insert payload
    const insertPayload = mockInsert.mock.calls[0]?.[0];
    expect(insertPayload).toBeDefined();

    // CRITICAL: clinic_id must be present and match the user's clinic
    expect(insertPayload).toHaveProperty("clinic_id", TEST_CLINIC_ID);
    expect(insertPayload).toHaveProperty("user_id", TEST_USER_ID);
    expect(insertPayload).toHaveProperty("type", "booking_confirmation");
    expect(insertPayload).toHaveProperty("channel", "in_app");
  });

  it("fails gracefully when user has no clinic_id", async () => {
    mockUserSingle.mockResolvedValue({
      data: { clinic_id: null },
      error: null,
    });

    const { insertInAppNotification } = await import("../notification-persist");

    const result = await insertInAppNotification({
      userId: TEST_USER_ID,
      trigger: "booking_confirmation",
      title: "Test",
      message: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/clinic_id/i);
    // Insert should NOT have been called without a clinic_id
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("fails gracefully when user lookup returns null", async () => {
    mockUserSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { insertInAppNotification } = await import("../notification-persist");

    const result = await insertInAppNotification({
      userId: "nonexistent-user",
      trigger: "booking_confirmation",
      title: "Test",
      message: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|clinic_id/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("insert payload always has is_read set to false", async () => {
    const { insertInAppNotification } = await import("../notification-persist");

    await insertInAppNotification({
      userId: TEST_USER_ID,
      trigger: "new_booking",
      title: "New Booking",
      message: "A new booking was made.",
    });

    const insertPayload = mockInsert.mock.calls[0]?.[0];
    expect(insertPayload).toBeDefined();
    expect(insertPayload?.is_read).toBe(false);
  });
});
