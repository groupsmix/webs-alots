-- SEC-011: CMI callback replay protection.
--
-- Stripe has built-in idempotency via event IDs, but the CMI (Centre
-- Monetique Interbancaire) callback path has no documented replay
-- protection. This table stores seen transaction IDs so the webhook
-- handler can reject duplicates with ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS cmi_callbacks_seen (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  transaction_id  text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cmi_callback UNIQUE (clinic_id, transaction_id)
);

-- RLS: tenant isolation
ALTER TABLE cmi_callbacks_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY cmi_callbacks_tenant_isolation ON cmi_callbacks_seen
  USING (clinic_id = current_setting('app.clinic_id', true)::uuid);

-- TTL hint: rows older than 90 days can be purged by a cron job
COMMENT ON TABLE cmi_callbacks_seen IS 'SEC-011: CMI webhook replay protection — reject duplicate transaction_id per clinic';
