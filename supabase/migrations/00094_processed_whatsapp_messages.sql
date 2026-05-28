-- R-16: WhatsApp message idempotency table.
-- Prevents duplicate processing when Meta retries webhook deliveries.
-- Same pattern as processed_stripe_events (00092) and cmi_callbacks_seen (00084).
-- Rows older than 90 days are purged by /api/cron/dedup-purge (see worker-cron-handler.ts).

CREATE TABLE IF NOT EXISTS processed_whatsapp_messages (
  message_id TEXT PRIMARY KEY,
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE processed_whatsapp_messages IS
  'Idempotency guard for WhatsApp webhook deliveries (R-16). Insert-on-conflict before processing.';

-- RLS: only the owning clinic can read its own rows.
ALTER TABLE processed_whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view own processed messages"
  ON processed_whatsapp_messages
  FOR SELECT
  USING (
    clinic_id = COALESCE(
      get_user_clinic_id(),
      get_request_clinic_id()
    )
  );

-- Service-role (cron cleanup, admin) bypasses RLS.

-- Index for TTL purge cron (dedup-purge route deletes rows older than retention).
CREATE INDEX IF NOT EXISTS idx_processed_whatsapp_messages_processed_at
  ON processed_whatsapp_messages (processed_at);
