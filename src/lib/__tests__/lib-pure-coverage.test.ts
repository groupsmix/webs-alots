import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getInsuranceProvider } from "@/lib/env";
import { checkEligibility, submitClaim } from "@/lib/insurance/client";
import { logger } from "@/lib/logger";
import { executeReport, convertToCSV, type ReportDefinition } from "@/lib/reports/builder";
import {
  classifyIncidentSeverity,
  createIncident,
  getContainmentProcedures,
  getNotificationDeadlineHours,
  isNotifiable,
} from "@/lib/security/incident-response";
import { detectLanguage, LANGUAGE_LABELS } from "@/lib/support/language-detect";
import { createMockSupabaseClient } from "./test-utils";

vi.mock("@/lib/env", () => ({
  getInsuranceProvider: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "550e8400-e29b-41d4-a716-446655440000") });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── Insurance client ──────────────────────────────────────────────────

describe("insurance client", () => {
  it("checkEligibility returns sandbox result for valid policy", async () => {
    vi.mocked(getInsuranceProvider).mockReturnValue("sandbox");
    const result = await checkEligibility("123456", "AMO");
    expect(result.eligible).toBe(true);
    expect(result.coveragePercentage).toBe(70);
    expect(result.insuranceType).toBe("AMO");
  });

  it("checkEligibility returns ineligible for short policy", async () => {
    vi.mocked(getInsuranceProvider).mockReturnValue("sandbox");
    const result = await checkEligibility("123", "AMO");
    expect(result.eligible).toBe(false);
    expect(result.coPayPercentage).toBe(100);
  });

  it("checkEligibility throws for unsupported provider", async () => {
    vi.mocked(getInsuranceProvider).mockReturnValue("amo");
    await expect(checkEligibility("123456", "AMO")).rejects.toThrow(
      'Insurance provider "amo" integration not yet implemented',
    );
    expect(logger.warn).toHaveBeenCalled();
  });

  it("submitClaim returns sandbox claim", async () => {
    vi.mocked(getInsuranceProvider).mockReturnValue("sandbox");
    const result = await submitClaim({
      policyNumber: "123456",
      insuranceType: "CNOPS",
      amountCentimes: 1000,
      appointmentDate: "2026-07-11",
      doctorName: "Dr. Test",
      patientName: "Patient Test",
    });
    expect(result.success).toBe(true);
    expect(result.approvedAmountCentimes).toBe(800);
    expect(result.processingDays).toBe(14);
    expect(result.claimNumber).toContain("CNOPS-");
  });

  it("submitClaim throws for unsupported provider", async () => {
    vi.mocked(getInsuranceProvider).mockReturnValue("cnops");
    await expect(
      submitClaim({
        policyNumber: "123456",
        insuranceType: "CNOPS",
        amountCentimes: 1000,
        appointmentDate: "2026-07-11",
        doctorName: "Dr. Test",
        patientName: "Patient Test",
      }),
    ).rejects.toThrow('Insurance provider "cnops" integration not yet implemented');
  });
});

// ── Language detection ────────────────────────────────────────────────

describe("language detection", () => {
  it("detects Arabic text", () => {
    expect(detectLanguage("مرحبا بالعالم")).toBe("ar");
  });

  it("detects English text", () => {
    expect(detectLanguage("hello doctor appointment")).toBe("en");
  });

  it("defaults to French for ambiguous text", () => {
    expect(detectLanguage("bonjour clinique")).toBe("fr");
  });

  it("returns fr for empty strings", () => {
    expect(detectLanguage("")).toBe("fr");
  });

  it("exposes language labels", () => {
    expect(LANGUAGE_LABELS.fr).toBe("Français");
    expect(LANGUAGE_LABELS.ar).toBe("العربية");
    expect(LANGUAGE_LABELS.en).toBe("English");
  });
});

// ── Security incident response ────────────────────────────────────────

