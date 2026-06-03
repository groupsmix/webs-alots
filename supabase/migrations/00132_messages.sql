-- Patient-doctor secure messaging.
-- Supports threading, read receipts, and attachment references.

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  thread_id UUID,
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id),
  subject TEXT,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  attachment_keys TEXT[], -- R2 object keys for attached files
  parent_message_id UUID REFERENCES messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_clinic_thread
  ON messages (clinic_id, thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread
  ON messages (recipient_id, is_read, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages (sender_id, created_at DESC);

-- RLS: users can only see messages in their clinic where they are sender or recipient
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_own ON messages
  FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
  );

CREATE POLICY messages_insert_own ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY messages_update_read ON messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Thread ID auto-generation trigger
CREATE OR REPLACE FUNCTION set_message_thread_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NULL AND NEW.parent_message_id IS NULL THEN
    NEW.thread_id := NEW.id;
  ELSIF NEW.thread_id IS NULL AND NEW.parent_message_id IS NOT NULL THEN
    SELECT thread_id INTO NEW.thread_id FROM messages WHERE id = NEW.parent_message_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_message_thread_id
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_thread_id();
