# DSR Endpoint Design (A62)

**Status:** Draft RFC. Foundation module shipped in `src/lib/compliance/dsr-tables.ts`; endpoints not yet implemented.
**Scope:** GDPR Arts. 15–18 + 21 and Moroccan Law 09-08 art. 7 data-subject rights.
**Companion:** [`pii-column-inventory.md`](./pii-column-inventory.md) (data map) and [`retention.md`](./retention.md) (legal-obligation retention).

---

## 1. Endpoint surface

| Method | Path                | GDPR art. | Loi 09-08 art. | Auth              | Sync / Async | Idempotent |
| ------ | ------------------- | --------- | -------------- | ----------------- | ------------ | ---------- |
| `GET`  | `/api/dsr/access`   | 15        | 7              | session + re-auth | Async        | yes        |
| `POST` | `/api/dsr/rectify`  | 16        | 7              | session           | Sync         | no         |
| `POST` | `/api/dsr/erasure`  | 17        | 7              | session + re-auth | Async        | no         |
| `POST` | `/api/dsr/restrict` | 18        | 7              | session           | Sync         | yes        |
| `POST` | `/api/dsr/object`   | 21        | 7              | session           | Sync         | yes        |

All endpoints live under `/api/dsr/*` and use the existing auth + response helpers (`@/lib/api-auth`, `@/lib/api-response`, `@/lib/audit-log`).

---

## 2. Auth model

Every endpoint requires an authenticated Supabase session for the subject. The two destructive endpoints — `access` (exports everything) and `erasure` (deletes everything) — additionally require a **re-authentication step** within the last 5 minutes. This follows GDPR EDPB Guideline 01/2022 §3.1 on identity verification and protects against session hijacking on shared devices.

Re-auth is implemented as a short-lived `dsr_reauth` cookie set by `POST /api/dsr/reauth` (separate endpoint, accepts password). Endpoints check the cookie freshness server-side; missing or stale → `401` with `code: "dsr_reauth_required"`.

Staff cannot invoke DSR endpoints on behalf of a subject through these routes. A separate `/api/admin/dsr/*` surface (out of scope for this RFC) handles operator-mediated requests with stricter audit. Impersonation sessions are excluded by `requireSelf()` middleware.

---

## 3. Access (`GET /api/dsr/access`)

### Flow

1. Subject hits `GET /api/dsr/access` with valid session + `dsr_reauth` cookie.
2. Server enforces rate limit: **1 export per 24h per subject** via `RATE_LIMIT_KV` key `dsr-access:{userId}`. 429 with `Retry-After` if exceeded.
3. Server enqueues a job into `NOTIFICATION_QUEUE` with `trigger_type = "dsr_access_export"` and a freshly minted `export_id` (UUID).
4. Server writes a row into `consent_logs` with `event = "dsr_access_requested"`, `ip_address`, `user_agent`, `export_id`.
5. Server returns `202 Accepted` with `{ export_id, status: "queued" }` immediately.

A queue consumer (cron or queue worker, not part of this PR) does:

1. Loop `ALL_DSR_TABLES` filtered by `key`:
   - For each table, `SELECT * WHERE <key> = $userId`.
   - Skip 0-row tables to keep the archive small.
2. Pull subject row from `users`.
3. Enumerate R2 objects in `webs-alots-uploads` tagged with `patient_id = $userId`.
4. Pull Supabase Auth record via `auth.admin.getUserById`.
5. Pack everything into a deterministic JSON tree under `export.json` + a `files/` subtree referencing copies of the R2 objects.
6. ZIP the tree, AES-256-GCM encrypt with a per-export key derived from `PHI_ENCRYPTION_KEY` + `export_id`.
7. Upload to R2 at `dsr-exports/{userId}/{export_id}.zip` with a 30-day lifecycle rule (configured in `r2-lifecycle.json`).
8. Email the subject a one-time signed URL valid for 24h via Resend.
9. Write `consent_logs` row with `event = "dsr_access_delivered"` and `immutable_audit_log` row for the audit trail.

### Why async

Loops over ~93 tables and an unbounded number of R2 objects easily exceed the Cloudflare Workers 30-second CPU budget. The queue pattern matches `notification_queue` and reuses the consumer infrastructure already in `worker-cron-handler.ts`.

### Response shape (sync 202)

```json
{
  "export_id": "01HF...UUID",
  "status": "queued",
  "estimated_ready_seconds": 600,
  "rate_limit": { "remaining": 0, "reset_at": "2026-06-01T17:09:23Z" }
}
```

### Archive contents

```
export.zip
├── export.json
│   ├── meta:     { generated_at, export_id, subject: { id, auth_id } }
│   ├── identity: users row + supabase auth profile (masked password fields)
│   ├── tables:   { <table_name>: [rows...] }      // ordered by ALL_DSR_TABLES
│   ├── article9: { core_phi: [...], mental_health: [...], ... }  // duplicated reference for ease of review
│   └── files:    [{ object_key, sha256, ref: "files/<name>" }]
└── files/
    ├── <prescription_id>.pdf
    └── ...
```

---

## 4. Rectification (`POST /api/dsr/rectify`)

Sync. Accepts a JSON patch limited to `USER_RECTIFICATION_ALLOWED_COLUMNS` from the typed module (`name`, `phone`, `email`). Anything else → `400 invalid_field`.

Validation:

- `email` change requires a verification challenge — write to `email_verifications`, send link via Resend, do not update `users.email` until verified.
- `phone` change requires SMS-OTP via Twilio.
- `name` is updated in place and added to a maintained `name_change_log` (separate from `audit_logs`) for fraud-prevention review.

