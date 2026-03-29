/**
 * Audit logging utility for healthcare compliance.
 *
 * Logs data mutations (appointment CRUD, patient changes, role changes,
 * impersonation, auth events, config changes, etc.) to the
 * `activity_logs` table. Failures are caught and logged to stderr so
 * they never break the calling endpoint.
 *
 * Supports structured metadata for rich audit trail queries and
 * optional IP/user-agent tracking for security-sensitive events.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { logger } from "@/lib/logger";

/** Audit event categories for structured filtering. */
export type AuditEventType =
  | "booking"
  | "patient"
  | "payment"
  | "admin"
  | "auth"
  | "config"
  | "security";

interface AuditLogParams {
  supabase: SupabaseClient<Database>;
  action: string;
  type: AuditEventType;
  /** clinic_id is required for healthcare compliance — every audit entry must be scoped to a tenant */
  clinicId: string;
  actor?: string | null;
  clinicName?: string | null;
  description?: string | null;
  /** Client IP address — include for auth/security events */
  ipAddress?: string | null;
  /** Client user agent — include for auth/security events */
  userAgent?: string | null;
  /** Structured metadata for rich audit queries (stored as JSONB) */
  metadata?: Record<string, Json | undefined> | null;
}

export async function logAuditEvent({
  supabase,
  action,
  type,
  actor,
  clinicId,
  clinicName,
  description,
  ipAddress,
  userAgent,
  metadata,
}: AuditLogParams): Promise<void> {
  try {
    await supabase.from("activity_logs").insert({
      action,
      type,
      actor: actor ?? null,
      clinic_id: clinicId,
      clinic_name: clinicName ?? null,
      description: description ?? null,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
      metadata: metadata ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Failed to write audit log", { context: "audit-log", error: err });
  }
}

// ── Pre-built audit helpers for common operations ────────────────────

/**
 * Log an authentication event (login, logout, password reset, etc.).
 * Always includes IP address and user agent for security audit trail.
 */
export async function logAuthEvent(params: {
  supabase: SupabaseClient<Database>;
  action: string;
  actor: string;
  clinicId?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}): Promise<void> {
  await logAuditEvent({
    supabase: params.supabase,
    action: params.action,
    type: "auth",
    actor: params.actor,
    clinicId: params.clinicId ?? "system",
    description: params.description,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { success: params.success ?? true },
  });
}

/**
 * Log a security-sensitive event (impersonation, role change, etc.).
 * Always includes IP address and structured metadata.
 */
export async function logSecurityEvent(params: {
  supabase: SupabaseClient<Database>;
  action: string;
  actor: string;
  clinicId: string;
  clinicName?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, Json | undefined>;
}): Promise<void> {
  await logAuditEvent({
    supabase: params.supabase,
    action: params.action,
    type: "security",
    actor: params.actor,
    clinicId: params.clinicId,
    clinicName: params.clinicName,
    description: params.description,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}
