#!/usr/bin/env node
/**
 * CI guard: server-side third-party integration modules must route all
 * outbound HTTP through `safeFetch()` (the egress-allowlist wrapper in
 * src/lib/fetch-wrapper.ts) — never a raw `fetch()`.
 *
 * Why: `safeFetch` is the single choke-point where the egress allowlist
 * (EGRESS_ALLOWLIST_ENFORCE) and outbound-call audit logging are applied.
 * A raw `fetch()` to a third-party API silently bypasses both, so a
 * compromised dependency could exfiltrate to an unlisted host from these
 * exact modules.
 *
 * Scope: only the modules below, which call FIXED third-party APIs. It is
 * intentionally NOT applied to:
 *   - client components / hooks that call same-origin relative `/api/...`
 *     routes (safeFetch is a no-op there — no process.env on the client),
 *   - routes that fetch operator/customer-configured URLs by design
 *     (e.g. cron/retry-webhooks, upload AV scanner, uptime-monitor), which
 *     would be blocked by the allowlist.
 *
 * When you add a new third-party integration module, add it to
 * EGRESS_SENSITIVE_MODULES so its outbound calls stay guarded.
 */
import { readFileSync } from "node:fs";

const EGRESS_SENSITIVE_MODULES = [
  "src/lib/whatsapp.ts",
  "src/lib/sms.ts",
  "src/lib/email.ts",
  "src/lib/hibp.ts",
  "src/lib/cloudflare-dns.ts",
  "src/lib/cloudflare-custom-hostnames.ts",
  "src/app/api/billing/webhook/route.ts",
];

// Matches a bare `fetch(` call. The negative lookbehind excludes
// `safeFetch(`, `stub.fetch(`, `global.fetch(`, `.fetch(`, etc. `fetch` is
// case-sensitive, so `safeFetch(` (capital F) never matches anyway.
const RAW_FETCH = /(?<![.\w])fetch\s*\(/;

const violations = [];
let checked = 0;

for (const file of EGRESS_SENSITIVE_MODULES) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    console.error(
      `::error::egress guard: listed module not found: ${file} (update EGRESS_SENSITIVE_MODULES in scripts/check-egress-safefetch.mjs)`,
    );
    process.exit(1);
  }
  checked++;
  src.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    // Skip line comments and block-comment bodies.
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (RAW_FETCH.test(line)) {
      violations.push(`${file}:${i + 1}: ${trimmed}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    "::error::Raw fetch() found in egress-sensitive module(s). Use safeFetch() from @/lib/fetch-wrapper so the egress allowlist and audit logging apply:",
  );
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log(
  `Egress safeFetch guard OK (${checked} module(s) checked, all outbound calls use safeFetch).`,
);
