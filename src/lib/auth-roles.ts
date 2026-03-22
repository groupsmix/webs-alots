/**
 * Shared role constants for API route authorization.
 *
 * DRY: Previously defined identically in 14+ route files.
 * Import from here instead of re-declaring per file.
 */

import type { UserRole } from "@/lib/types/database";

/** All staff roles that can access clinic management endpoints. */
export const STAFF_ROLES: UserRole[] = [
  "super_admin",
  "clinic_admin",
  "receptionist",
  "doctor",
];
