import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export interface ExpiringLicense {
  doctorId: string;
  doctorName: string;
  licenseNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

/**
 * Checks for doctor medical licenses (e.g., INOM registration) that are
 * approaching expiration within 30, 60, or 90 days.
 */
export async function checkExpiringLicenses(supabase: SupabaseClient): Promise<ExpiringLicense[]> {
  try {
    // Note: Assuming `doctors` table has `license_number` and `license_expiry_date`
    // If it's stored in `profiles`, adjust the table name.

    const today = new Date();
    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(today.getDate() + 90);

    const { data: doctors, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, metadata")
      .eq("role", "doctor")
      .not("metadata", "is", null);

    if (error) {
      throw error;
    }

    const expiring: ExpiringLicense[] = [];

    for (const doc of doctors || []) {
      // In Oltigo, custom medical fields might be in metadata jsonb. We
      // narrow each field at the use site rather than trust a wide cast.
      const meta = doc.metadata as Record<string, unknown> | null | undefined;
      const expiryRaw = meta?.license_expiry_date;
      if (!meta || (typeof expiryRaw !== "string" && typeof expiryRaw !== "number")) {
        continue;
      }

      const expiryDate = new Date(expiryRaw);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      // We only care about licenses expiring in 90 days or fewer, and not already heavily expired
      // (though we should probably flag heavily expired ones too)
      if (daysUntilExpiry <= 90 && daysUntilExpiry >= -30) {
        const licenseNumberRaw = meta.license_number;
        const licenseNumber = typeof licenseNumberRaw === "string" ? licenseNumberRaw : "Unknown";
        expiring.push({
          doctorId: doc.id,
          doctorName: `Dr. ${doc.first_name} ${doc.last_name}`,
          licenseNumber,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
        });
      }
    }

    return expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  } catch (err) {
    logger.error("Failed to check expiring licenses", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
