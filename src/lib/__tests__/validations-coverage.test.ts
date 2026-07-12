import { describe, expect, it } from "vitest";
// Import from the barrel where the schema is re-exported, and directly when it
// is intentionally not in the barrel.
import {
  aiTeamAlertReadSchema,
  aiTeamChatSchema,
  aiTeamGenerateSchema,
  aiTeamTaskUpdateSchema,
  oneClickCheckinSchema,
  phoneHandlerLookupSchema,
  attestationCreateSchema,
  attestationSignSchema,
  familyLinkCreateSchema,
  doctorDelayUpdateSchema,
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
  inventoryTransactionSchema,
  invoiceCreateSchema,
  invoiceUpdateSchema,
  paymentPlanCreateSchema,
  installmentUpdateSchema,
  reminderSendSchema,
  revenueInsightsQuerySchema,
  timelineQuerySchema,
  TIMELINE_EVENT_TYPES,
  passwordPolicySchema,
  evaluatePasswordStrength,
  clinicProvisionSchema,
  churnPredictionQuerySchema,
  revenueForecastQuerySchema,
} from "@/lib/validations";
import { aiTeamTaskCreateSchema, aiTeamTaskTransitionSchema } from "@/lib/validations/ai-team";
import {
  attestationListSchema,
  familyLinkDeleteSchema,
  familyMembersListSchema,
  inventoryAlertsSchema,
  waitTimeEstimateSchema,
} from "@/lib/validations/batch4c";
import { financialSummaryQuerySchema } from "@/lib/validations/billing";
import {
  noShowAnalyticsQuerySchema,
  noShowMarkSchema,
  smartScheduleConfirmSchema,
  smartScheduleSchema,
  waitlistAddSchema,
  waitlistNotifySchema,
  waitlistPromoteSchema,
} from "@/lib/validations/receptionist-ai";
import {
  clinicAnalyticsQuerySchema,
  clinicHealthMutationSchema,
  clinicHealthQuerySchema,
  clinicNarrativeRequestSchema,
} from "@/lib/validations/super-admin";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";

// ── AI Team ───────────────────────────────────────────────────────────

