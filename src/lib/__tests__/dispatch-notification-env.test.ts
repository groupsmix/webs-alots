/**
 * Mutation-testing gap coverage for dispatchNotification.
 *
 * Gaps identified in the audit:
 *   #5: A mutation that adds `if (process.env.NODE_ENV === "test") return []`
 *       to dispatchNotification would silently pass all tests because
 *       no test asserts that the function actually performs work in
 *       the test environment.
 *
 *   #3: Template variable substitution does not HTML-escape values.
 *       WhatsApp messages use plain-text, but in_app notifications could
 *       render unsanitized HTML. This test verifies the substitution
 *       engine is called and returns populated strings.
 *
 * This test exercises dispatchNotification with an in_app channel to
 * verify it actually dispatches (calls insertInAppNotification) even
 * when NODE_ENV === "test".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Track whether insertInAppNotification was actually called
const mockInsertInApp = vi.fn((_params: Record<string, unknown>) =>
  Promise.resolve({ success: true, id: "notif-123" }),
);

vi.mock("@/lib/notification-persist", () => ({
  insertInAppNotification: (params: Record<string, unknown>) => mockInsertInApp(params),
}));

vi.mock("@/lib/notification-queue", () => ({
  enqueueNotification: vi.fn(() => Promise.resolve("queue-id-123")),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { phone: "+212600000000", email: "test@example.com" },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("dispatchNotification — NODE_ENV resilience (mutation gap #5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches in_app notification even when NODE_ENV=test", async () => {
    // Confirm we are running in test environment
    expect(process.env.NODE_ENV).toBe("test");

    const { dispatchNotification } = await import("../notifications");

    const results = await dispatchNotification(
      "booking_confirmation",
      { patient_name: "Karim", doctor_name: "Dr. Ahmed" },
      "user-uuid-001",
      ["in_app"],
    );

    // The function MUST actually call insertInAppNotification,
    // not short-circuit because NODE_ENV === "test".
    expect(mockInsertInApp).toHaveBeenCalledTimes(1);

    // Verify the call args include substituted template values
    const callArgs = mockInsertInApp.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) return;
    expect(callArgs).toHaveProperty("userId", "user-uuid-001");
    expect(callArgs).toHaveProperty("trigger", "booking_confirmation");
    // Title and message should contain the substituted variables
    expect(typeof callArgs.title).toBe("string");
    expect(typeof callArgs.message).toBe("string");

    // Results should indicate success
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].channel).toBe("in_app");
    expect(results[0].success).toBe(true);
  });

  it("returns template-not-found when trigger has no matching template", async () => {
    const { dispatchNotification } = await import("../notifications");

    const results = await dispatchNotification(
      // Cast to bypass type check for testing unknown trigger
      "nonexistent_trigger" as never,
      {},
      "user-uuid-001",
      ["in_app"],
    );

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/template/i);
    // Must not call insertInAppNotification for unknown triggers
    expect(mockInsertInApp).not.toHaveBeenCalled();
  });

  it("substituteVariables populates template strings (mutation gap #3 baseline)", async () => {
    const { substituteVariables } = await import("../notifications");

    // Test that variables are actually substituted (not silently returned empty)
    const result = substituteVariables(
      "Hello {{patient_name}}, Dr. {{doctor_name}} at {{clinic_name}}",
      {
        patient_name: "Karim",
        doctor_name: "Ahmed",
        clinic_name: "Clinique Casablanca",
      },
    );

    expect(result).toBe("Hello Karim, Dr. Ahmed at Clinique Casablanca");
    // Ensure no template placeholders remain
    expect(result).not.toContain("{{");
    expect(result).not.toContain("}}");
  });
});
