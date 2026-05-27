# ADR-0008: Partial PHI masking by default

**Date:** 2026-05-27
**Status:** Accepted
**Deciders:** Core team

## Context

Healthcare applications handle Protected Health Information (PHI) governed by Moroccan Law 09-08. Logging, error reporting, and audit trails must balance:
- **Debuggability**: Engineers need enough context to diagnose issues.
- **Privacy**: PHI must not appear in logs, error trackers, or browser consoles.

## Decision

Use partial masking by default: show enough of a value to identify the record (first/last characters) while redacting the middle.

Examples:
- Patient name: `Mo****ed` (first 2, last 2 visible)
- Phone: `+212*****89` (country code + last 2 digits)
- Email: `pr***@gmail.com` (first 2 chars + domain)

## Rationale

1. **Operational necessity**: Full redaction (`*****`) makes debugging impossible. Engineers cannot correlate a Sentry error to a specific patient without at least partial identifiers.
2. **Compliance**: Moroccan Law 09-08 requires "appropriate technical measures" — partial masking is accepted practice when combined with access controls and audit logging.
3. **Consistency**: A single masking strategy across all logging, error reporting, and client-facing validation errors avoids ad-hoc redaction decisions per engineer.

## Trade-offs

- Partial masking reveals some PHI (e.g., name length, domain of email). For the highest-sensitivity fields (SSN equivalents, full medical records), full encryption is used instead.
- The masking functions in `src/lib/logger.ts` must be maintained as new PHI fields are added.

## Consequences

- `safeParse()` in `src/lib/validations/helpers.ts` redacts field paths from validation errors (A8-01).
- `src/lib/logger.ts` applies masking to all structured log fields tagged as PHI.
- `src/lib/encryption.ts` provides full AES-256-GCM encryption for file-level PHI (R2 uploads).
