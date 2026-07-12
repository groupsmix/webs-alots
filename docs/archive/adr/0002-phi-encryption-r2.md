# ADR-0002: Client-Side PHI Encryption Before R2 Upload

## Status

Accepted

## Date

2026-04-30

## Context

Patient files (lab results, prescriptions, imaging) are Protected Health
Information (PHI) subject to Moroccan Law 09-08 (CNDP). Files must be
encrypted at rest. Cloudflare R2 provides server-side encryption, but
defense-in-depth requires that even R2 operators cannot read PHI.

## Decision

Encrypt PHI files **client-side** with AES-256-GCM before uploading to
R2. Each file gets a unique IV. Encryption keys are derived from a
per-clinic secret stored in environment variables, rotated via the
`scripts/rotate-phi-key.ts` procedure documented in
`docs/SOP-PHI-KEY-ROTATION.md`.

Implementation: `src/lib/encryption.ts`

## Alternatives Considered

1. **R2 server-side encryption only** - Simpler but Cloudflare staff
   could theoretically access plaintext; does not meet defense-in-depth.
2. **Per-patient keys** - Strongest isolation but key management
   complexity is prohibitive for the team size.
3. **Envelope encryption with KMS** - Ideal but Cloudflare does not
   offer a native KMS; using AWS KMS from Workers adds latency.

## Consequences

- **Positive**: PHI is encrypted before it leaves the browser; R2 stores
  only ciphertext; key rotation is documented and scripted.
- **Negative**: Client-side encryption adds ~50ms per file upload;
  key loss without backup means permanent data loss.
- **Risk**: Developers must use `buildUploadKey()` and the encryption
  helpers consistently; missing encryption is caught by code review
  and the upload route's magic-byte validation.
