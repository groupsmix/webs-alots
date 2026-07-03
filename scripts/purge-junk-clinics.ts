/**
 * Junk clinic purge — Oltigo Health
 *
 * Permanently deletes the historical test / keyboard-mash tenants that
 * migration 00173 quarantined (see `src/lib/validations/known-junk-tenants.ts`).
 * It matches ONLY that curated, human-reviewed slug list — it never guesses
 * from names — so it cannot delete a real practice.
 *
 * SAFETY
 *   - Dry-run by default: prints what it *would* delete and changes nothing.
 *     Pass `--confirm` to actually delete.
 *   - PHI guard: any matched clinic that still has patient records is SKIPPED
 *     and reported for manual review — never auto-deleted, even with --confirm.
 *   - Deletion cascades (clinic-scoped FKs are ON DELETE CASCADE), so empty
 *     junk clinics are removed cleanly.
 *
 * USAGE
 *   npm run purge:junk            # dry-run (safe preview)
 *   npm run purge:junk -- --confirm   # actually delete the empty junk clinics
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL) in the
 * environment, exactly like `npm run seed`. Point it at the environment you
 * want to clean (e.g. production) via those env vars.
 */

import { createAdminClient } from "../src/lib/supabase-server";
import { isKnownJunkSubdomain } from "../src/lib/validations/known-junk-tenants";

const CONFIRM = process.argv.includes("--confirm");

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is required.\n" +
      "Set it (and NEXT_PUBLIC_SUPABASE_URL) in the environment, then re-run.",
  );
  process.exit(1);
}

interface ClinicRow {
  id: string;
  name: string | null;
  subdomain: string | null;
  status: string | null;
}

async function main(): Promise<void> {
  const supabase = createAdminClient("super_admin");

  const { data: clinics, error } = await supabase
    .from("clinics")
    .select("id, name, subdomain, status");

  if (error) {
    console.error("Failed to fetch clinics:", error.message);
    process.exit(1);
  }

  const junk = ((clinics ?? []) as ClinicRow[]).filter((c) => isKnownJunkSubdomain(c.subdomain));

  console.log(`\nMode: ${CONFIRM ? "DELETE (--confirm)" : "DRY-RUN (no changes)"}`);
  console.log(
    `Total clinics: ${clinics?.length ?? 0} | matched known-junk slugs: ${junk.length}\n`,
  );

  if (junk.length === 0) {
    console.log("Nothing to purge. ✅");
    return;
  }

  const deletable: ClinicRow[] = [];
  const skippedWithPatients: { clinic: ClinicRow; patients: number }[] = [];

  const junkIds = junk.map((c) => c.id);
  const { data: usersData } = await supabase
    .from("users")
    .select("clinic_id")
    .in("clinic_id", junkIds)
    .eq("role", "patient");

  const patientCounts = new Map<string, number>();
  for (const row of usersData || []) {
    if (row.clinic_id) {
      patientCounts.set(row.clinic_id, (patientCounts.get(row.clinic_id) || 0) + 1);
    }
  }

  for (const clinic of junk) {
    const patients = patientCounts.get(clinic.id) || 0;
    if (patients > 0) {
      skippedWithPatients.push({ clinic, patients });
    } else {
      deletable.push(clinic);
    }
  }

  console.log(`Empty junk clinics to delete: ${deletable.length}`);
  for (const c of deletable) {
    console.log(
      `  - ${c.subdomain ?? "—"}  ("${c.name ?? "—"}", status=${c.status ?? "—"}, id=${c.id})`,
    );
  }

  if (skippedWithPatients.length > 0) {
    console.log(
      `\n⚠️  Skipped ${skippedWithPatients.length} junk-named clinic(s) that HAVE patient data ` +
        `(review manually — not auto-deleted):`,
    );
    for (const { clinic, patients } of skippedWithPatients) {
      console.log(
        `  - ${clinic.subdomain ?? "—"}  (${patients} patient record(s), id=${clinic.id})`,
      );
    }
  }

  if (!CONFIRM) {
    console.log("\nDry-run only — nothing was deleted. Re-run with --confirm to delete the above.");
    return;
  }

  if (deletable.length === 0) {
    console.log("\nNo empty junk clinics to delete.");
    return;
  }

  console.log("\nDeleting…");
  let deleted = 0;
  for (const c of deletable) {
    const { error: delErr } = await supabase.from("clinics").delete().eq("id", c.id);
    if (delErr) {
      console.error(`  ✗ ${c.subdomain}: ${delErr.message}`);
    } else {
      deleted += 1;
      console.log(`  ✓ deleted ${c.subdomain}`);
    }
  }
  console.log(`\nDone. Deleted ${deleted}/${deletable.length} junk clinic(s).`);
  if (skippedWithPatients.length > 0) {
    console.log(`${skippedWithPatients.length} skipped (had patient data).`);
  }
}

main().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
