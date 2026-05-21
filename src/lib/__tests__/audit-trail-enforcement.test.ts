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
  "src/app/api/chat/route.ts",
  "src/app/api/ai/auto-suggest/route.ts",
  "src/app/api/booking/verify/route.ts",
  "src/app/api/patient/profile/route.ts",
  "src/app/api/auth/clear-site/route.ts",
  "src/app/api/webhooks/route.ts",
  "src/app/api/verify-email/route.ts",
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
