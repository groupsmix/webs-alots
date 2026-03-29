-- ============================================================
-- Notification Queue for Reliable Message Delivery
--
-- Replaces fire-and-forget WhatsApp/SMS sends with a persistent
-- queue that supports retry with exponential backoff.
--
-- Messages are inserted as "pending", processed by a cron job,
-- and retried on failure up to max_attempts times.
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email')),
  recipient     text NOT NULL,            -- phone number or email address
  body          text NOT NULL,
  trigger_type  text NOT NULL,            -- e.g. 'booking_confirmation', 'cancellation'
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  metadata      jsonb DEFAULT '{}',       -- recipient_id, appointment_id, etc.
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for the cron processor: fetch pending/retryable items ordered by next_retry_at
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue (next_retry_at ASC)
  WHERE status IN ('pending', 'processing');

-- Index for per-clinic notification history queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_clinic
  ON notification_queue (clinic_id, created_at DESC);

-- Index for dead-letter monitoring
CREATE INDEX IF NOT EXISTS idx_notification_queue_dead_letter
  ON notification_queue (status)
  WHERE status = 'dead_letter';

-- RLS: only service-role and clinic admins can read their own clinic's queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_queue_select_own_clinic ON notification_queue
  FOR SELECT USING (
    clinic_id::text = coalesce(
      current_setting('request.headers', true)::json->>'x-tenant-clinic-id',
      ''
    )
  );

-- Service-role (cron jobs) can do everything via BYPASSRLS on the service key.
-- No INSERT/UPDATE/DELETE policies needed for regular users — the queue is
-- written to exclusively by server-side code using the service-role key.

COMMENT ON TABLE notification_queue IS 'Persistent queue for outbound notifications with retry support';
COMMENT ON COLUMN notification_queue.next_retry_at IS 'When to next attempt delivery (exponential backoff)';
COMMENT ON COLUMN notification_queue.status IS 'pending → processing → sent | failed → dead_letter after max_attempts';
