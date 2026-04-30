# Chain of Custody Template (A187)

Use this template for each piece of digital evidence collected during an incident
or legal hold. One entry per evidence item. Append rows to the custody log as the
item changes hands.

---

## Evidence Item Record

| Field | Value |
|-------|-------|
| **Evidence ID** | [INCIDENT-ID]-[SEQUENCE: 001, 002, ...] |
| **Description** | [e.g., "PostgreSQL logical dump of clinic abc123 activity_logs, 2026-01-01 to 2026-04-30"] |
| **Source system** | [e.g., Supabase PostgreSQL, Cloudflare R2, Workers Logpush] |
| **Collection method** | [e.g., `pg_dump --format=custom`, R2 API download, Logpush S3 export] |
| **Collection timestamp (UTC)** | [YYYY-MM-DD HH:MM:SS] |
| **Collected by** | [Name, Role] |
| **Hash algorithm** | SHA-256 |
| **Hash value** | [sha256sum output] |
| **Storage location** | [e.g., "legal-hold-evidence R2 bucket, key: /incident-2026-042/001-activity-logs.dump"] |
| **Encryption** | [e.g., "AES-256-GCM, key stored in 1Password vault 'Legal Hold Keys'"] |
| **Access restrictions** | [e.g., "Legal Counsel + IC only; R2 bucket policy attached"] |

---

## Custody Transfer Log

| # | Date (UTC) | From (Name, Role) | To (Name, Role) | Purpose | Method | Integrity verified? |
|---|------------|-------------------|-----------------|---------|--------|-------------------|
| 1 | [DATE] | [COLLECTOR] | [STORAGE] | Initial collection | [METHOD] | Yes — hash matches |
| 2 | [DATE] | [STORAGE] | [FORENSIC_ANALYST] | Analysis | Encrypted transfer | Yes — hash matches |
| 3 | | | | | | |

---

## Integrity Verification Command

```bash
# Generate hash at collection time
sha256sum evidence-file.dump > evidence-file.dump.sha256

# Verify hash at each transfer
sha256sum -c evidence-file.dump.sha256
```

## Notes

- Never modify the original evidence. Work on copies.
- Re-verify the hash after every transfer or access.
- If the hash does not match, stop and notify Legal Counsel immediately.
- Store this completed template alongside the evidence item.
