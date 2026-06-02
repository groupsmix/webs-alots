#!/usr/bin/env node
/**
 * scan-pii-columns.mjs — Audit A61
 *
 * Scans supabase/migrations/*.sql for CREATE TABLE statements and reports
 * every table that holds personal data, classified by PII data class and
 * GDPR Art. 9 / Loi 09-08 art. 12 special-category status.
 *
 * Output:
 *   docs/compliance/_generated/pii-columns.json
 *
 * The committed companion document is docs/compliance/pii-column-inventory.md
 * (manually maintained, last regenerated 2026-05-31). If this script reports
 * new tables/columns that are NOT in the inventory, update the inventory and
 * re-run.
 *
 * Usage:
 *   node scripts/scan-pii-columns.mjs            # writes JSON
 *   node scripts/scan-pii-columns.mjs --check    # exits 1 if diff vs last run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const outDir = path.join(repoRoot, "docs", "compliance", "_generated");
const outFile = path.join(outDir, "pii-columns.json");

// PII column patterns — keep aligned with docs/compliance/pii-column-inventory.md §5
const PII_PATTERNS = {
  patient_id: /\bpatient_id\b/i,
  user_id: /\buser_id\b/i,
  primary_user_id: /\bprimary_user_id\b/i,
  doctor_id: /\bdoctor_id\b/i,
  auth_id: /\bauth_id\b/i,
  name: /\b(first_name|last_name|full_name|patient_name|recipient_name|contact_name|payer_name|guardian_name)\b/i,
  email: /\bemail\b/i,
  phone: /\b(phone|mobile|phone_number)\b/i,
  address: /\b(address|city|postal_code|zip)\b/i,
  dob: /\b(date_of_birth|dob|birth_date)\b/i,
  national_id: /\b(national_id|cin|passport|ssn|cnss)\b/i,
  medical_notes: /\bnotes\s+TEXT/i,
  diagnosis: /\bdiagnosis\b/i,
  content_jsonb: /\bcontent\s+JSONB/i,
  file_url: /\b(file_url|pdf_url|image_url|photo_url|attachment_url)\b/i,
  ip_address: /\b(ip_address|ip_addr|client_ip)\b/i,
  message_body: /\b(message|message_body|content)\s+(TEXT|text)\b/i,
  transcription: /\btranscription\b/i,
};

// Article 9 / Loi 09-08 art. 12 categorisation — keep aligned with inventory §4
const ARTICLE_9_CATEGORIES = {
  mental_health: ["psych_", "speech_", "voice_notes", "whatsapp_voice", "telemedicine"],
  reproductive_sexual: ["pregnancies", "ivf_", "urology"],
  genetic_biometric: ["growth_measurements", "developmental_milestones"],
  physical_health_invasive: [
    "dialysis_",
    "diabetes_",
    "hormone_",
    "blood_",
    "ecg_",
    "eeg_",
    "spirometry",
    "respiratory",
    "news2",
  ],
  imaging_phi: [
    "radiology_",
    "xray_",
    "skin_photos",
    "consultation_photos",
    "progress_photos",
    "before_after_photos",
    "ultrasound_",
  ],
  core_phi: [
    "medical_records",
    "consultation_notes",
    "prescriptions",
    "lab_results",
    "lab_test_orders",
    "lab_orders",
    "clinical_encounters",
    "admissions",
    "medical_certificates",
    "drug_interaction",
  ],
};

function extractTables(sql) {
  const tables = {};
  const re = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*?)^\);/gm;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const [, name, body] = m;
    if (!tables[name]) tables[name] = body;
  }
  return tables;
}

function classify(tables) {
  const markers = {};
  for (const [name, body] of Object.entries(tables)) {
    const hits = [];
    for (const [label, pat] of Object.entries(PII_PATTERNS)) {
      if (pat.test(body)) hits.push(label);
    }
    if (hits.length > 0) markers[name] = hits.sort();
  }
  return markers;
}

function categoriseArticle9(allTableNames) {
  const out = {};
  for (const [cat, kws] of Object.entries(ARTICLE_9_CATEGORIES)) {
    out[cat] = allTableNames.filter((t) => kws.some((kw) => t.includes(kw))).sort();
  }
  return out;
}

function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`migrations dir not found: ${migrationsDir}`);
    process.exit(2);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const allTables = {};
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    const tables = extractTables(sql);
    for (const [name, body] of Object.entries(tables)) {
      // keep first definition (initial schema) only
      if (!allTables[name]) allTables[name] = body;
    }
  }

  const markers = classify(allTables);
  const tableNames = Object.keys(allTables).sort();
  const article9 = categoriseArticle9(tableNames);
  const article9Set = new Set();
  for (const tables of Object.values(article9)) for (const t of tables) article9Set.add(t);

  const dsrScope = Object.keys(markers)
    .filter((t) => markers[t].some((k) => ["patient_id", "user_id", "primary_user_id"].includes(k)))
    .sort();

  const retentionCovered = [
    "activity_logs",
    "appointments",
    "consent_logs",
    "consultation_notes",
    "documents",
    "notification_log",
    "payments",
    "prescriptions",
    "processing_consents",
    "rate_limit_entries",
    "users",
  ];

  const piiTablesNotInRetention = Object.keys(markers)
    .filter((t) => !retentionCovered.includes(t))
    .sort();

  const report = {
    generated_at: new Date().toISOString(),
    source: "supabase/migrations/*.sql",
    headline: {
      total_tables: tableNames.length,
      tables_with_pii: Object.keys(markers).length,
      dsr_scope: dsrScope.length,
      article_9: article9Set.size,
      retention_covered: retentionCovered.length,
      retention_gap: piiTablesNotInRetention.length,
    },
    markers, // { table: ["patient_id", "phone", ...] }
    article_9: article9, // { category: [tables] }
    dsr_scope: dsrScope, // [tables]
    retention_covered: retentionCovered,
    retention_gap: piiTablesNotInRetention,
  };

  fs.mkdirSync(outDir, { recursive: true });

  const check = process.argv.includes("--check");
  if (check && fs.existsSync(outFile)) {
    const prev = JSON.parse(fs.readFileSync(outFile, "utf8"));
    // ignore generated_at when diffing
    const a = JSON.stringify({ ...report, generated_at: undefined });
    const b = JSON.stringify({ ...prev, generated_at: undefined });
    if (a !== b) {
      console.error(
        "[scan-pii-columns] schema PII surface changed; regenerate and update docs/compliance/pii-column-inventory.md",
      );
      console.error(
        "  diff hint: tables_with_pii now=" +
          report.headline.tables_with_pii +
          " was=" +
          prev.headline.tables_with_pii,
      );
      process.exit(1);
    }
    console.log("[scan-pii-columns] no change");
    return;
  }

  fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
  console.log(
    `[scan-pii-columns] wrote ${path.relative(repoRoot, outFile)}: ` +
      `${report.headline.total_tables} tables, ` +
      `${report.headline.tables_with_pii} with PII, ` +
      `${report.headline.dsr_scope} DSR-scope, ` +
      `${report.headline.article_9} Article 9.`,
  );
}

main();
