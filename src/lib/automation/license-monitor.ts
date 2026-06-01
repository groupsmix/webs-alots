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
export async function checkExpiringLicenses(
  supabase: SupabaseClient
): Promise<ExpiringLicense[]> {
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
      // In Oltigo, custom medical fields might be in metadata jsonb
      const meta = doc.metadata as Record<string, any>;
      if (!meta || !meta.license_expiry_date) continue;

      const expiryDate = new Date(meta.license_expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // We only care about licenses expiring in 90 days or fewer, and not already heavily expired
      // (though we should probably flag heavily expired ones too)
      if (daysUntilExpiry <= 90 && daysUntilExpiry >= -30) {
        expiring.push({
          doctorId: doc.id,
          doctorName: `Dr. ${doc.first_name} ${doc.last_name}`,
          licenseNumber: meta.license_number || "Unknown",
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry
        });
      }
    }

    return expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  } catch (err) {
    logger.error("Failed to check expiring licenses", {
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}
