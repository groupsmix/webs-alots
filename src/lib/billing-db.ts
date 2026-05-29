/**
 * Billing database helpers.
 *
 * Tables added in migration 00108 are not yet in the generated DB types.
 * This module provides type-safe wrappers using untyped Supabase access,
 * following the same pattern as src/lib/whatsapp.ts for whatsapp_templates.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

function untyped(supabase: SupabaseClient<Database>): SupabaseUntyped {
  return supabase as unknown as SupabaseUntyped;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export function untypedClient(supabase: AnyClient): SupabaseUntyped {
  return supabase as unknown as SupabaseUntyped;
}

// ── Table accessors ──

export function invoicesTable(supabase: SupabaseClient<Database>) {
  return untyped(supabase).from("invoices"); // nosemgrep: semgrep.tenant-scoping
}

export function invoiceLineItemsTable(supabase: SupabaseClient<Database>) {
  return untyped(supabase).from("invoice_line_items"); // nosemgrep: semgrep.tenant-scoping
}

export function paymentPlansTable(supabase: SupabaseClient<Database>) {
  return untyped(supabase).from("payment_plans"); // nosemgrep: semgrep.tenant-scoping
}

export function paymentPlanInstallmentsTable(supabase: SupabaseClient<Database>) {
  return untyped(supabase).from("payment_plan_installments"); // nosemgrep: semgrep.tenant-scoping
}

export function paymentRemindersTable(supabase: SupabaseClient<Database>) {
  return untyped(supabase).from("payment_reminders"); // nosemgrep: semgrep.tenant-scoping
}
