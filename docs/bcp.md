# Business Continuity & Disaster Recovery Plan (BCP/DRP)

## 1. Objectives and Scope
This document outlines the disaster recovery strategy for the Oltigo Health platform, ensuring compliance with Moroccan Law 09-08 regarding the security and availability of Personal Health Information (PHI).

- **Recovery Time Objective (RTO):** 4 hours
- **Recovery Point Objective (RPO):** 1 hour

## 2. Infrastructure Backup Strategy

### Database (Supabase / PostgreSQL)
- **Point-in-Time Recovery (PITR):** Enabled on Supabase Pro/Enterprise plans, allowing restoration to any point within the last 7 days.
- **Daily Logical Backups:** Nightly `pg_dump` exported to Cloudflare R2 via cron job.
- **Audit Logs:** Daily exports to an R2 bucket configured with Object Lock (WORM) for 7 years.

### Storage (Cloudflare R2)
- R2 is distributed globally. We rely on Cloudflare's internal replication.
- Bucket versioning is enabled to recover from accidental deletions or ransomware encryption.

## 3. Incident Response & Communication
1. **Detection:** Alerts triggered via Sentry (SLO burn rate > 5) or Datadog.
2. **Triage:** Engineering team investigates to determine the severity (P0, P1, P2).
3. **Communication:**
   - **Internal:** `#incident-response` Slack channel.
   - **External:** Status page update within 30 minutes of a confirmed P0 incident.
   - **Regulatory:** If a data breach occurs, notify the CNDP (Morocco) within 72 hours as per Law 09-08.

## 4. Vendor Exit Playbooks

### Supabase Exit
If Supabase experiences a catastrophic failure or we need to migrate:
1. Provision a managed PostgreSQL database (e.g., AWS RDS or DigitalOcean).
2. Restore the latest `pg_dump` from R2.
3. Update environment variables (`NEXT_PUBLIC_SUPABASE_URL`) in Cloudflare Workers.

### Cloudflare Exit
If Cloudflare is unavailable:
1. Update DNS records at the registrar level to point to an alternative edge provider (e.g., Vercel, AWS CloudFront).
2. Deploy the Next.js application to the alternative provider using OpenNext.

### Stripe Exit
1. Rely on Stripe's PCI-compliant card data portability process to migrate to CMI or another payment processor.
2. Disable Stripe webhooks and activate the alternative processor in the application code.

## 5. Quarterly DR Drill
A disaster recovery drill must be performed every quarter:
- [ ] Attempt a full database restoration to a staging environment using PITR.
- [ ] Verify that encrypted PHI can still be decrypted using the KMS keys.
- [ ] Verify that audit logs in R2 are intact and cannot be deleted.
- [ ] Document drill results and update this BCP if gaps are found.
