
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  try {
    const hasEncryptionKey = !!process.env.BACKUP_ENCRYPTION_KEY;
    
    // We don't have a backup_log table, so we just return env config status
    return apiSuccess({
      configured: hasEncryptionKey,
      lastBackup: "No backup data available (requires infrastructure)",
      lastRestoreDrill: "Never tested",
    });
  } catch (_error) {
    return apiInternalError("Failed to load backup data");
  }
}, ["super_admin"]);
