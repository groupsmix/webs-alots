/**
 * Integration tests for Booking Token Tenant Isolation (A6-13)
 *
 * Tests the complete booking flow to ensure tokens from one clinic
 * cannot be used to make bookings in another clinic (cross-tenant replay protection).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createTenantClient: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireTenantWithConfig: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  bookingLimiter: {
    check: vi.fn().mockResolvedValue(true),
  },
  extractClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/data/public", () => ({
  getPublicDoctors: vi.fn().mockResolvedValue([
    { id: "doctor-1", name: "Dr. Smith", clinic_id: "clinic-123" },
  ]),
  getPublicServices: vi.fn().mockResolvedValue([
    { id: "service-1", name: "Consultation", duration: 30, price: 200, currency: "MAD" },
  ]),
  getPublicSpecialties: vi.fn().mockResolvedValue([
    { id: "specialty-1", name: "General Medicine" },
  ]),
  getPublicGeneratedSlots: vi.fn().mockResolvedValue(["09:00", "09:30", "10:00"]),
  getPublicAvailableSlots: vi.fn().mockResolvedValue(["09:00", "09:30", "10:00"]),
  getPublicSlotBookingCounts: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  dispatchNotification: vi.fn(),
}));

vi.mock("@/lib/timezone", () => ({
  computeEndTime: vi.fn(() => ({ endTime: "09:30", overflows: false })),
}));

// Helper to create mock request
function createMockRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/booking", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// Helper to create mock Supabase client
function createMockSupabaseClient(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "doctor-1" },
            error: null,
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockImplementation((fnName) => {
      if (fnName === "booking_find_or_create_patient") {
        return Promise.resolve({ data: "patient-123", error: null });
      }
      if (fnName === "booking_atomic_insert") {
        return Promise.resolve({ data: "appointment-123", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  } as unknown as SupabaseClient;
}

// Helper to create a valid booking token
async function createBookingToken(clinicId: string, phone: string): Promise<string> {
  const secret = "test-secret-key-for-booking-tokens";
  const expiry = Date.now() + 15 * 60 * 1000;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigData = encoder.encode(`${clinicId}:${phone}:${expiry}`);
  const sig = await crypto.subtle.sign("HMAC", key, sigData);
  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${clinicId}:${phone}:${expiry}:${signature}`;
}

describe("Booking Token Tenant Isolation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.BOOKING_TOKEN_SECRET = "test-secret-key-for-booking-tokens";
    
    // Setup default mocks
    const { createTenantClient } = vi.mocked(await import("@/lib/supabase-server"));
    createTenantClient.mockResolvedValue(createMockSupabaseClient());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should accept token from same clinic", async () => {
    const clinicId = "clinic-123";
    const phone = "+212612345678";
    
    // Setup tenant context for clinic A
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId,
        clinicName: "Clinic A",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true }, // Monday
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create token for clinic A
    const token = await createBookingToken(clinicId, phone);
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12", // Monday
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: phone,
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": token,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.appointment.id).toBe("appointment-123");
  });

  it("should reject token from different clinic", async () => {
    const tokenClinicId = "clinic-123";
    const currentClinicId = "clinic-456";
    const phone = "+212612345678";
    
    // Setup tenant context for clinic B
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId: currentClinicId,
        clinicName: "Clinic B",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true },
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create token for clinic A but try to use it in clinic B
    const token = await createBookingToken(tokenClinicId, phone);
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12",
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: phone,
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": token,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("different clinic");
    
    // Verify cross-tenant rejection was logged
    const { logger } = await import("@/lib/logger");
    expect(logger.warn).toHaveBeenCalledWith(
      "Cross-tenant booking token rejected",
      expect.objectContaining({
        context: "booking",
        tokenClinicId: "clinic-123",
        expectedClinicId: "clinic-456",
      })
    );
  });

  it("should reject old 3-part token format with friendly error", async () => {
    const clinicId = "clinic-123";
    const phone = "+212612345678";
    
    // Setup tenant context
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId,
        clinicName: "Test Clinic",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true },
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create old-style 3-part token (phone:expiry:signature)
    const secret = "test-secret-key-for-booking-tokens";
    const expiry = Date.now() + 15 * 60 * 1000;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigData = encoder.encode(`${phone}:${expiry}`); // Old format without clinicId
    const sig = await crypto.subtle.sign("HMAC", key, sigData);
    const signature = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const oldToken = `${phone}:${expiry}:${signature}`; // 3 parts
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12",
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: phone,
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": oldToken,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Your booking link has expired. Please request a new one.");
    
    // Verify old token format was logged
    const { logger } = await import("@/lib/logger");
    expect(logger.info).toHaveBeenCalledWith(
      "Old 3-part booking token rejected",
      expect.objectContaining({
        context: "booking",
        tokenFormat: "legacy-3-part",
      })
    );
  });

  it("should reject expired tokens", async () => {
    const clinicId = "clinic-123";
    const phone = "+212612345678";
    
    // Setup tenant context
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId,
        clinicName: "Test Clinic",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true },
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create expired token
    const expiredTime = Date.now() - 1000; // 1 second ago
    const secret = "test-secret-key-for-booking-tokens";
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigData = encoder.encode(`${clinicId}:${phone}:${expiredTime}`);
    const sig = await crypto.subtle.sign("HMAC", key, sigData);
    const signature = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiredToken = `${clinicId}:${phone}:${expiredTime}:${signature}`;
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12",
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: phone,
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": expiredToken,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("expired or is invalid");
  });

  it("should reject token with mismatched phone number", async () => {
    const clinicId = "clinic-123";
    const tokenPhone = "+212612345678";
    const submittedPhone = "+212687654321"; // Different phone
    
    // Setup tenant context
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId,
        clinicName: "Test Clinic",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true },
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create token for one phone but submit booking with different phone
    const token = await createBookingToken(clinicId, tokenPhone);
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12",
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: submittedPhone, // Different from token phone
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": token,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("does not match the submitted patient phone number");
  });

  it("should handle phone number normalization correctly", async () => {
    const clinicId = "clinic-123";
    const tokenPhone = "+212612345678";
    const submittedPhone = "+212 61 23 45 678"; // Same phone with spaces
    
    // Setup tenant context
    const { requireTenantWithConfig } = vi.mocked(await import("@/lib/tenant"));
    requireTenantWithConfig.mockResolvedValue({
      tenant: {
        clinicId,
        clinicName: "Test Clinic",
      },
      config: {
        timezone: "Africa/Casablanca",
        workingHours: {
          1: { open: "09:00", close: "17:00", enabled: true },
        },
        booking: {
          slotDuration: 30,
          bufferTime: 0,
          maxPerSlot: 1,
          depositAmount: 0,
          depositPercentage: 0,
        },
      },
    });

    // Create token with one format, submit with normalized format
    const token = await createBookingToken(clinicId, tokenPhone);
    
    const { POST } = await import("@/app/api/booking/route");
    
    const request = createMockRequest({
      specialtyId: "specialty-1",
      doctorId: "doctor-1",
      serviceId: "service-1",
      date: "2026-05-12",
      time: "09:00",
      isFirstVisit: true,
      hasInsurance: false,
      patient: {
        name: "Ahmed Benali",
        phone: submittedPhone, // Same phone with different formatting
        email: "ahmed@example.com",
        reason: "Consultation",
      },
      slotDuration: 30,
      bufferTime: 0,
    }, {
      "x-booking-token": token,
    });

    const response = await POST(request);
    const data = await response.json();

    // Should succeed because phones are the same after normalization
    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.appointment.id).toBe("appointment-123");
  });
});