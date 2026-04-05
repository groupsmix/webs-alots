-- ============================================================
-- Migration 00066: Security Fixes Batch
--
-- Addresses remaining findings from the security audit:
--
-- HIGH-06:  Validate Stripe customer ownership in billing webhook
--           (application-level fix — no DB change needed, but we
--            add a helper index to speed up the lookup)
-- HIGH-08:  Validate tenant in check-in APIs
--           (application-level fix — index to support the lookup)
-- MED-02:   Add index on notification_log.message_id for
--           O(1) webhook deduplication lookups
-- MED-05:   Document SHA-256 backup code hashing limitation
--           (bcrypt migration tracked separately — requires
--            application-level change in mfa.ts)
-- ============================================================

-- ============================================================
-- MED-02: Index on notification_log.message_id
--
-- The WhatsApp webhook handler queries notification_log by
-- message_id to detect duplicate deliveries. Without an index
-- this is a full table scan that degrades as the table grows,
-- causing webhook timeouts and duplicate processing.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_log_message_id
  ON notification_log (message_id)
  WHERE message_id IS NOT NULL;

-- ============================================================
-- HIGH-06 / HIGH-08: Supporting indexes
--
-- Speed up the clinic ownership validation queries added in
-- the application layer for billing webhook and check-in APIs.
-- ============================================================

-- Index to speed up stripe_customer_id lookups in clinics.config JSONB
-- Used by billing webhook to verify customer ownership
CREATE INDEX IF NOT EXISTS idx_clinics_stripe_customer_id
  ON clinics ((config->>'stripe_customer_id'))
  WHERE config->>'stripe_customer_id' IS NOT NULL;

-- Index to speed up appointment ownership check in check-in confirm
-- (appointment_id + clinic_id lookup)
CREATE INDEX IF NOT EXISTS idx_appointments_id_clinic
  ON appointments (id, clinic_id);
