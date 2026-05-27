-- MEDIUM-2: Stripe webhook event deduplication.
--
-- Stripe retries webhook deliveries on failure. Without dedup, the same
-- event can re-run subscription state changes, double-bill, or re-send
-- notifications. This table provides idempotency at the webhook entry.
--
-- The handler inserts with ON CONFLICT (event_id) DO NOTHING — if the
-- insert succeeds, the event is new and should be processed; if it
-- conflicts, it's a retry and should be acknowledged without processing.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id    text PRIMARY KEY,
  event_type  text NOT NULL,
  clinic_id   uuid REFERENCES clinics(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Only admin/service-role should access this table (webhook context).
-- No user-facing queries needed.
CREATE POLICY processed_stripe_events_service_only ON processed_stripe_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- TTL hint: rows older than 90 days can be purged.
COMMENT ON TABLE processed_stripe_events IS 'MEDIUM-2: Stripe webhook event deduplication — reject duplicate event_id deliveries';
