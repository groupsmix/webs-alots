-- Migration: Provision chatbot_config rows for all existing clinics
--
-- Root cause: provisionChatbotForPlan() is only called via billing webhooks,
-- which never fired for clinics created before the chatbot system was built.
-- Result: every clinic defaulted to 'basic' keyword-only mode (or null = same).
--
-- Fix: Backfill chatbot_config for all clinics missing one.
-- Intelligence level mapping:
--   vitrine → basic  (showcase websites, keyword matching is sufficient)
--   pro/premium/saas → smart (Workers AI / Groq — real AI responses)

INSERT INTO chatbot_config (clinic_id, enabled, intelligence, greeting, language, created_at, updated_at)
SELECT
  c.id,
  true,
  CASE WHEN c.tier = 'vitrine' THEN 'basic' ELSE 'smart' END,
  'Bonjour ! Comment puis-je vous aider ?',
  'fr',
  now(),
  now()
FROM clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM chatbot_config cc WHERE cc.clinic_id = c.id
)
ON CONFLICT (clinic_id) DO NOTHING;

-- Also upgrade any existing 'basic' configs on non-vitrine clinics to 'smart'
UPDATE chatbot_config cc
SET intelligence = 'smart', updated_at = now()
FROM clinics c
WHERE cc.clinic_id = c.id
  AND c.tier NOT IN ('vitrine', 'free')
  AND cc.intelligence = 'basic';
