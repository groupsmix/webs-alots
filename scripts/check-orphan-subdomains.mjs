#!/usr/bin/env node

import { writeFileSync } from "node:fs";

/**
 * A147-01: Weekly orphan subdomain detection.
 *
 * Subdomains are served by a single wildcard route (*.oltigo.com), so every
 * possible subdomain "resolves" in DNS — a DNS probe would flag everything and
 * is therefore useless here. Instead this compares the set of inactive/deleted
 * clinic subdomains against the set of active ones (both from Supabase) and
 * reports subdomains that are no longer owned by an active clinic yet would
 * still be served by the wildcard route — i.e. candidates for hijack/reuse
 * that need an explicit deny rule or tenant cleanup.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-orphan-subdomains.mjs
 *
 * Intended to run as a weekly cron job (GitHub Actions or external scheduler).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLACK_WEBHOOK = process.env.SLACK_SECURITY_ALERTS_WEBHOOK_URL;
const OUTPUT_PATH = process.env.ORPHAN_SUBDOMAINS_OUTPUT || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function getActiveClinicSubdomains() {
  const url = `${SUPABASE_URL}/rest/v1/clinics?select=subdomain&status=eq.active&deleted_at=is.null`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  }
  const clinics = await res.json();
  return new Set(clinics.map((c) => c.subdomain).filter(Boolean));
}

async function getDeletedClinicSubdomains() {
  const url = `${SUPABASE_URL}/rest/v1/clinics?select=subdomain&or=(status.eq.inactive,deleted_at.not.is.null)`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  }
  const clinics = await res.json();
  return clinics.map((c) => c.subdomain).filter(Boolean);
}

async function alertSlack(orphans) {
  if (!SLACK_WEBHOOK) {
    console.warn("No SLACK_SECURITY_ALERTS_WEBHOOK_URL — skipping Slack alert");
    return;
  }
  const text = [
    ":warning: *Orphan Subdomain Alert (A147-01)*",
    "",
    `Found ${orphans.length} orphaned subdomain(s) that are inactive/deleted but still served by the wildcard route:`,
    ...orphans.map((s) => `• \`${s}.oltigo.com\``),
    "",
    "Action: Verify these subdomains are safe or add explicit DNS deny rules.",
  ].join("\n");

  await fetch(SLACK_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

async function main() {
  console.log("Checking for orphan subdomains...");

  const activeSubdomains = await getActiveClinicSubdomains();
  const deletedSubdomains = await getDeletedClinicSubdomains();

  const orphans = [
    ...new Set(deletedSubdomains.filter((sub) => !activeSubdomains.has(sub))),
  ].sort();

  if (OUTPUT_PATH) {
    writeFileSync(OUTPUT_PATH, orphans.join("\n") + (orphans.length > 0 ? "\n" : ""), "utf8");
  }

  if (orphans.length === 0) {
    console.log("No orphan subdomains detected.");
    process.exit(0);
  }

  console.warn(`Found ${orphans.length} orphan subdomain(s):`);
  for (const sub of orphans) {
    console.warn(`  - ${sub}.oltigo.com`);
  }

  await alertSlack(orphans);
  process.exit(1);
}

main().catch((err) => {
  console.error("Orphan subdomain check failed:", err);
  process.exit(2);
});
