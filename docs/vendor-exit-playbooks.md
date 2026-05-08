# Vendor Exit Playbooks

> **Audit finding:** A172 | **Last updated:** April 2026

Each Tier-1 vendor has a one-page exit playbook covering export, alternative,
IP ownership, and data-return drill schedule.

---

## 1. Supabase (PostgreSQL + Auth)

**Risk:** Single point of failure for database, authentication, and RLS.

### Export Procedure

```bash
# Full logical dump (already runs nightly via .github/workflows/backup.yml)
pg_dump --no-owner --no-acl --clean --if-exists "$SUPABASE_DB_URL" \
  | gzip > "backup_$(date +%Y%m%d).sql.gz"

# Auth user export (Supabase Management API)
curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://$SUPABASE_PROJECT_REF.supabase.co/auth/v1/admin/users" \
  > auth_users_export.json
```

### Alternative Provider

| Option | Effort | Notes |
|--------|--------|-------|
| **Neon** (serverless Postgres) | Medium | Compatible wire protocol; RLS policies portable |
| **Self-hosted Postgres** (on Railway / Render / bare VM) | High | Full control; must replicate Auth + RLS |
| **PlanetScale** (MySQL) | Very High | Schema rewrite required; last resort |

### IP Ownership

- All application code is owned by Oltigo Health (private repo).
- Supabase stores no proprietary IP beyond data.
- MSA clause reference: Supabase Terms of Service, Section 6 ("Your Content").

### Data Return / Destruction

- Supabase provides data export via dashboard and `pg_dump`.
- On project deletion, Supabase destroys data within 30 days per their DPA.
- Confirm destruction in writing by emailing `privacy@supabase.com`.

### Annual Drill

- [ ] Restore nightly backup to a separate Postgres instance (already tested via `restore-test.yml`)
- [ ] Verify Auth users can be re-imported
- [ ] Document any gaps found

---

## 2. Cloudflare (Workers + R2 + KV + CDN)

**Risk:** Highest vendor concentration -- compute, storage, CDN, DNS, and KV all in one provider.

### Export Procedure

```bash
# R2 objects (already replicated every 6h via .github/workflows/r2-replication.yml)
aws s3 sync "s3://${R2_BUCKET}" ./r2-export/ \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# KV namespace export
wrangler kv:key list --namespace-id "$KV_NAMESPACE_ID" | \
  jq -r '.[].name' | while read key; do
    wrangler kv:key get --namespace-id "$KV_NAMESPACE_ID" "$key" > "kv-export/$key"
  done

# Workers code is in the repo (no export needed)
# DNS zone export
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/export" \
  > dns_zone_export.txt
```

### Alternative Provider

| Component | Alternative | Effort |
|-----------|------------|--------|
| **Workers** (compute) | Vercel Edge Functions, AWS Lambda@Edge, Deno Deploy | Medium (OpenNext adapter swap) |
| **R2** (object storage) | AWS S3, GCS, Backblaze B2 | Low (S3-compatible API) |
| **KV** (key-value) | Upstash Redis, DynamoDB | Low (small dataset) |
| **CDN** | Fastly, AWS CloudFront, Vercel | Medium |
| **DNS** | AWS Route 53, Google Cloud DNS | Low |

### IP Ownership

- Workers code lives in the repo; Cloudflare holds no proprietary IP.
- MSA clause reference: Cloudflare Self-Serve Subscription Agreement, Section 6.

### Data Return / Destruction

- R2 objects are S3-compatible; export with any S3 client.
- KV data is ephemeral (rate-limit counters, feature flags); loss is tolerable.
- DNS zone is exportable via API (BIND format).
- On account closure, Cloudflare deletes all data within 30 days per DPA.

### Annual Drill

- [ ] Verify R2 replication to secondary bucket is current (check last sync timestamp)
- [ ] Export DNS zone and compare to expected records
- [ ] Test deploying the app to Vercel (alternative) using `next start` (non-Workers mode)
- [ ] Document any gaps found

---

## 3. Resend (Transactional Email)

**Risk:** Tier 3, but email is a critical notification channel.

### Export Procedure

- No persistent data to export (Resend does not store email content long-term).
- API keys are in GitHub Secrets.

### Alternative Provider

| Option | Effort | Notes |
|--------|--------|-------|
| **AWS SES** | Low | Change SMTP/API endpoint in `src/lib/email-templates.ts` |
| **Postmark** | Low | Similar REST API |
| **SendGrid** | Low | Similar REST API |

### Switch Procedure

1. Sign up for alternative provider.
2. Verify domain (SPF, DKIM).
3. Update `RESEND_API_KEY` and email sending code in `src/lib/email-templates.ts`.
4. Update SPF record (remove `include:send.resend.com`, add new provider).
5. Test email delivery.

---

## 4. Meta / WhatsApp (Business API)

**Risk:** Tier 2; primary patient notification channel in Morocco.

### Export Procedure

- Message templates are documented in `docs/whatsapp-template-approval.md`.
- No message content is stored by Meta beyond delivery.

### Alternative Provider

| Option | Effort | Notes |
|--------|--------|-------|
| **Twilio** (already integrated as fallback) | Low | `src/lib/sms.ts` already supports Twilio |
| **MessageBird** | Medium | New SDK integration |
| **Direct SMS via local provider** | Medium | Moroccan SMS aggregator |

### Switch Procedure

1. Activate Twilio as primary in notification config.
2. Re-register WhatsApp templates with Twilio (if using Twilio WhatsApp).
3. Update webhook endpoints.
4. Update `META_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN` references.

---

## Review Schedule

| Vendor | Last Drill | Next Drill | Owner |
|--------|-----------|------------|-------|
| Supabase | _Not yet_ | Q3 2026 | Platform lead |
| Cloudflare | _Not yet_ | Q3 2026 | Platform lead |
| Resend | _Not yet_ | Q4 2026 | Platform lead |
| Meta/WhatsApp | _Not yet_ | Q4 2026 | Platform lead |

## Related Documents

- [Data Residency & Sub-Processors](./data-residency.md)
- [Backup & Recovery Runbook](./backup-recovery-runbook.md)
- [SOP: Secret Rotation](./SOP-SECRET-ROTATION.md)
