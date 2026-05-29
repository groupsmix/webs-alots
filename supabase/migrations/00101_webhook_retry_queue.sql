-- Migration: 00101_webhook_retry_queue
-- Creates a retry queue for failed webhook processing

CREATE TABLE IF NOT EXISTS webhook_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient polling of pending items
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_pending
  ON webhook_retry_queue (next_retry_at)
  WHERE status = 'pending';

-- Index for clinic-scoped queries
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_clinic
  ON webhook_retry_queue (clinic_id);

-- Enable RLS
ALTER TABLE webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy scoped to clinic_id (service role bypasses RLS for cron)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webhook_retry_queue'
      AND policyname = 'webhook_retry_queue_clinic_isolation'
  ) THEN
    CREATE POLICY webhook_retry_queue_clinic_isolation
      ON webhook_retry_queue
      FOR ALL
      USING (clinic_id = get_user_clinic_id() AND is_clinic_staff());
  END IF;
END $$;
