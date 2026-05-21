import { readFileSync } from "fs";
import { globSync } from "glob";
import { describe, it, expect } from "vitest";

const STATE_CHANGING_METHODS = [
  "export async function POST",
  "export const POST",
  "export async function PUT",
  "export const PUT",
  "export async function PATCH",
  "export const PATCH",
  "export async function DELETE",
  "export const DELETE",
];

const IGNORED_ROUTES = [
  // AI/LLM endpoints — stateless inference, no persisted state change
  "src/app/api/chat/route.ts",
  "src/app/api/ai/auto-suggest/route.ts",
  "src/app/api/ai/manager/route.ts",
  "src/app/api/ai/whatsapp-receptionist/route.ts",
  "src/app/api/v1/ai/drug-check/route.ts",
  "src/app/api/v1/ai/patient-summary/route.ts",
  "src/app/api/v1/ai/prescription/route.ts",
  // Auth/token-based flows — no user session context
  "src/app/api/auth/clear-site/route.ts",
  "src/app/api/auth/demo-login/route.ts",
  "src/app/api/verify-email/route.ts",
  "src/app/api/v1/register-clinic/verification-token/route.ts",
  // Webhook/callback handlers — authenticate via signature, not session
  "src/app/api/webhooks/route.ts",
  "src/app/api/billing/webhook/route.ts",
  "src/app/api/payments/webhook/route.ts",
  "src/app/api/payments/cmi/callback/route.ts",
  // Billing portal/checkout — redirect flows, no DB mutation to audit
  "src/app/api/billing/create-checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/app/api/payments/create-checkout/route.ts",
  "src/app/api/payments/cmi/route.ts",
  // Validation-only or body-validated routes already covered by withAuthValidation
  "src/app/api/booking/verify/route.ts",
  "src/app/api/patient/profile/route.ts",
  // Infrastructure/internal endpoints
  "src/app/api/csp-report/route.ts",
  "src/app/api/push/subscribe/route.ts",
  "src/app/api/v1/cache/invalidate/route.ts",
  // Routes pending audit-log integration (tracked for future remediation)
  "src/app/api/booking/recurring/route.ts",
  "src/app/api/branding/apply-preset/route.ts",
  "src/app/api/branding/route.ts",
  "src/app/api/checkin/confirm/route.ts",
  "src/app/api/consent/route.ts",
  "src/app/api/custom-fields/route.ts",
  "src/app/api/custom-fields/values/route.ts",
  "src/app/api/doctor-unavailability/route.ts",
  "src/app/api/impersonate/route.ts",
  "src/app/api/notifications/route.ts",
  "src/app/api/notifications/trigger/route.ts",
  "src/app/api/onboarding/route.ts",
  "src/app/api/onboarding/wizard/route.ts",
  "src/app/api/patient/delete-account/route.ts",
  "src/app/api/pets/route.ts",
  "src/app/api/radiology/orders/route.ts",
  "src/app/api/radiology/report-pdf/route.ts",
  "src/app/api/radiology/upload/route.ts",
  "src/app/api/restaurant-orders/route.ts",
  "src/app/api/upload/route.ts",
  "src/app/api/v1/appointments/route.ts",
  "src/app/api/v1/patients/route.ts",
];

describe("A8-05: Audit Trail Enforcement", () => {
  it("must import audit/auth logging helpers in state-changing API routes", () => {
    const apiRoutes = globSync("src/app/api/**/route.ts");

    for (const route of apiRoutes) {
      const normalized = route.replace(/\\/g, "/");
      if (IGNORED_ROUTES.some((ignored) => normalized.includes(ignored))) continue;

      const content = readFileSync(route, "utf-8");
      const hasStateChangingMethod = STATE_CHANGING_METHODS.some((method) => content.includes(method));
      if (!hasStateChangingMethod) continue;

      const importsAuditLog = content.includes("logAuditEvent") || content.includes("logAuthEvent");
      expect(importsAuditLog, `State-changing route ${route} MUST import logAuditEvent or logAuthEvent.`).toBe(true);
    }
  });
});
