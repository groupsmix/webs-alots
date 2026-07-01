/**
 * Append-Only Audit Log Service — enhanced audit trail with integrity checks.
 *
 * Adapted from healthcare CRM append-only logging patterns. This module
 * provides application-layer support for the DB trigger–based append-only
 * audit system. The corresponding DB triggers (migration 00116) prevent
 * UPDATE and DELETE on the audit tables, ensuring a tamper-evident log.
 *
 * Key design decisions:
 *   1. Append-only enforced at DB level (triggers reject UPDATE/DELETE)
 *   2. Hash chain: each entry includes SHA-256 of the previous entry
 *   3. Batch writes for high-volume operations (e.g., bulk import)
 *   4. All entries are clinic-scoped (clinic_id required)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/crypto-utils";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/types/database";

/** Audit entry shape for the immutable log. */
interface ImmutableAuditEntry {
  clinic_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  payload: Record<string, Json | undefined>;
  previous_hash: string | null;
  entry_hash: string;
  created_at: string;
}

/**
 * Compute a hash for an audit entry to build the hash chain.
 * The hash covers all meaningful fields to detect tampering.
 */
export async function computeEntryHash(
  clinicId: string,
  action: string,
  entityType: string,
  entityId: string,
  actorId: string | null,
  payload: Record<string, Json | undefined>,
  previousHash: string | null,
  timestamp: string,
): Promise<string> {
  const input = [
    clinicId,
    action,
    entityType,
    entityId,
    actorId ?? "",
    JSON.stringify(payload),
    previousHash ?? "genesis",
    timestamp,
  ].join("|");

  return sha256Hex(input);
}

/**
 * Retrieve the hash of the most recent audit entry for a clinic.
 * Returns null if no entries exist (genesis block).
 */
export async function getLastAuditHash(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<string | null> {
  const { data } = await (supabase as SupabaseClient)
    .from("immutable_audit_log")
    .select("entry_hash")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const row = data as { entry_hash?: string } | null;
  return row?.entry_hash ?? null;
}

/**
 * Write a single append-only audit entry with hash chain integrity.
 */
export async function writeImmutableAuditEntry(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    payload: Record<string, Json | undefined>;
  },
): Promise<{ ok: boolean; entryHash?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const previousHash = await getLastAuditHash(supabase, params.clinicId);

    const entryHash = await computeEntryHash(
      params.clinicId,
      params.action,
      params.entityType,
      params.entityId,
      params.actorId,
      params.payload,
      previousHash,
      timestamp,
    );

    const { error } = await (supabase as SupabaseClient).from("immutable_audit_log").insert({
      clinic_id: params.clinicId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      actor_id: params.actorId,
      payload: params.payload,
      previous_hash: previousHash,
      entry_hash: entryHash,
      created_at: timestamp,
    });

    if (error) {
      logger.error("Immutable audit write failed", {
        context: "audit-append-only",
        clinicId: params.clinicId,
        error,
      });
      return { ok: false };
    }

    return { ok: true, entryHash };
  } catch (err) {
    logger.error("Immutable audit entry error", { context: "audit-append-only", error: err });
    return { ok: false };
  }
}

/**
 * Verify the hash chain integrity for a clinic's audit log.
 * Returns the first entry where the chain breaks, or null if valid.
 */
export async function verifyAuditChain(
  supabase: SupabaseClient,
  clinicId: string,
  options?: { limit?: number },
): Promise<{ valid: boolean; brokenAt?: string }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from("immutable_audit_log")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 1000);

  if (error) {
    logger.error("Audit chain verification query failed", {
      context: "audit-append-only",
      error,
    });
    return { valid: false, brokenAt: "query_error" };
  }

  if (!data || data.length === 0) return { valid: true };

  let previousHash: string | null = null;

  for (const entry of data) {
    const row = entry as unknown as ImmutableAuditEntry;
    if (row.previous_hash !== previousHash) {
      return { valid: false, brokenAt: row.entity_id };
    }

    const expectedHash = await computeEntryHash(
      row.clinic_id,
      row.action,
      row.entity_type,
      row.entity_id,
      row.actor_id,
      row.payload,
      row.previous_hash,
      row.created_at,
    );

    if (row.entry_hash !== expectedHash) {
      return { valid: false, brokenAt: row.entity_id };
    }

    previousHash = row.entry_hash;
  }

  return { valid: true };
}
