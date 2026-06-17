import { describe, expect, it } from "vitest";
import { admissionCreateSchema, dischargeSchema, transferSchema } from "@/lib/validations/adt";
import {
  insuranceClaimCreateSchema,
  insuranceClaimUpdateSchema,
  insuranceClaimQuerySchema,
} from "@/lib/validations/insurance-claims";
import {
  staffInviteSchema,
  staffInviteAcceptSchema,
  staffInviteRevokeSchema,
  staffInviteQuerySchema,
} from "@/lib/validations/staff-invitations";

// ── ADT Validations ───────────────────────────────────────────────────

describe("admissionCreateSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid admission with required fields", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: validUUID,
      bed_id: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: validUUID,
      bed_id: validUUID,
      department_id: validUUID,
      admitting_doctor_id: validUUID,
      diagnosis: "Fracture du bras",
      notes: "Patient stable",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing patient_id", () => {
    const result = admissionCreateSchema.safeParse({ bed_id: validUUID });
    expect(result.success).toBe(false);
  });

  it("rejects missing bed_id", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for patient_id", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: "not-a-uuid",
      bed_id: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects diagnosis exceeding 2000 chars", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: validUUID,
      bed_id: validUUID,
      diagnosis: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes exceeding 5000 chars", () => {
    const result = admissionCreateSchema.safeParse({
      patient_id: validUUID,
      bed_id: validUUID,
      notes: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});

describe("dischargeSchema", () => {
  it("accepts empty object", () => {
    const result = dischargeSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts optional notes", () => {
    const result = dischargeSchema.safeParse({ notes: "Sortie normale" });
    expect(result.success).toBe(true);
  });

  it("rejects notes exceeding 5000 chars", () => {
    const result = dischargeSchema.safeParse({ notes: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe("transferSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts empty object", () => {
    const result = transferSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts department_id and bed_id", () => {
    const result = transferSchema.safeParse({
      department_id: validUUID,
      bed_id: validUUID,
      notes: "Transfert vers cardiologie",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for department_id", () => {
    const result = transferSchema.safeParse({
      department_id: "bad",
    });
    expect(result.success).toBe(false);
  });
});
// ── Staff Invitation Validations ──────────────────────────────────────

describe("staffInviteSchema", () => {
  it("accepts valid invitation", () => {
    const result = staffInviteSchema.safeParse({
      email: "doctor@clinique.ma",
      role: "doctor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid roles", () => {
    for (const role of ["clinic_admin", "receptionist", "doctor"]) {
      const result = staffInviteSchema.safeParse({
        email: "staff@clinique.ma",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid email", () => {
    const result = staffInviteSchema.safeParse({
      email: "not-an-email",
      role: "doctor",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = staffInviteSchema.safeParse({
      email: "staff@clinique.ma",
      role: "super_admin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = staffInviteSchema.safeParse({ role: "doctor" });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = staffInviteSchema.safeParse({
      email: "staff@clinique.ma",
    });
    expect(result.success).toBe(false);
  });
});

describe("staffInviteAcceptSchema", () => {
  it("accepts valid accept payload", () => {
    const result = staffInviteAcceptSchema.safeParse({
      token: "abc123-token",
      full_name: "Dr. Ahmed",
      password: "SecurePass123!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = staffInviteAcceptSchema.safeParse({
      token: "abc123",
      full_name: "Dr. Ahmed",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = staffInviteAcceptSchema.safeParse({
      full_name: "Dr. Ahmed",
      password: "SecurePass123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("staffInviteRevokeSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid revoke payload", () => {
    const result = staffInviteRevokeSchema.safeParse({
      invitation_id: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = staffInviteRevokeSchema.safeParse({
      invitation_id: "not-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("staffInviteQuerySchema", () => {
  it("accepts empty query", () => {
    const result = staffInviteQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts status filter", () => {
    const result = staffInviteQuerySchema.safeParse({ status: "pending" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = staffInviteQuerySchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });
});

// ── Insurance Claims Validations ──────────────────────────────────────

describe("insuranceClaimCreateSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid claim with required fields", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "CNSS",
      amount_claimed: 150000,
      line_items: [
        {
          description: "Consultation générale",
          unit_price_centimes: 150000,
          quantity: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all insurance types", () => {
    for (const insurance_type of ["CNSS", "CNOPS", "AMO", "RAMED"]) {
      const result = insuranceClaimCreateSchema.safeParse({
        patient_id: validUUID,
        insurance_type,
        amount_claimed: 100000,
        line_items: [{ description: "Acte", unit_price_centimes: 100000, quantity: 1 }],
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional notes and line_items", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "CNOPS",
      amount_claimed: 200000,
      notes: "Réclamation urgente",
      line_items: [{ description: "Chirurgie", unit_price_centimes: 200000, quantity: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid insurance_type", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "INVALID",
      amount_claimed: 100000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing patient_id", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      insurance_type: "CNSS",
      amount_claimed: 100000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount_claimed", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "CNSS",
      amount_claimed: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects line_items with missing description", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "AMO",
      amount_claimed: 50000,
      line_items: [{ unit_price_centimes: 50000, quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects line_items with zero quantity", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "AMO",
      amount_claimed: 50000,
      line_items: [{ description: "Acte", unit_price_centimes: 50000, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts without line_items (optional)", () => {
    const result = insuranceClaimCreateSchema.safeParse({
      patient_id: validUUID,
      insurance_type: "CNSS",
      amount_claimed: 50000,
    });
    expect(result.success).toBe(true);
  });
});

describe("insuranceClaimUpdateSchema", () => {
  it("accepts status update", () => {
    const result = insuranceClaimUpdateSchema.safeParse({
      status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses", () => {
    for (const status of [
      "draft",
      "submitted",
      "under_review",
      "approved",
      "partially_approved",
      "rejected",
      "appealed",
    ]) {
      expect(insuranceClaimUpdateSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = insuranceClaimUpdateSchema.safeParse({
      status: "cancelled",
    });
    expect(result.success).toBe(false);
  });

  it("accepts amount_approved", () => {
    const result = insuranceClaimUpdateSchema.safeParse({
      amount_approved: 80000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts rejection_reason", () => {
    const result = insuranceClaimUpdateSchema.safeParse({
      status: "rejected",
      rejection_reason: "Documents incomplets",
    });
    expect(result.success).toBe(true);
  });

  it("accepts reviewer_notes", () => {
    const result = insuranceClaimUpdateSchema.safeParse({
      reviewer_notes: "Vérifié par Dr. Amina",
    });
    expect(result.success).toBe(true);
  });
});

describe("insuranceClaimQuerySchema", () => {
  it("accepts empty query", () => {
    const result = insuranceClaimQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts status and insurance_type filters", () => {
    const result = insuranceClaimQuerySchema.safeParse({
      status: "submitted",
      insurance_type: "CNSS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts pagination", () => {
    const result = insuranceClaimQuerySchema.safeParse({
      page: "1",
      limit: "25",
    });
    expect(result.success).toBe(true);
  });

  it("coerces page string to number", () => {
    const result = insuranceClaimQuerySchema.safeParse({ page: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
    }
  });

  it("accepts patient_id filter", () => {
    const result = insuranceClaimQuerySchema.safeParse({
      patient_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});
