BEGIN;

CREATE TABLE IF NOT EXISTS public.seed_user_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NULL,
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'well_known_seed_account',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seed_user_blocklist_email_not_blank CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS seed_user_blocklist_auth_id_idx
  ON public.seed_user_blocklist (auth_id)
  WHERE auth_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS seed_user_blocklist_email_lower_idx
  ON public.seed_user_blocklist (lower(email));

ALTER TABLE public.seed_user_blocklist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.seed_user_blocklist FROM anon;
REVOKE ALL ON public.seed_user_blocklist FROM authenticated;

INSERT INTO public.seed_user_blocklist (auth_id, email, reason)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'super@oltigo.test', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@demo-clinic.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000003', 'doctor@demo-clinic.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000004', 'reception@demo-clinic.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000010', 'fatima.m@gmail.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000011', 'hassan.b@gmail.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000012', 'khadija.a@gmail.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000013', 'omar.f@gmail.com', 'well_known_seed_account'),
  ('a0000000-0000-0000-0000-000000000014', 'youssef.t@gmail.com', 'well_known_seed_account')
ON CONFLICT DO NOTHING;

COMMIT;
