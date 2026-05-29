/**
 * Integration tests for the clinic-owner API routes and validation schemas.
 *
 * Tests:
 * - Zod validation schemas (clinic-owner.ts)
 * - Route handlers: expenses, expense-categories, campaigns,
 *   insurance-claims, patient-acquisition, revenue-per-doctor
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ────────────────────────────────────────────────────────

const mockSingle = vi.fn().mockResolvedValue({ data: { id: "row-1" }, error: null });
const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

const mockChainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  single: mockSingle,
  limit: mockLimit,
};

const mockSupabase = {
  from: vi.fn(() => mockChainable),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "admin@test.com" } },
      error: null,
    }),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createTenantClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/tenant", () => ({
  getTenant: vi.fn(() => ({
    clinicId: "11111111-1111-4111-b111-111111111111",
    clinicName: "Test Clinic",
    subdomain: "test",
    clinicType: "clinic",
    clinicTier: "professional",
  })),
  requireTenant: vi.fn(async () => ({
    clinicId: "11111111-1111-4111-b111-111111111111",
    clinicName: "Test Clinic",
    subdomain: "test",
    clinicType: "clinic",
    clinicTier: "professional",
  })),
}));

vi.mock("@/lib/tenant-context", () => ({
  setTenantContext: vi.fn(),
  logTenantContext: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/rate-limit", () => ({
  perUserLimiter: { check: vi.fn(async () => true) },
}));

vi.mock("@/lib/profile-header-hmac", () => ({
  verifyProfileHeader: vi.fn(() => ({
    id: "user-1",
    role: "clinic_admin",
    clinic_id: "11111111-1111-4111-b111-111111111111",
  })),
  PROFILE_HEADER_NAMES: {
    payload: "x-profile-payload",
    signature: "x-profile-signature",
  },
}));

// ── Validation schema tests ──────────────────────────────────────────

describe("Clinic Owner — Validation Schemas", () => {
  describe("expenseCategoryCreateSchema", () => {
    it("accepts valid expense category", async () => {
      const { expenseCategoryCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryCreateSchema.safeParse({
        name: "Loyer bureau",
        type: "rent",
      });
      expect(result.success).toBe(true);
    });

    it("accepts with optional description", async () => {
      const { expenseCategoryCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryCreateSchema.safeParse({
        name: "Fournitures",
        type: "supplies",
        description: "Fournitures de bureau et médicales",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", async () => {
      const { expenseCategoryCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryCreateSchema.safeParse({
        name: "",
        type: "rent",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid type", async () => {
      const { expenseCategoryCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryCreateSchema.safeParse({
        name: "Test",
        type: "invalid_type",
      });
      expect(result.success).toBe(false);
    });

    it("rejects description exceeding 500 chars", async () => {
      const { expenseCategoryCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryCreateSchema.safeParse({
        name: "Test",
        type: "rent",
        description: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("expenseCategoryUpdateSchema", () => {
    it("accepts valid update with only id", async () => {
      const { expenseCategoryUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        name: "New name",
      });
      expect(result.success).toBe(true);
    });

    it("accepts is_active toggle", async () => {
      const { expenseCategoryUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        is_active: false,
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-uuid id", async () => {
      const { expenseCategoryUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCategoryUpdateSchema.safeParse({
        id: "not-a-uuid",
        name: "Test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("expenseCreateSchema", () => {
    it("accepts valid expense", async () => {
      const { expenseCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCreateSchema.safeParse({
        description: "Achat de gants médicaux",
        amount: 50000,
        expense_date: "2026-05-15",
      });
      expect(result.success).toBe(true);
    });

    it("accepts full payload with all optional fields", async () => {
      const { expenseCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCreateSchema.safeParse({
        category_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        description: "Loyer mensuel",
        amount: 1500000,
        expense_date: "2026-05-01",
        is_recurring: true,
        recurring_interval: "monthly",
        notes: "Payé par virement",
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative amount", async () => {
      const { expenseCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCreateSchema.safeParse({
        description: "Test",
        amount: -100,
        expense_date: "2026-05-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid date format", async () => {
      const { expenseCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCreateSchema.safeParse({
        description: "Test",
        amount: 5000,
        expense_date: "15/05/2026",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid recurring_interval", async () => {
      const { expenseCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseCreateSchema.safeParse({
        description: "Test",
        amount: 5000,
        expense_date: "2026-05-01",
        recurring_interval: "weekly",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("expenseUpdateSchema", () => {
    it("accepts partial update", async () => {
      const { expenseUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        amount: 75000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts nullable fields", async () => {
      const { expenseUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        category_id: null,
        recurring_interval: null,
        notes: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing id", async () => {
      const { expenseUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = expenseUpdateSchema.safeParse({
        amount: 5000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("campaignCreateSchema", () => {
    it("accepts valid campaign", async () => {
      const { campaignCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignCreateSchema.safeParse({
        name: "Campagne Ramadan",
        channel: "whatsapp",
        budget: 500000,
        start_date: "2026-03-01",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all optional fields", async () => {
      const { campaignCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignCreateSchema.safeParse({
        name: "Google Ads Q2",
        channel: "google",
        budget: 1000000,
        spend: 200000,
        start_date: "2026-04-01",
        end_date: "2026-06-30",
        status: "active",
        notes: "Budget mensuel plafonné",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid channel", async () => {
      const { campaignCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignCreateSchema.safeParse({
        name: "Test",
        channel: "tiktok",
        budget: 100000,
        start_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative budget", async () => {
      const { campaignCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignCreateSchema.safeParse({
        name: "Test",
        channel: "facebook",
        budget: -5000,
        start_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid status", async () => {
      const { campaignCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignCreateSchema.safeParse({
        name: "Test",
        channel: "facebook",
        budget: 50000,
        start_date: "2026-01-01",
        status: "archived",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("campaignUpdateSchema", () => {
    it("accepts valid update", async () => {
      const { campaignUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        status: "paused",
        spend: 350000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts nullable end_date", async () => {
      const { campaignUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = campaignUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        end_date: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("patientAcquisitionCreateSchema", () => {
    it("accepts valid acquisition", async () => {
      const { patientAcquisitionCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = patientAcquisitionCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        channel: "referral",
      });
      expect(result.success).toBe(true);
    });

    it("accepts with campaign_id and notes", async () => {
      const { patientAcquisitionCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = patientAcquisitionCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        channel: "google",
        campaign_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        referral_source: "Dr. Amrani",
        notes: "Recommandé par un ami",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid channel", async () => {
      const { patientAcquisitionCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = patientAcquisitionCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        channel: "tiktok",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-uuid patient_id", async () => {
      const { patientAcquisitionCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = patientAcquisitionCreateSchema.safeParse({
        patient_id: "not-a-uuid",
        channel: "walk_in",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("insuranceClaimCreateSchema", () => {
    it("accepts valid claim", async () => {
      const { insuranceClaimCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        insurance_type: "CNSS",
        amount_claimed: 250000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts full payload", async () => {
      const { insuranceClaimCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        doctor_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        appointment_id: "cccccccc-cccc-4ccc-bccc-cccccccccccc",
        insurance_type: "AMO",
        policy_number: "AMO-12345",
        amount_claimed: 500000,
        diagnosis_code: "J06.9",
        treatment_description: "Consultation ORL + traitement",
        notes: "Dossier complet",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid insurance_type", async () => {
      const { insuranceClaimCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        insurance_type: "MutuelleX",
        amount_claimed: 100000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative amount_claimed", async () => {
      const { insuranceClaimCreateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimCreateSchema.safeParse({
        patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        insurance_type: "CNOPS",
        amount_claimed: -500,
      });
      expect(result.success).toBe(false);
    });

    it("accepts all Moroccan insurance types", async () => {
      const { insuranceClaimCreateSchema } = await import("@/lib/validations/clinic-owner");
      for (const insuranceType of ["CNSS", "CNOPS", "AMO", "RAMED", "private"]) {
        const result = insuranceClaimCreateSchema.safeParse({
          patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          insurance_type: insuranceType,
          amount_claimed: 100000,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("insuranceClaimUpdateSchema", () => {
    it("accepts status update", async () => {
      const { insuranceClaimUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        status: "approved",
        amount_approved: 200000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all valid statuses", async () => {
      const { insuranceClaimUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const statuses = [
        "draft",
        "submitted",
        "pending",
        "approved",
        "partially_approved",
        "rejected",
        "appealed",
      ];
      for (const status of statuses) {
        const result = insuranceClaimUpdateSchema.safeParse({
          id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid status", async () => {
      const { insuranceClaimUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        status: "closed",
      });
      expect(result.success).toBe(false);
    });

    it("accepts rejection with reason", async () => {
      const { insuranceClaimUpdateSchema } = await import("@/lib/validations/clinic-owner");
      const result = insuranceClaimUpdateSchema.safeParse({
        id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        status: "rejected",
        rejection_reason: "Documents incomplets",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("revenueQuerySchema", () => {
    it("accepts valid period", async () => {
      const { revenueQuerySchema } = await import("@/lib/validations/clinic-owner");
      for (const period of ["7d", "30d", "90d", "12m"]) {
        const result = revenueQuerySchema.safeParse({ period });
        expect(result.success).toBe(true);
      }
    });

    it("accepts empty object (period optional)", async () => {
      const { revenueQuerySchema } = await import("@/lib/validations/clinic-owner");
      const result = revenueQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects invalid period", async () => {
      const { revenueQuerySchema } = await import("@/lib/validations/clinic-owner");
      const result = revenueQuerySchema.safeParse({ period: "1y" });
      expect(result.success).toBe(false);
    });
  });
});

// ── Route handler tests ──────────────────────────────────────────────

describe("Clinic Owner — Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainable.select.mockReturnThis();
    mockChainable.eq.mockReturnThis();
    mockChainable.gte.mockReturnThis();
    mockChainable.lte.mockReturnThis();
    mockChainable.order.mockReturnThis();
    mockChainable.insert.mockReturnThis();
    mockChainable.update.mockReturnThis();
    mockChainable.delete.mockReturnThis();
    mockSupabase.from.mockReturnValue(mockChainable);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "admin@test.com" } },
      error: null,
    });
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    // Default: profile lookup returns clinic_admin
    mockSingle.mockResolvedValue({
      data: {
        id: "user-1",
        role: "clinic_admin",
        clinic_id: "11111111-1111-4111-b111-111111111111",
      },
      error: null,
    });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe("GET /api/clinic-owner/expenses", () => {
    it("returns expenses list", async () => {
      mockLimit.mockResolvedValueOnce({
        data: [{ id: "exp-1", description: "Loyer", amount: 1500000, expense_date: "2026-05-01" }],
        error: null,
      });

      const { GET } = await import("@/app/api/clinic-owner/expenses/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expenses", {
        method: "GET",
      });

      const response = await GET(req);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.expenses).toBeDefined();
    });

    it("filters by month when query param provided", async () => {
      mockLimit.mockResolvedValueOnce({ data: [], error: null });

      const { GET } = await import("@/app/api/clinic-owner/expenses/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expenses?month=2026-05", {
        method: "GET",
      });

      const response = await GET(req);
      expect(response.status).toBe(200);
      expect(mockChainable.gte).toHaveBeenCalled();
      expect(mockChainable.lte).toHaveBeenCalled();
    });
  });

  describe("POST /api/clinic-owner/expenses", () => {
    it("creates expense with valid data", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "exp-new", description: "Achat", amount: 50000 },
        error: null,
      });

      const { POST } = await import("@/app/api/clinic-owner/expenses/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "Achat de gants",
          amount: 50000,
          expense_date: "2026-05-15",
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.ok).toBe(true);
      expect(json.data.expense).toBeDefined();
    });

    it("rejects invalid expense data", async () => {
      const { POST } = await import("@/app/api/clinic-owner/expenses/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "",
          amount: -100,
          expense_date: "bad-date",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/clinic-owner/expense-categories", () => {
    it("returns categories list", async () => {
      mockChainable.order.mockResolvedValueOnce({
        data: [{ id: "cat-1", name: "Loyer", type: "rent" }],
        error: null,
      });

      const { GET } = await import("@/app/api/clinic-owner/expense-categories/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expense-categories", {
        method: "GET",
      });

      const response = await GET(req);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.categories).toBeDefined();
    });
  });

  describe("POST /api/clinic-owner/expense-categories", () => {
    it("creates category with valid data", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "cat-new", name: "Fournitures", type: "supplies" },
        error: null,
      });

      const { POST } = await import("@/app/api/clinic-owner/expense-categories/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/expense-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Fournitures",
          type: "supplies",
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.ok).toBe(true);
    });
  });

  describe("GET /api/clinic-owner/campaigns", () => {
    it("returns campaigns list", async () => {
      mockChainable.order.mockResolvedValueOnce({
        data: [{ id: "camp-1", name: "Ramadan", channel: "whatsapp" }],
        error: null,
      });

      const { GET } = await import("@/app/api/clinic-owner/campaigns/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/campaigns", {
        method: "GET",
      });

      const response = await GET(req);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.campaigns).toBeDefined();
    });
  });

  describe("POST /api/clinic-owner/campaigns", () => {
    it("creates campaign with valid data", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "camp-new", name: "Google Ads", channel: "google" },
        error: null,
      });

      const { POST } = await import("@/app/api/clinic-owner/campaigns/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Google Ads",
          channel: "google",
          budget: 500000,
          start_date: "2026-06-01",
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.ok).toBe(true);
    });

    it("rejects campaign with invalid channel", async () => {
      const { POST } = await import("@/app/api/clinic-owner/campaigns/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          channel: "invalid",
          budget: 100000,
          start_date: "2026-01-01",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/clinic-owner/insurance-claims", () => {
    it("returns claims with summary", async () => {
      mockLimit.mockResolvedValueOnce({
        data: [
          {
            id: "claim-1",
            status: "approved",
            insurance_type: "CNSS",
            amount_claimed: 250000,
            amount_approved: 200000,
          },
          {
            id: "claim-2",
            status: "pending",
            insurance_type: "AMO",
            amount_claimed: 100000,
            amount_approved: 0,
          },
        ],
        error: null,
      });

      const { GET } = await import("@/app/api/clinic-owner/insurance-claims/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/insurance-claims", {
        method: "GET",
      });

      const response = await GET(req);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.claims).toBeDefined();
      expect(json.data.summary).toBeDefined();
      expect(json.data.summary.total).toBe(2);
    });
  });

  describe("POST /api/clinic-owner/insurance-claims", () => {
    it("creates claim with valid data", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "claim-new", insurance_type: "CNSS", amount_claimed: 250000 },
        error: null,
      });

      const { POST } = await import("@/app/api/clinic-owner/insurance-claims/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/insurance-claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          insurance_type: "CNSS",
          amount_claimed: 250000,
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.ok).toBe(true);
    });
  });

  describe("GET /api/clinic-owner/revenue-per-doctor", () => {
    it("returns revenue metrics per doctor", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockSupabase.from as any).mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "doc-1", name: "Dr. Amrani" }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "appt-1",
                      doctor_id: "doc-1",
                      status: "completed",
                      slot_start: "2026-05-01T10:00:00Z",
                    },
                    {
                      id: "appt-2",
                      doctor_id: "doc-1",
                      status: "cancelled",
                      slot_start: "2026-05-02T10:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "pay-1",
                      amount: 50000,
                      status: "completed",
                      appointment_id: "appt-1",
                      created_at: "2026-05-01T10:30:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return mockChainable;
      });

      const { GET } = await import("@/app/api/clinic-owner/revenue-per-doctor/route");
      const req = new NextRequest(
        "http://localhost:3000/api/clinic-owner/revenue-per-doctor?period=30d",
        {
          method: "GET",
        },
      );

      const response = await GET(req);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.doctors).toBeDefined();
      expect(json.data.summary).toBeDefined();
    });
  });

  describe("POST /api/clinic-owner/patient-acquisition", () => {
    it("creates acquisition record", async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: "acq-1",
          channel: "referral",
          patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
        },
        error: null,
      });

      const { POST } = await import("@/app/api/clinic-owner/patient-acquisition/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/patient-acquisition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          channel: "referral",
          referral_source: "Dr. Bennis",
        }),
      });

      const response = await POST(req);
      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.ok).toBe(true);
    });

    it("rejects acquisition with invalid channel", async () => {
      const { POST } = await import("@/app/api/clinic-owner/patient-acquisition/route");
      const req = new NextRequest("http://localhost:3000/api/clinic-owner/patient-acquisition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          channel: "invalid_channel",
        }),
      });

      const response = await POST(req);
      expect(response.status).toBe(422);
    });
  });
});
