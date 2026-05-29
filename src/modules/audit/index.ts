/**
 * Audit Module
 *
 * Append-only audit logging with hash-chain integrity for
 * healthcare compliance (HIPAA, Moroccan Law 09-08).
 */

export {
  writeImmutableAuditEntry,
  verifyAuditChain,
  computeEntryHash,
  getLastAuditHash,
} from "./append-only";
export type { ImmutableAuditEntry } from "./append-only";
