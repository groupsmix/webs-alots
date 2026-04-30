/**
 * Sequential invoice number allocation for Moroccan DGI compliance.
 *
 * A164-01: The Moroccan Direction Generale des Impots requires an unbroken
 * sequential invoice series per tenant per fiscal year. This module wraps
 * the database function `next_invoice_number()` (added in migration 00077)
 * so application code can allocate numbers safely.
 *
 * Usage:
 *   const invoiceNumber = await allocateInvoiceNumber(supabase, clinicId);
 *   // Returns "2026-000001", "2026-000002", etc.
 *
 * The function MUST be called within the same transaction as the invoice
 * INSERT to guarantee gap-free numbering.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/lib/types/database";

/**
 * Allocate the next sequential invoice number for a clinic.
 *
 * Calls the DB function `next_invoice_number(clinic_id, fiscal_year)` which
 * atomically increments a per-clinic-per-year counter and returns a formatted
 * string like "2026-000001".
 *
 * @param supabase - Supabase client (preferably admin to bypass RLS)
 * @param clinicId - The clinic UUID
 * @param fiscalYear - Optional fiscal year override (defaults to current year)
 * @returns The allocated invoice number string
 * @throws Error if the allocation fails
 */
export async function allocateInvoiceNumber(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  fiscalYear?: number,
): Promise<string> {
  const year = fiscalYear ?? new Date().getFullYear();

  // Cast needed: next_invoice_number is added in migration 00077 and not
  // yet in the generated database types. Will resolve after `supabase gen types`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("next_invoice_number", {
    p_clinic_id: clinicId,
    p_fiscal_year: year,
  });

  if (error || !data) {
    logger.error("Failed to allocate invoice number", {
      context: "invoice-number",
      clinicId,
      fiscalYear: year,
      error,
    });
    throw new Error(
      `Failed to allocate invoice number for clinic ${clinicId}, year ${year}: ${error?.message ?? "no data returned"}`,
    );
  }

  return data as string;
}

/**
 * Validate that an invoice number matches the expected format: YYYY-NNNNNN.
 *
 * Useful for verifying that externally-supplied invoice numbers conform
 * to the DGI-required sequential format before database insertion.
 */
export function isValidInvoiceNumberFormat(invoiceNumber: string): boolean {
  return /^\d{4}-\d{6}$/.test(invoiceNumber);
}

/**
 * Parse a formatted invoice number into its components.
 *
 * @returns { year, sequence } or null if the format is invalid
 */
export function parseInvoiceNumber(
  invoiceNumber: string,
): { year: number; sequence: number } | null {
  const match = invoiceNumber.match(/^(\d{4})-(\d{6})$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}