describe("ai-team schemas", () => {
  const baseChat = {
    agentType: "support" as const,
    message: "Hello",
    conversationHistory: [{ role: "user" as const, content: "Hi" }],
  };

  it("validates aiTeamChatSchema", () => {
    const result = aiTeamChatSchema.safeParse(baseChat);
    expect(result.success).toBe(true);
  });

  it("rejects unknown agentType in aiTeamChatSchema", () => {
    const result = aiTeamChatSchema.safeParse({ ...baseChat, agentType: "unknown" });
    expect(result.success).toBe(false);
  });

  it("validates aiTeamTaskUpdateSchema", () => {
    const result = aiTeamTaskUpdateSchema.safeParse({
      taskId: validUUID,
      status: "completed" as const,
    });
    expect(result.success).toBe(true);
  });

  it("validates aiTeamAlertReadSchema", () => {
    const result = aiTeamAlertReadSchema.safeParse({ alertId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates aiTeamGenerateSchema", () => {
    const result = aiTeamGenerateSchema.safeParse({ agentType: "marketing" as const });
    expect(result.success).toBe(true);
  });

  it("validates aiTeamTaskCreateSchema", () => {
    const result = aiTeamTaskCreateSchema.safeParse({
      title: "Write release notes",
      agentType: "marketing" as const,
    });
    expect(result.success).toBe(true);
  });

  it("validates aiTeamTaskTransitionSchema", () => {
    const result = aiTeamTaskTransitionSchema.safeParse({
      taskId: validUUID,
      fromStatus: "backlog" as const,
      toStatus: "in_progress" as const,
    });
    expect(result.success).toBe(true);
  });
});

// ── Batch 4C ──────────────────────────────────────────────────────────

describe("batch4c schemas", () => {
  it("validates oneClickCheckinSchema", () => {
    const result = oneClickCheckinSchema.safeParse({
      patientId: validUUID,
      doctorId: validUUID,
      appointmentId: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it("validates phoneHandlerLookupSchema", () => {
    const result = phoneHandlerLookupSchema.safeParse({ phone: "+212612345678" });
    expect(result.success).toBe(true);
  });

  it("validates attestationCreateSchema", () => {
    const result = attestationCreateSchema.safeParse({
      patientId: validUUID,
      doctorId: validUUID,
      type: "sick_leave" as const,
      title: "Arrêt de travail",
    });
    expect(result.success).toBe(true);
  });

  it("validates attestationListSchema", () => {
    const result = attestationListSchema.safeParse({ patientId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates attestationSignSchema", () => {
    const result = attestationSignSchema.safeParse({ attestationId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates familyLinkCreateSchema", () => {
    const result = familyLinkCreateSchema.safeParse({
      primaryPatientId: validUUID,
      linkedPatientId: validUUID,
      relationship: "spouse" as const,
    });
    expect(result.success).toBe(true);
  });

  it("validates familyLinkDeleteSchema", () => {
    const result = familyLinkDeleteSchema.safeParse({ linkId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates familyMembersListSchema", () => {
    const result = familyMembersListSchema.safeParse({ patientId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates waitTimeEstimateSchema", () => {
    const result = waitTimeEstimateSchema.safeParse({ doctorId: validUUID });
    expect(result.success).toBe(true);
  });

  it("validates doctorDelayUpdateSchema", () => {
    const result = doctorDelayUpdateSchema.safeParse({
      doctorId: validUUID,
      delayMinutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it("validates inventoryItemCreateSchema", () => {
    const result = inventoryItemCreateSchema.safeParse({
      name: "Gants",
      category: "consumable" as const,
      currentStock: 100,
    });
    expect(result.success).toBe(true);
  });

  it("validates inventoryItemUpdateSchema", () => {
    const result = inventoryItemUpdateSchema.safeParse({ itemId: validUUID, name: "Gants XL" });
    expect(result.success).toBe(true);
  });

  it("validates inventoryTransactionSchema", () => {
    const result = inventoryTransactionSchema.safeParse({
      itemId: validUUID,
      type: "usage" as const,
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("validates inventoryAlertsSchema", () => {
    const result = inventoryAlertsSchema.safeParse({
      category: "medication" as const,
      alertType: "low_stock" as const,
    });
    expect(result.success).toBe(true);
  });
});

// ── Billing ───────────────────────────────────────────────────────────

describe("billing schemas", () => {
  it("validates invoiceCreateSchema", () => {
    const result = invoiceCreateSchema.safeParse({
      patient_id: validUUID,
      payment_method: "cash" as const,
      line_items: [
        {
          description: "Consultation",
          quantity: 1,
          unit_price_centimes: 20000,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invoiceCreateSchema without line items", () => {
    const result = invoiceCreateSchema.safeParse({ patient_id: validUUID });
    expect(result.success).toBe(false);
  });

  it("validates invoiceUpdateSchema", () => {
    const result = invoiceUpdateSchema.safeParse({ status: "paid" as const });
    expect(result.success).toBe(true);
  });

  it("validates paymentPlanCreateSchema", () => {
    const result = paymentPlanCreateSchema.safeParse({
      invoice_id: validUUID,
      num_installments: 3,
      start_date: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("validates installmentUpdateSchema", () => {
    const result = installmentUpdateSchema.safeParse({ status: "paid" as const });
    expect(result.success).toBe(true);
  });

  it("validates reminderSendSchema", () => {
    const result = reminderSendSchema.safeParse({
      invoice_id: validUUID,
      reminder_type: "overdue_7d" as const,
    });
    expect(result.success).toBe(true);
  });

  it("validates revenueInsightsQuerySchema", () => {
    const result = revenueInsightsQuerySchema.safeParse({ question: "Quel est le revenu ?" });
    expect(result.success).toBe(true);
  });

  it("validates financialSummaryQuerySchema", () => {
    const result = financialSummaryQuerySchema.safeParse({
      period: "month" as const,
      start_date: "2026-07-01",
      end_date: "2026-07-31",
    });
    expect(result.success).toBe(true);
  });
});

// ── Patient Timeline ──────────────────────────────────────────────────

describe("patient-timeline schema", () => {
  it("validates timelineQuerySchema", () => {
    const result = timelineQuerySchema.safeParse({
      patientId: validUUID,
      eventType: "prescription" as const,
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects invalid eventType", () => {
    const result = timelineQuerySchema.safeParse({
      patientId: validUUID,
      eventType: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("exposes TIMELINE_EVENT_TYPES", () => {
    expect(TIMELINE_EVENT_TYPES).toContain("visit");
    expect(TIMELINE_EVENT_TYPES).toContain("prescription");
  });
});

// ── Receptionist AI ───────────────────────────────────────────────────

describe("receptionist-ai schemas", () => {
  it("validates smartScheduleSchema", () => {
    const result = smartScheduleSchema.safeParse({
      doctorId: validUUID,
      serviceId: validUUID,
      patientId: validUUID,
      preferredDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("validates smartScheduleConfirmSchema", () => {
    const result = smartScheduleConfirmSchema.safeParse({
      doctorId: validUUID,
      serviceId: validUUID,
      patientId: validUUID,
      patientName: "Ahmed",
      date: "2026-08-01",
      time: "10:00",
      slotDuration: 30,
      bufferTime: 5,
    });
    expect(result.success).toBe(true);
  });

  it("validates waitlistAddSchema", () => {
    const result = waitlistAddSchema.safeParse({
      patientId: validUUID,
      patientName: "Ahmed",
      doctorId: validUUID,
      preferredDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });

  it("validates waitlistNotifySchema", () => {
    const result = waitlistNotifySchema.safeParse({
      entryId: "entry-1",
      availableDate: "2026-08-01",
      availableTime: "10:00",
    });
    expect(result.success).toBe(true);
  });

  it("validates waitlistPromoteSchema", () => {
    const result = waitlistPromoteSchema.safeParse({
      entryId: "entry-1",
      date: "2026-08-01",
      time: "10:00",
      slotDuration: 30,
      bufferTime: 5,
    });
    expect(result.success).toBe(true);
  });

  it("validates noShowMarkSchema", () => {
    const result = noShowMarkSchema.safeParse({
      appointmentId: "appt-1",
      reason: "Patient absent",
    });
    expect(result.success).toBe(true);
  });

  it("validates noShowAnalyticsQuerySchema", () => {
    const result = noShowAnalyticsQuerySchema.safeParse({
      doctorId: validUUID,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      view: "doctor-stats" as const,
    });
    expect(result.success).toBe(true);
  });
});

// ── Password Policy ───────────────────────────────────────────────────

describe("password-policy", () => {
  it("accepts strong passwords", () => {
    expect(passwordPolicySchema.safeParse("StrongP@ss1").success).toBe(true);
  });

  it("rejects weak passwords", () => {
    expect(passwordPolicySchema.safeParse("weak").success).toBe(false);
  });

  it("evaluates password strength", () => {
    const result = evaluatePasswordStrength("StrongP@ss1");
    expect(result.score).toBe(5);
    expect(result.label).toBe("strong");
  });

  it("returns weak for short passwords", () => {
    const result = evaluatePasswordStrength("abc");
    expect(result.label).toBe("weak");
  });
});

// ── Super Admin ───────────────────────────────────────────────────────

describe("super-admin schemas", () => {
  it("validates clinicProvisionSchema", () => {
    const result = clinicProvisionSchema.safeParse({
      clinic_name: "Clinique Test",
      clinic_type: "doctor" as const,
      tier: "pro" as const,
      subdomain: "clinique-test",
      owner_name: "Dr. Test",
      owner_email: "test@clinique.ma",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid subdomain in clinicProvisionSchema", () => {
    const result = clinicProvisionSchema.safeParse({
      clinic_name: "Clinique Test",
      clinic_type: "doctor" as const,
      tier: "pro" as const,
      subdomain: "_invalid",
      owner_name: "Dr. Test",
      owner_email: "test@clinique.ma",
    });
    expect(result.success).toBe(false);
  });

  it("validates churnPredictionQuerySchema", () => {
    const result = churnPredictionQuerySchema.safeParse({
      risk_level: "high" as const,
      sort_by: "score" as const,
      sort_order: "desc" as const,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("validates revenueForecastQuerySchema", () => {
    const result = revenueForecastQuerySchema.safeParse({ months_ahead: 6 });
    expect(result.success).toBe(true);
  });

  it("validates clinicHealthQuerySchema", () => {
    const result = clinicHealthQuerySchema.safeParse({
      clinic_id: validUUID,
      include_alerts: "false",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.include_alerts).toBe(false);
    }
  });

  it("validates clinicHealthMutationSchema", () => {
    const result = clinicHealthMutationSchema.safeParse({
      clinic_id: validUUID,
      create_alerts: "yes",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.create_alerts).toBe(true);
    }
  });

  it("validates clinicNarrativeRequestSchema", () => {
    const result = clinicNarrativeRequestSchema.safeParse({
      clinic_id: validUUID,
      refresh: "1",
    });
    expect(result.success).toBe(true);
  });

  it("validates clinicAnalyticsQuerySchema", () => {
    const result = clinicAnalyticsQuerySchema.safeParse({
      question: "Revenu ce mois ?",
      clinic_id: validUUID,
    });
    expect(result.success).toBe(true);
  });
});
