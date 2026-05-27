#!/usr/bin/env node
/**
 * R-05: Snapshot pg_policies for CI diffing.
 *
 * Connects to a running Supabase local instance and exports all RLS
 * policies as a sorted JSON file. CI compares this snapshot against a
 * committed baseline to catch unintended RLS changes in PRs that modify
 * migrations.
 *
 * Usage:
 *   supabase start
 *   SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \
 *   SUPABASE_LOCAL_SERVICE_KEY=<service_role_key> \
 *   node scripts/snapshot-rls-policies.mjs [--update]
 *
 * --update: Write the snapshot to pg_policies.snapshot.json (for baselining)
 * Without --update: Print to stdout (for CI diffing)
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_LOCAL_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_LOCAL_URL or SUPABASE_LOCAL_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.rpc("get_rls_policies_snapshot");

if (error) {
  // If the RPC doesn't exist yet, fall back to direct SQL
  console.error("RPC get_rls_policies_snapshot not found — using direct query");
  const { data: policies, error: sqlError } = await supabase
    .from("pg_policies")
    .select("schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check")
    .eq("schemaname", "public")
    .order("tablename")
    .order("policyname");

  if (sqlError) {
    console.error("Failed to query pg_policies:", sqlError.message);
    process.exit(1);
  }

  outputSnapshot(policies ?? []);
} else {
  outputSnapshot(data ?? []);
}

function outputSnapshot(policies) {
  const sorted = policies.sort((a, b) => {
    const tableCompare = (a.tablename ?? "").localeCompare(b.tablename ?? "");
    if (tableCompare !== 0) return tableCompare;
    return (a.policyname ?? "").localeCompare(b.policyname ?? "");
  });

  const snapshot = {
    generated_at: new Date().toISOString(),
    total_policies: sorted.length,
    policies: sorted.map((p) => ({
      table: p.tablename,
      policy: p.policyname,
      permissive: p.permissive,
      roles: p.roles,
      command: p.cmd,
    })),
  };

  const json = JSON.stringify(snapshot, null, 2) + "\n";

  if (process.argv.includes("--update")) {
    const outPath = resolve("pg_policies.snapshot.json");
    writeFileSync(outPath, json);
    console.log(`Snapshot written to ${outPath} (${sorted.length} policies)`);
  } else {
    process.stdout.write(json);
  }
}
