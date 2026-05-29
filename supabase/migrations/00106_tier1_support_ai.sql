-- Tier 1 Support AI: Enhanced FAQs, WhatsApp support, support tickets, multi-language

-- ── Enhanced FAQ System ──────────────────────────────────────────────
-- Adds category, language, and search vector columns to existing chatbot_faqs.

ALTER TABLE chatbot_faqs
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_category
  ON chatbot_faqs(clinic_id, category);

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_language
  ON chatbot_faqs(clinic_id, language);

CREATE INDEX IF NOT EXISTS idx_chatbot_faqs_search_vector
  ON chatbot_faqs USING GIN(search_vector);

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_faq_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.question, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.keywords, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faq_search_vector ON chatbot_faqs;
CREATE TRIGGER trg_faq_search_vector
  BEFORE INSERT OR UPDATE ON chatbot_faqs
  FOR EACH ROW EXECUTE FUNCTION update_faq_search_vector();

-- ── Support Tickets ──────────────────────────────────────────────────
-- Tracks patient support requests across all channels (WhatsApp, chat, etc.)

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_phone text,
  patient_name text,
  channel text NOT NULL DEFAULT 'chat' CHECK (channel IN ('chat', 'whatsapp', 'email', 'phone')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject text NOT NULL,
  language text DEFAULT 'fr',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  satisfaction_rating integer CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5)),
  satisfaction_comment text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_clinic_id
  ON support_tickets(clinic_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_channel
  ON support_tickets(clinic_id, channel);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to
  ON support_tickets(clinic_id, assigned_to);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at
  ON support_tickets(clinic_id, created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_tickets'
      AND policyname = 'support_tickets_clinic_isolation'
  ) THEN
    CREATE POLICY support_tickets_clinic_isolation
      ON support_tickets
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- ── Support Messages ─────────────────────────────────────────────────
-- Individual messages within a support ticket (conversation thread).

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('patient', 'staff', 'bot')),
  sender_id text,
  content text NOT NULL,
  language text DEFAULT 'fr',
  is_auto_reply boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id
  ON support_messages(ticket_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_messages_clinic_id
  ON support_messages(clinic_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_messages'
      AND policyname = 'support_messages_clinic_isolation'
  ) THEN
    CREATE POLICY support_messages_clinic_isolation
      ON support_messages
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- ── WhatsApp Support Sessions ────────────────────────────────────────
-- Maps WhatsApp conversations to support tickets for auto-response tracking.

CREATE TABLE IF NOT EXISTS whatsapp_support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  wa_message_id text,
  session_status text NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'escalated', 'closed')),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  auto_responses_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_support_sessions_clinic_phone
  ON whatsapp_support_sessions(clinic_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_support_sessions_ticket
  ON whatsapp_support_sessions(ticket_id);

ALTER TABLE whatsapp_support_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'whatsapp_support_sessions'
      AND policyname = 'whatsapp_support_sessions_clinic_isolation'
  ) THEN
    CREATE POLICY whatsapp_support_sessions_clinic_isolation
      ON whatsapp_support_sessions
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- ── Support Metrics (materialized for dashboard) ─────────────────────
-- Stores daily aggregated support metrics per clinic for fast dashboard queries.

CREATE TABLE IF NOT EXISTS support_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  date date NOT NULL,
  total_tickets integer DEFAULT 0,
  open_tickets integer DEFAULT 0,
  resolved_tickets integer DEFAULT 0,
  avg_response_time_minutes numeric DEFAULT 0,
  avg_resolution_time_minutes numeric DEFAULT 0,
  avg_satisfaction numeric DEFAULT 0,
  tickets_by_channel jsonb DEFAULT '{}',
  tickets_by_language jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_metrics_clinic_date
  ON support_metrics(clinic_id, date);

ALTER TABLE support_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'support_metrics'
      AND policyname = 'support_metrics_clinic_isolation'
  ) THEN
    CREATE POLICY support_metrics_clinic_isolation
      ON support_metrics
      FOR ALL
      USING (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      )
      WITH CHECK (
        clinic_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'clinic_id')::uuid
      );
  END IF;
END
$$;

-- ── Update updated_at trigger for support_tickets ────────────────────
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated_at ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();