describe("security incident response", () => {
  it("creates an incident", () => {
    const incident = createIncident({
      clinicId: "clinic-1",
      category: "data_breach",
      severity: "critical",
      title: "Test incident",
      description: "Sensitive data exposed",
      reportedBy: "system",
      affectedSystems: ["db"],
      affectedPatientCount: 5,
    });
    expect(incident.category).toBe("data_breach");
    expect(incident.status).toBe("reported");
    expect(incident.affectedPatientCount).toBe(5);
    expect(incident.id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("classifies severity", () => {
    expect(
      classifyIncidentSeverity({
        dataBreached: true,
        patientsAffected: 101,
        systemsAffected: 1,
        serviceImpacted: false,
      }),
    ).toBe("critical");
    expect(
      classifyIncidentSeverity({
        dataBreached: true,
        patientsAffected: 1,
        systemsAffected: 1,
        serviceImpacted: false,
      }),
    ).toBe("high");
    expect(
      classifyIncidentSeverity({
        dataBreached: false,
        patientsAffected: 0,
        systemsAffected: 3,
        serviceImpacted: true,
      }),
    ).toBe("high");
    expect(
      classifyIncidentSeverity({
        dataBreached: false,
        patientsAffected: 0,
        systemsAffected: 2,
        serviceImpacted: false,
      }),
    ).toBe("medium");
    expect(
      classifyIncidentSeverity({
        dataBreached: false,
        patientsAffected: 0,
        systemsAffected: 0,
        serviceImpacted: false,
      }),
    ).toBe("low");
  });

  it("returns containment procedures by category", () => {
    expect(getContainmentProcedures("data_breach")).toContain(
      "Notify DPO within 1 hour (Moroccan Law 09-08)",
    );
    expect(getContainmentProcedures("phishing")).toContain("Block sender domain/address");
    expect(getContainmentProcedures("unknown" as never)).toContain("Document the incident details");
  });

  it("determines if incident is notifiable", () => {
    const breach = createIncident({
      clinicId: "clinic-1",
      category: "data_breach",
      severity: "high",
      title: "B",
      description: "B",
      reportedBy: "system",
      affectedSystems: ["db"],
      affectedPatientCount: 1,
    });
    expect(isNotifiable(breach)).toBe(true);
    const critical = createIncident({
      clinicId: "clinic-1",
      category: "service_disruption",
      severity: "critical",
      title: "C",
      description: "C",
      reportedBy: "system",
      affectedSystems: ["api"],
      affectedPatientCount: 0,
    });
    expect(isNotifiable(critical)).toBe(true);
    const low = createIncident({
      clinicId: "clinic-1",
      category: "policy_violation",
      severity: "low",
      title: "L",
      description: "L",
      reportedBy: "system",
      affectedSystems: ["email"],
      affectedPatientCount: 0,
    });
    expect(isNotifiable(low)).toBe(false);
  });

  it("returns notification deadline hours", () => {
    const breach = createIncident({
      clinicId: "clinic-1",
      category: "data_breach",
      severity: "high",
      title: "B",
      description: "B",
      reportedBy: "system",
      affectedSystems: ["db"],
      affectedPatientCount: 1,
    });
    expect(getNotificationDeadlineHours(breach)).toBe(72);
    const critical = createIncident({
      clinicId: "clinic-1",
      category: "service_disruption",
      severity: "critical",
      title: "C",
      description: "C",
      reportedBy: "system",
      affectedSystems: ["api"],
      affectedPatientCount: 0,
    });
    expect(getNotificationDeadlineHours(critical)).toBe(24);
    const low = createIncident({
      clinicId: "clinic-1",
      category: "policy_violation",
      severity: "low",
      title: "L",
      description: "L",
      reportedBy: "system",
      affectedSystems: ["email"],
      affectedPatientCount: 0,
    });
    expect(getNotificationDeadlineHours(low)).toBe(168);
  });
});

// ── Report builder ────────────────────────────────────────────────────

describe("report builder", () => {
  const rows = {
    appointments: [
      {
        id: "a1",
        patient_id: "p1",
        doctor_id: "d1",
        status: "confirmed",
        slot_start: "2026-07-11T10:00:00Z",
        slot_end: "2026-07-11T10:30:00Z",
        appointment_type: "consultation",
        created_at: "2026-07-11T09:00:00Z",
        clinic_id: "clinic-1",
      },
      {
        id: "a2",
        patient_id: "p2",
        doctor_id: "d1",
        status: "cancelled",
        slot_start: "2026-07-11T11:00:00Z",
        slot_end: "2026-07-11T11:30:00Z",
        appointment_type: "followup",
        created_at: "2026-07-11T09:00:00Z",
        clinic_id: "clinic-1",
      },
      {
        id: "a3",
        patient_id: "p3",
        doctor_id: "d2",
        status: "confirmed",
        slot_start: "2026-07-12T10:00:00Z",
        slot_end: "2026-07-12T10:30:00Z",
        appointment_type: "consultation",
        created_at: "2026-07-12T09:00:00Z",
        clinic_id: "clinic-1",
      },
    ],
  };

  function makeDefinition(overrides?: Partial<ReportDefinition>): ReportDefinition {
    return {
      clinicId: "clinic-1",
      dataSource: "appointments",
      fields: ["id", "status", "appointment_type"],
      filters: [],
      orderBy: { field: "created_at", direction: "desc" },
      exportFormat: "json",
      ...overrides,
    };
  }

  it("executeReport returns filtered rows and count", async () => {
    const supabase = createMockSupabaseClient(rows);
    const result = await executeReport(supabase as never, makeDefinition());
    expect(result.columns).toEqual(["id", "status", "appointment_type"]);
    expect(result.rows).toHaveLength(3);
    expect(result.totalRows).toBe(3);
    expect(result.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("executeReport applies filters", async () => {
    const supabase = createMockSupabaseClient(rows);
    const result = await executeReport(
      supabase as never,
      makeDefinition({
        filters: [
          { field: "status", operator: "eq", value: "confirmed" },
          { field: "doctor_id", operator: "neq", value: "d2" },
        ],
      }),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("a1");
  });

  it("executeReport skips disallowed fields and filters", async () => {
    const supabase = createMockSupabaseClient(rows);
    const result = await executeReport(
      supabase as never,
      makeDefinition({
        fields: ["id", "malicious_column"],
        filters: [{ field: "malicious_column", operator: "eq", value: "x" }],
      }),
    );
    expect(result.columns).toEqual(["id"]);
    expect(result.rows).toHaveLength(3);
  });

  it("executeReport rejects invalid data source", async () => {
    const supabase = createMockSupabaseClient(rows);
    await expect(
      executeReport(supabase as never, makeDefinition({ dataSource: "invalid" as never })),
    ).rejects.toThrow("Invalid data source: invalid");
  });

  it("executeReport rejects empty field list", async () => {
    const supabase = createMockSupabaseClient(rows);
    await expect(executeReport(supabase as never, makeDefinition({ fields: [] }))).rejects.toThrow(
      "No valid fields selected",
    );
  });

  it("convertToCSV formats rows and escapes values", () => {
    const result = {
      columns: ["id", "name"],
      rows: [
        { id: "a1", name: "Alice" },
        { id: "a2", name: 'Bob, "the builder"' },
      ],
      totalRows: 2,
      generatedAt: "2026-07-11",
    };
    const csv = convertToCSV(result);
    expect(csv).toContain("id,name");
    expect(csv).toContain("a1,Alice");
    expect(csv).toContain('a2,"Bob, ""the builder"""');
  });

  it("convertToCSV handles empty rows", () => {
    const result = {
      columns: ["id"],
      rows: [],
      totalRows: 0,
      generatedAt: "2026-07-11",
    };
    expect(convertToCSV(result)).toBe("id\n");
  });
});
