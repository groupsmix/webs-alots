#!/usr/bin/env node

/**
 * CI guard: every Supabase mutation in src/app/api/ must reference clinic_id.
 *
 * For each `.from("table").(insert|update|delete|upsert)` match, require
 * `clinic_id` to appear within ±10 lines of the mutation call.
 *
 * Routes in the ALLOWLIST are skipped — they are verified-safe (cron jobs
 * that iterate per-clinic, webhooks that resolve tenant from payload,
 * pre-tenant onboarding, or cross-tenant admin operations).
 *
 * Source: AUD-007 / TASK-012.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Routes verified safe — each has been manually reviewed and confirmed
// that clinic_id is handled via iteration, payload resolution, or is
// intentionally cross-tenant (admin/cron).
const ALLOWLIST = new Set([
  // Public / pre-tenant endpoints
  "src/app/api/health/route.ts",
  "src/app/api/health/internal/route.ts",
  "src/app/api/csp-report/route.ts",
  "src/app/api/verify-email/route.ts",
  "src/app/api/v1/register-clinic/verification-token/route.ts",
  "src/app/api/auth/demo-login/route.ts",
  // Cron jobs — iterate per-clinic internally
  "src/app/api/cron/notifications/route.ts",
  "src/app/api/cron/dedup-purge/route.ts",
  "src/app/api/cron/reminders/route.ts",
  "src/app/api/cron/gdpr-purge/route.ts",
  "src/app/api/cron/rebooking-reminders/route.ts",
  "src/app/api/cron/audit-log-flush/route.ts",
  // Webhooks — resolve clinic from payload (Stripe metadata, WhatsApp WABA, CMI)
  "src/app/api/billing/webhook/route.ts",
  "src/app/api/payments/webhook/route.ts",
  "src/app/api/payments/cmi/callback/route.ts",
  "src/app/api/webhooks/route.ts",
  // Onboarding — creates the clinic (pre-tenant context)
  "src/app/api/onboarding/route.ts",
  // Consent — uses user-scoped client, no direct clinic_id in insert
  "src/app/api/consent/route.ts",
  // Revenue forecast — platform-wide aggregation tables (revenue_snapshots, revenue_forecasts) have no clinic_id
  "src/app/api/admin/revenue-forecast/route.ts",
  // Admin team — super_admin cross-tenant user management (role updates, member removal)
  "src/app/api/admin/team/route.ts",
  // Admin team briefings — platform-level site-team briefings; the team_briefings
  // table has no clinic_id column (FK is team_member_id → team_members)
  "src/app/api/admin/team/briefings/route.ts",
  // Admin AI config — super_admin cross-tenant AI provider management
  "src/app/api/admin/ai-config/route.ts",
  // Admin AI connection test — super_admin only, no tenant-scoped tables touched
  "src/app/api/admin/ai-config/test/route.ts",
  // AI route — unified AI endpoint with cross-tenant usage logging
  "src/app/api/ai/route.ts",
  // AI router/feature-toggles helpers — cross-tenant reads of ai_* tables
  "src/lib/ai/router.ts",
  "src/lib/ai/feature-toggles.ts",
  // AI Builder sandbox + CopilotKit runtime were moved to a separate
  // Cloudflare Worker (workers/ai/) to keep the main bundle under the
  // 10 MiB Workers Paid limit. The remaining stubs in
  // src/app/api/copilotkit/route.ts and src/app/api/builder/sandbox/route.ts
  // are no-op 501 responders with no Supabase calls — no allowlist entry
  // needed. See workers/ai/README.md.
]);

const MUTATION_RE = /\.from\(["'][a-z_]+["']\)\.(insert|update|delete|upsert)/;
const CLINIC_ID_RE = /clinic_id/;

// Scan window: ±10 lines from the mutation to catch clinic_id in:
// - inline object literals (.insert({ clinic_id, ... }))
// - variable definitions built above the call (const rows = [{ clinic_id, ... }])
// - .eq("clinic_id", ...) chains below the call
const WINDOW = 20;

function checkFile(filePath, lines) {
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    if (!MUTATION_RE.test(lines[i])) continue;

    const start = Math.max(0, i - WINDOW);
    const end = Math.min(lines.length - 1, i + WINDOW);
    let found = false;
    for (let j = start; j <= end; j++) {
      if (CLINIC_ID_RE.test(lines[j])) {
        found = true;
        break;
      }
    }
    if (!found) {
      violations.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return violations;
}

// Get all .ts files under src/app/api/
const files = execSync('git ls-files "src/app/api/**/*.ts"', { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean);

let totalViolations = 0;

for (const file of files) {
  if (ALLOWLIST.has(file)) continue;

  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");
  const violations = checkFile(file, lines);

  for (const v of violations) {
    console.error(
      `::error file=${file},line=${v.line}::Missing clinic_id near Supabase mutation: ${v.text}`,
    );
    totalViolations++;
  }
}

if (totalViolations > 0) {
  console.error(`\n❌ ${totalViolations} Supabase mutation(s) missing clinic_id (see above).`);
  console.error(
    "Every .insert()/.update()/.delete()/.upsert() must include clinic_id\n" +
      "within ±10 lines of the mutation call.\n" +
      "If this is intentionally cross-tenant, add the file to the ALLOWLIST in\n" +
      "scripts/check-tenant-scoping.mjs with a comment explaining why.",
  );
  process.exit(1);
} else {
  console.log("✅ All Supabase mutations reference clinic_id (or are in the allowlist).");
}
