#!/usr/bin/env node
/**
 * Build-time guard for client-inlined public environment variables.
 *
 * Next.js inlines `NEXT_PUBLIC_*` variables into the **client bundle** at
 * build time. If they are missing/empty during `build:cf`, the browser
 * Supabase client (`src/lib/supabase-client.ts`) initialises with empty
 * credentials and throws "Missing Supabase environment variables" at
 * runtime — which surfaces to users as the generic "Une erreur inattendue"
 * on /register (signup) while server-side flows (login, password reset)
 * keep working because they read the value at runtime on the Worker.
 *
 * This is exactly the failure mode that shipped to production once: the
 * Worker runtime secrets were set (server-side login worked) but the
 * GitHub Actions build secrets were never set, so the client bundle was
 * built with empty Supabase credentials and signup broke silently.
 *
 * This guard makes that failure LOUD at build time instead of silent in
 * production. The existing "Verify build output" CI step only checks that
 * a worker entrypoint exists — it does not check that public env vars were
 * actually inlined. This closes that gap.
 *
 * Escape hatch: set ALLOW_MISSING_PUBLIC_ENV=1 to downgrade to a warning
 * (e.g. a local structural build where signup is not exercised).
 *
 * Usage:
 *   node scripts/check-build-env.mjs
 */

/** Public vars that MUST be present (non-empty) in the build environment. */
const REQUIRED_PUBLIC_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

/** Lightweight shape checks so an obviously-wrong value also fails fast. */
const VALIDATORS = {
  NEXT_PUBLIC_SUPABASE_URL: (v) =>
    /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(v) ||
    `expected a https://<project>.supabase.co URL, got "${v.slice(0, 32)}…"`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: (v) =>
    // Legacy JWT anon key (eyJ...) OR new publishable key (sb_publishable_...)
    /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v) ||
    /^sb_publishable_[\w-]{20,}$/.test(v) ||
    `expected a Supabase anon/publishable key (JWT "eyJ…" or "sb_publishable_…"), got "${v.slice(0, 16)}…"`,
};

const allowMissing = process.env.ALLOW_MISSING_PUBLIC_ENV === "1";
const problems = [];

for (const name of REQUIRED_PUBLIC_VARS) {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    problems.push(`  ✗ ${name} is missing or empty`);
    continue;
  }
  const validate = VALIDATORS[name];
  if (validate) {
    const result = validate(value);
    if (result !== true) problems.push(`  ✗ ${name}: ${result}`);
  }
}

if (problems.length === 0) {
  console.log("✓ check-build-env: all required NEXT_PUBLIC_* build vars are present.");
  process.exit(0);
}

const header =
  "\n✗ check-build-env: client bundle would ship WITHOUT valid Supabase public credentials.\n" +
  "  These are inlined into the browser bundle at build time. Without them, signup\n" +
  "  (the browser Supabase client) breaks while server-side login still works.\n\n";
const fix =
  "\n  Fix: set these as **GitHub Actions repository secrets** (Settings → Secrets and\n" +
  "  variables → Actions). Note: these are SEPARATE from the Cloudflare Worker runtime\n" +
  "  secrets (`wrangler secret put`) — the build needs its own copy to inline them.\n" +
  "  Values come from Supabase → Project Settings → API.\n";

if (allowMissing) {
  console.warn(header + problems.join("\n") + fix);
  console.warn("\n  ALLOW_MISSING_PUBLIC_ENV=1 set → continuing with a WARNING.\n");
  process.exit(0);
}

console.error(header + problems.join("\n") + fix);
process.exit(1);
