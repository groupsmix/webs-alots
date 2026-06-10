-- AI auto-triage columns for support_tickets.
-- Phase D1: structured triage output from generateObject.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_urgency text
    CHECK (ai_urgency IS NULL OR ai_urgency IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_draft_reply text,
  ADD COLUMN IF NOT EXISTS ai_triage_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_confidence real;

COMMENT ON COLUMN public.support_tickets.ai_urgency
  IS 'AI-assigned urgency level with medical red-flag awareness.';

COMMENT ON COLUMN public.support_tickets.ai_tags
  IS 'AI-assigned tags from a fixed taxonomy for categorisation.';

COMMENT ON COLUMN public.support_tickets.ai_summary
  IS 'One-line AI-generated ticket summary.';

COMMENT ON COLUMN public.support_tickets.ai_draft_reply
  IS 'AI-generated draft reply in the patient language, editable by human before send.';

COMMENT ON COLUMN public.support_tickets.ai_triage_at
  IS 'Timestamp when auto-triage ran for this ticket.';

COMMENT ON COLUMN public.support_tickets.ai_confidence
  IS 'AI confidence score 0..1 for the triage decision.';

CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_urgency
  ON public.support_tickets(clinic_id, ai_urgency)
  WHERE ai_urgency IS NOT NULL;
