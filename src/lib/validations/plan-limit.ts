import { z } from "zod";

/**
 * Validation schemas for plan-limit related API endpoints.
 */

/** Query schema for manually triggering usage-alert checks (super-admin only). */
export const usageAlertQuerySchema = z.object({
  clinicId: z.string().uuid(),
});

export type UsageAlertQuery = z.infer<typeof usageAlertQuerySchema>;
