# Notification Frequency Capping

> **Audience:** Engineering, product, compliance
> **Last updated:** May 2026
> **Related:** `src/app/api/cron/reminders/route.ts`, `docs/whatsapp-template-approval.md`

---

## Policy

Each patient may receive a maximum of **3 WhatsApp messages per 24-hour window** per clinic. This cap applies across all notification types (appointment reminders, confirmations, cancellations).

| Channel   | Per-patient cap | Window  | Enforcement point                      |
|-----------|----------------|---------|----------------------------------------|
| WhatsApp  | 3 messages     | 24 hours| `notification_log` dedup index + cron  |
| SMS       | 2 messages     | 24 hours| Same dedup index                       |
| Email     | 5 messages     | 24 hours| Application-level check                |
| In-app    | No cap         | —       | —                                      |

## How it works

1. The `notification_log` table has a partial unique index (`uq_notification_log_dedup`) that prevents duplicate sends for the same appointment/trigger/channel combination.
2. The reminders cron (`*/30 * * * *`) uses `upsert` with `ignoreDuplicates` to skip already-sent reminders.
3. The application layer checks the count of recent notifications for a patient before dispatching.

## WhatsApp-specific limits

Meta's WhatsApp Business API enforces its own rate limits:
- **1,000 unique contacts / 24h** for unverified business accounts
- **10,000 unique contacts / 24h** for verified accounts
- Template messages are rate-limited by Meta independently

Our frequency cap is **more conservative** than Meta's to avoid patient fatigue and comply with Moroccan consumer protection norms.

## Monitoring

- `notification_log` table tracks all sent/failed/delivered notifications
- Dashboard: Admin → Notifications → Delivery Stats
- Alerts: Sentry captures failed deliveries and rate-limit rejections

## Overrides

Clinics may request a cap increase via support. Changes require:
1. Documented business justification
2. DPO approval (patient consent review)
3. Configuration update in clinic settings
