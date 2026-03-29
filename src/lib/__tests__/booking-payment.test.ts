import { describe, it, expect } from "vitest";
import {
  paymentInitiateSchema,
  paymentConfirmSchema,
  paymentRefundSchema,
  bookingCancelSchema,
  safeParse,
} from "@/lib/validations";

/**
 * Tests for booking and payment validation schemas.
 *
 * These test the Zod schemas that guard the critical money and appointment
 * handling paths. Route-level integration tests are impractical without
 * a full Supabase setup, so we focus on schema validation which is the
 * first line of defence against malformed input.
 */

describe("paymentInitiateSchema", () => {
  const validPayload = {
    appointmentId: "apt-001",
    patientId: "pat-001",
    patientName: "Ahmed Benali",
    amount: 350,
    paymentType: "deposit" as const,
  };

  it("accepts a valid payment initiation payload", () => {
    const result = safeParse(paymentInitiateSchema, validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointmentId).toBe("apt-001");
      expect(result.data.amount).toBe(350);
      expect(result.data.paymentType).toBe("deposit");
    }
  });

  it("accepts optional method field", () => {
    const result = safeParse(paymentInitiateSchema, {
      ...validPayload,
      method: "cash",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe("cash");
    }
  });

  it("accepts all valid payment methods", () => {
    for (const method of ["cash", "card", "online", "insurance"]) {
      const result = safeParse(paymentInitiateSchema, {
        ...validPayload,
        method,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts both deposit and full payment types", () => {
    const deposit = safeParse(paymentInitiateSchema, { ...validPayload, paymentType: "deposit" });
    const full = safeParse(paymentInitiateSchema, { ...validPayload, paymentType: "full" });
    expect(deposit.success).toBe(true);
    expect(full.success).toBe(true);
  });

  it("rejects missing appointmentId", () => {
    const { appointmentId: _, ...without } = validPayload;
    const result = safeParse(paymentInitiateSchema, without);
    expect(result.success).toBe(false);
  });

  it("rejects missing amount", () => {
    const { amount: _, ...without } = validPayload;
    const result = safeParse(paymentInitiateSchema, without);
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects Infinity amount", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, amount: Infinity });
    expect(result.success).toBe(false);
  });

  it("rejects invalid payment type", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, paymentType: "partial" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid payment method", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, method: "bitcoin" });
    expect(result.success).toBe(false);
  });

  it("rejects empty patientName", () => {
    const result = safeParse(paymentInitiateSchema, { ...validPayload, patientName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects overly long patientName", () => {
    const result = safeParse(paymentInitiateSchema, {
      ...validPayload,
      patientName: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentConfirmSchema", () => {
  it("accepts a valid paymentId", () => {
    const result = safeParse(paymentConfirmSchema, { paymentId: "pay-001" });
    expect(result.success).toBe(true);
  });

  it("rejects empty paymentId", () => {
    const result = safeParse(paymentConfirmSchema, { paymentId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing paymentId", () => {
    const result = safeParse(paymentConfirmSchema, {});
    expect(result.success).toBe(false);
  });
});

describe("paymentRefundSchema", () => {
  it("accepts paymentId with optional amount", () => {
    const result = safeParse(paymentRefundSchema, { paymentId: "pay-001", amount: 100 });
    expect(result.success).toBe(true);
  });

  it("accepts paymentId without amount (full refund)", () => {
    const result = safeParse(paymentRefundSchema, { paymentId: "pay-001" });
    expect(result.success).toBe(true);
  });

  it("rejects negative refund amount", () => {
    const result = safeParse(paymentRefundSchema, { paymentId: "pay-001", amount: -50 });
    expect(result.success).toBe(false);
  });

  it("rejects zero refund amount", () => {
    const result = safeParse(paymentRefundSchema, { paymentId: "pay-001", amount: 0 });
    expect(result.success).toBe(false);
  });
});

describe("bookingCancelSchema", () => {
  it("accepts valid cancellation with reason", () => {
    const result = safeParse(bookingCancelSchema, {
      appointmentId: "apt-001",
      reason: "Patient requested cancellation",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointmentId).toBe("apt-001");
      expect(result.data.reason).toBe("Patient requested cancellation");
    }
  });

  it("accepts cancellation without reason (optional)", () => {
    const result = safeParse(bookingCancelSchema, {
      appointmentId: "apt-001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty appointmentId", () => {
    const result = safeParse(bookingCancelSchema, { appointmentId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing appointmentId", () => {
    const result = safeParse(bookingCancelSchema, {});
    expect(result.success).toBe(false);
  });

  it("rejects overly long reason", () => {
    const result = safeParse(bookingCancelSchema, {
      appointmentId: "apt-001",
      reason: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("allows reason up to 1000 characters", () => {
    const result = safeParse(bookingCancelSchema, {
      appointmentId: "apt-001",
      reason: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

describe("safeParse error formatting", () => {
  it("produces human-readable error messages for multiple issues", () => {
    const result = safeParse(paymentInitiateSchema, {
      // Missing appointmentId, patientId, patientName, amount, paymentType
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Validation error:");
      // Should mention at least one missing field
      expect(result.error).toMatch(/appointmentId|patientId|amount|paymentType/);
    }
  });
});
