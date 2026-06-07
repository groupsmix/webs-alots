-- Support ticket SLA tracking columns.
-- Adds sla_target_hours, sla_breached, first_response_at to support_tickets
-- so the SLA breach cron can track and flag overdue tickets.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS sla_target_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

COMMENT ON COLUMN public.support_tickets.sla_target_hours
  IS 'Maximum hours allowed before ticket is considered SLA-breached. Default 24h.';

COMMENT ON COLUMN public.support_tickets.sla_breached
  IS 'True when the ticket has exceeded sla_target_hours without resolution.';

COMMENT ON COLUMN public.support_tickets.first_response_at
  IS 'Timestamp of the first staff/admin response message on this ticket.';

CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_breached
  ON public.support_tickets(clinic_id, sla_breached)
  WHERE sla_breached = false;
