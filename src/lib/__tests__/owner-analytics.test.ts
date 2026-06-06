import { describe, expect, it } from "vitest";
import {
  buildApprovedAdminSql,
  buildPlatformAlerts,
  clampAdminQueryLimit,
  computeHealthScoreRecords,
  selectApprovedAdminQuery,
} from "@/lib/ai/owner-analytics";

describe("owner analytics helpers", () => {
  it("computes health score records and applies declining trend from previous score", () => {
    const records = computeHealthScoreRecords(
      [
        {
          clinicId: "clinic-1",
          clinicName: "Clinique Atlas",
          loginFrequency: 0.2,
          appointmentBookingRate: 0.3,
          noShowRate: 0.5,
          featureAdoption: 0.2,
          paymentHealthy: false,
          negativeSupportRate: 0.7,
          lastLoginDaysAgo: 20,
          totalAppointments7d: 8,
          planTier: "starter",
        },
      ],
      new Map([["clinic-1", 82]]),
    );

    expect(records).toHaveLength(1);
    expect(records[0]?.clinicName).toBe("Clinique Atlas");
    expect(records[0]?.trend).toBe("declining");
    expect(records[0]?.score).toBeLessThan(82);
  });

  it("builds critical and declining platform alerts", () => {
    const alerts = buildPlatformAlerts([
      {
        clinicId: "clinic-1",
        clinicName: "Clinique Atlas",
        score: 28,
        grade: "F",
        topRiskSignal: "loginFrequency",
        topStrengthSignal: "paymentHealthy",
        trend: "declining",
        churnRisk: "critical",
        computedAt: new Date().toISOString(),
        previousScore: 44,
        signalsSnapshot: {},
      },
    ]);

    expect(alerts).toHaveLength(2);
    expect(alerts.map((alert) => alert.alert_type)).toContain("clinic_health_critical");
    expect(alerts.map((alert) => alert.alert_type)).toContain("clinic_health_declining");
  });

  it("matches an approved query template from natural language", () => {
    const template = selectApprovedAdminQuery(
      "Montre-moi les alertes critiques non lues de la plateforme",
    );

    expect(template?.id).toBe("critical_platform_alerts");
  });

  it("builds approved SQL with clamped limit and clinic filter", () => {
    const template = selectApprovedAdminQuery("Top cliniques à risque");
    expect(template).not.toBeNull();

    const sql = buildApprovedAdminSql(template!, {
      clinicId: "123e4567-e89b-12d3-a456-426614174000",
      limit: 500,
    });

    expect(clampAdminQueryLimit(500)).toBe(50);
    expect(sql).toContain("LIMIT 50");
    expect(sql).toContain("123e4567-e89b-12d3-a456-426614174000");
  });
});