Clinical fields (`date_of_birth`, `address` if used for clinical context, diagnosis, notes, prescription content) are intentionally excluded — Art. 16 grants the right to "rectify inaccurate data", but determining clinical accuracy is a doctor's call. Subjects can dispute via `POST /api/dsr/object` instead.

---

## 5. Erasure (`POST /api/dsr/erasure`)

Async. Two-phase to ensure no clinical data is lost mid-treatment.

### Phase 1 — request

1. Re-auth check.
2. Active-care guard: refuse if subject has a `medical_records` row newer than 30 days or an `appointments` row with `status IN ('confirmed','in_progress')` in the future. Response `409 active_care` with the conflicting record IDs. Treating clinician can lift the block via `/api/admin/dsr/*` (out of scope).
3. Enqueue erasure job; write `consent_logs` row with `event = "dsr_erasure_requested"`.
4. Return `202 Accepted` with `{ erasure_id, scheduled_for }`. Scheduled time is **30 days out** to honour the GDPR "without undue delay" with a sane reversibility buffer — subjects can cancel in that window via `DELETE /api/dsr/erasure/{erasure_id}`.

### Phase 2 — execution (cron)

At the scheduled time, the cron worker:

1. Re-checks the active-care guard. Abort + notify if violated.
2. For each table in `ALL_DSR_TABLES`:
   - If table ∈ `ERASURE_ANONYMISE_INSTEAD` → `UPDATE` row, setting the subject FK to `TOMBSTONE_USER_SENTINEL` and nulling free-text columns (`notes`, `diagnosis`, `content`).
   - Otherwise → `DELETE` the row. RLS already cascades from `users` ON DELETE CASCADE for most tables (see `00029_multitenant_security_hardening.sql`).
3. R2: list + delete all objects tagged `patient_id = $userId` from `webs-alots-uploads`.
4. Cloudflare Auth: `auth.admin.deleteUser(auth_id)`.
5. Final `immutable_audit_log` entry with the full table-level erasure manifest (counts only, no PII).
6. The subject's email is added to `dsr_erasure_complete` notification queue (single email confirming completion, then permanently dropped).

### Tombstone sentinel

`TOMBSTONE_USER_SENTINEL` = `00000000-0000-0000-0000-000000000000`. A migration (not in this PR) inserts a single `users` row with this id + `role = 'tombstone'` + permanent RLS deny. All FKs that point to anonymised rows reference it. RLS hides tombstone rows from every API surface.

---

## 6. Restriction (`POST /api/dsr/restrict`) and Objection (`POST /api/dsr/object`)

Both write to `processing_consents` — no schema change needed.

- `restrict` sets `processing_consents.restricted_until = $until_date` (or `null` for indefinite). Sync, idempotent. Effect: API surfaces check this flag and freeze processing except for legal-obligation flows.
- `object` sets `processing_consents.opted_out_of = ARRAY['marketing','profiling',...]`. Sync, idempotent. Marketing channels and the AI manager check this flag.

Both write `consent_logs` for audit.

---

## 7. Audit trail (every endpoint)

Every DSR endpoint writes:

1. `consent_logs` — subject-visible event log, queryable from `/api/dsr/access`.
2. `immutable_audit_log` — append-only, integrity-checked, retained 2y per `retention.md`. Includes `ip_address`, `user_agent`, `endpoint`, `result`, `correlation_id`.

The audit trail is itself in the access export (subjects can see when they were exported / erased).

---

## 8. Rate limiting + abuse

| Endpoint                 | Limit                                 |
| ------------------------ | ------------------------------------- |
| `GET /api/dsr/access`    | 1 / 24h per user                      |
| `POST /api/dsr/rectify`  | 10 / 24h per user                     |
| `POST /api/dsr/erasure`  | 1 / 30d per user (one cancel allowed) |
| `POST /api/dsr/restrict` | 20 / 24h per user                     |
| `POST /api/dsr/object`   | 20 / 24h per user                     |

Backed by `RATE_LIMIT_KV` with the existing `rate-limit.ts` helper.

---

## 9. Export retention

DSR-access archives live in `webs-alots-uploads` under `dsr-exports/{userId}/`. A lifecycle rule (`r2-lifecycle.json`, follow-up PR) expires them at **30 days**. Signed URLs are valid for **24h** and one-time; expired URLs return 404 without exposing whether the object existed.

The signed-URL email goes to the subject's verified email only (never to a freshly rectified email — Art. 32 integrity).

---

## 10. Out of scope for this RFC

- Operator-mediated DSR (`/api/admin/dsr/*`) — separate surface.
- DPIA refresh — tracked as A61-OPEN-7 in `pii-column-inventory.md`.
- AI processor pseudonymisation SOP — tracked as A61-OPEN-2.
- EU AI Act applicability — tracked as A61-OPEN-1.
- Tombstone migration — tracked as a separate PR after this design is approved.

---

## 11. Open decisions

1. **Re-auth UX.** Cookie freshness window — 5 minutes is conservative. EDPB guidance allows up to 15. Pick one.
2. **Erasure delay.** 30-day reversibility buffer — GDPR doesn't mandate this, but it's defensible practice. Pick a number (0, 7, 14, 30).
3. **Export delivery channel.** Email-only vs in-app download vs both. Email-only is simplest but requires a verified email.
4. **Per-clinic policy override.** Clinics with stricter retention rules (e.g. specific specialty boards) may want shorter export windows. Defer or implement now?

Decisions land in this doc as a §12 changelog once made.
