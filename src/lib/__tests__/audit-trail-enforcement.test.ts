import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { globSync } from "glob";

// A8-05: Audit Trail Enforcement
// Enforce that all state-changing API routes (POST, PUT, PATCH, DELETE)
// import and use `logAuditEvent` or `logAuthEvent`.

const STATE_CHANGING_METHODS = ["export async function POST", "export const POST", "export async function PUT", "export const PUT", "export async function PATCH", "export const PATCH", "export async function DELETE", "export const DELETE"];
const IGNORED_ROUTES = [
  "src/app/api/chat/route.ts", // AI chat is not a state-changing resource in the same way
  "src/app/api/ai/auto-suggest/route.ts", // AI suggestion
  "src/app/api/booking/verify/route.ts", // Rate-limited token issuance, not DB mutation
];

describe("A8-05: Audit Trail Enforcement", () => {
  it("must call logAuditEvent in all state-changing API routes", () => {
    const apiRoutes = globSync("src/app/api/**/route.ts");

    for (const route of apiRoutes) {
      if (IGNORED_ROUTES.some(ignored => route.replace(/\\/g, "/").includes(ignored))) continue;

      const content = readFileSync(route, "utf-8");
      
      const hasStateChangingMethod = STATE_CHANGING_METHODS.some(method => content.includes(method));
      if (!hasStateChangingMethod) continue;

      const importsAuditLog = content.includes("logAuditEvent") || content.includes("logAuthEvent");
      
      expect(importsAuditLog, `State-changing route ${route} MUST import and call logAuditEvent or logAuthEvent.`).toBe(true);
    }
  });
});
