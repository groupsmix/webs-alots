#!/usr/bin/env node
/**
 * Seed initial feature flags into Cloudflare KV.
 *
 * This script is intentionally non-destructive: it prints the exact
 * `wrangler kv:key put` commands operators should run against the target
 * environment instead of trying to mutate production KV automatically from
 * a local machine without explicit environment selection.
 *
 * Usage:
 *   node scripts/seed-feature-flags.mjs
 */

const FEATURE_FLAGS = [
  {
    key: "ai_chat",
    enabled: true,
    description: "Enable AI-powered chat assistance",
    category: "core",
  },
  {
    key: "whatsapp_notifications",
    enabled: true,
    description: "Send appointment reminders via WhatsApp",
    category: "integration",
  },
  {
    key: "prescription_ocr",
    enabled: false,
    description: "OCR for prescription document scanning",
    category: "experimental",
  },
  {
    key: "telemedicine",
    enabled: true,
    description: "Video consultation feature",
    category: "core",
  },
];

console.log("Feature flag seed plan for FEATURE_FLAGS_KV");
console.log("");

for (const flag of FEATURE_FLAGS) {
  const kvKey = `feature_flag:${flag.key}`;
  const payload = JSON.stringify({
    enabled: flag.enabled,
    description: flag.description,
    category: flag.category,
    updated_at: new Date().toISOString(),
  });

  console.log(`# ${flag.description}`);
  console.log(`wrangler kv:key put --binding=FEATURE_FLAGS_KV "${kvKey}" '${payload}'`);
  console.log("");
}

console.log("Next steps:");
console.log("1. Choose the target environment explicitly, for example `--env staging`.");
console.log("2. Run each generated command with Wrangler authenticated to the correct account.");
console.log("3. Refresh /super-admin/feature-flags and verify the values after seeding.");
