-- ============================================================
-- Migration 00173: Quarantine the known junk / test tenants from the audit
--
-- AUDIT F-2 (item 2 — "Sitemap still contains 25+ junk tenants")
-- -------------------------------------------------------------
-- Migration 00172 suspended clinics on RESERVED subdomains (admin, api, …).
-- These remaining slugs are NOT reserved words, so 00172 leaves them alone,
-- yet the audit explicitly enumerated them as keyboard-mash and test data that
-- should not appear in the public sitemap. We quarantine that exact, named set.
--
-- WHY AN EXPLICIT LIST (not a heuristic): suspending real user data on a
-- spelling guess is unacceptable. Going forward, new junk is blocked at the
-- source by the clinic-name quality gate (src/lib/validations/name-quality.ts);
-- this migration only cleans the specific historical rows the audit named, so
-- the operation is fully reviewable and auditable in version control.
--
-- REVERSIBLE: status is set to 'suspended', not deleted. Restore any row with
--   UPDATE public.clinics SET status = 'active' WHERE subdomain = '…';
-- IDEMPOTENT: already-suspended rows are skipped; re-running is a no-op.
--
-- The match is on the slug PREFIX before the random 6-char suffix that
-- generateSubdomain() appends (e.g. a tenant stored as 'fffffff-a1b2c3'),
-- anchored so 'staf' cannot also catch a legitimate 'staf-ford-clinic'.
-- ============================================================

DO $$
DECLARE
  -- Exact junk/test slugs called out in the 2026-06-09 audit.
  junk text[] := ARRAY[
    'ahhhhhe','fffffff','jgjjrjrj','abod','cabinite','kjook','vdsvv','rtqz',
    'staf','saara','aagmzzd','aagmzzdlp','aagmzzdlpok','ahmedlokf','ahmed151',
    'ahmed15153','azar','azarr','hq','test-clinic-devin','testclinic',
    'testclinic2','devin-test-clinic'
  ];
  v_count integer;
  v_list  text;
BEGIN
  -- Preview (shows in migration output).
  SELECT count(*), string_agg(subdomain, ', ' ORDER BY subdomain)
    INTO v_count, v_list
  FROM public.clinics c
  WHERE c.status <> 'suspended'
    AND c.subdomain IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(junk) AS j
      -- match the base slug or 'base-<suffix>' (random suffix from generateSubdomain)
      WHERE lower(c.subdomain) = j
         OR lower(c.subdomain) LIKE j || '-%'
    );

  IF v_count > 0 THEN
    RAISE NOTICE 'Migration 00173: suspending % known junk tenant(s): %', v_count, v_list;
  ELSE
    RAISE NOTICE 'Migration 00173: no known junk tenants present — nothing to do.';
  END IF;

  UPDATE public.clinics c
  SET status = 'suspended',
      updated_at = now()
  WHERE c.status <> 'suspended'
    AND c.subdomain IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(junk) AS j
      WHERE lower(c.subdomain) = j
         OR lower(c.subdomain) LIKE j || '-%'
    );
END $$;
