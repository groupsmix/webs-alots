-- ============================================================
-- Migration 00172: Quarantine clinics squatting on reserved subdomains
--
-- AUDIT F-2 (follow-up to 00171)
-- -----------------------------
-- Migration 00171 added a BEFORE INSERT/UPDATE trigger that PREVENTS new
-- clinics on a reserved subdomain (admin, api, www, …) but deliberately left
-- pre-existing rows untouched ("…can be cleaned up as a separate, deliberate
-- data operation"). This is that operation.
--
-- The live audit found `admin.oltigo.com` still resolving. Rather than DELETE
-- (irreversible, and may cascade into appointments / patients / payments via
-- FK), we QUARANTINE: set status = 'suspended'. Effects:
--   • Drops out of the public sitemap immediately — sitemap.ts only emits
--     clinics with status = 'active'.
--   • Drops out of any active-clinic listing / RLS "active clinics" reads.
-- Request resolution already refuses reserved subdomains in code
-- (src/lib/subdomain.ts) and at the DB layer (00171), so suspending is enough
-- to stop a reserved subdomain from being served as a tenant.
--
-- REVERSIBLE: a clinic mistakenly caught here can be restored with
--   UPDATE public.clinics SET status = 'active' WHERE id = '…';
--
-- IDEMPOTENT: rows already suspended are skipped, so re-running is a no-op.
--
-- SCOPE: only rows whose subdomain is a RESERVED word (is_reserved_subdomain,
-- defined in 00171). It does NOT touch random low-quality slugs (e.g.
-- 'ahhhhhe') — those are not reserved and need human review (see the audit's
-- sitemap-activity-filter note). The operational tenants demo/test are never
-- reserved and are explicitly excluded.
--
-- NOTE: This only quarantines the DATABASE row. Removing the wildcard DNS /
-- Cloudflare route for `admin.oltigo.com` (so it stops returning 200 at the
-- edge) is a separate infrastructure step.
-- ============================================================

-- Log what we are about to quarantine so it shows in the migration output.
DO $$
DECLARE
  v_count integer;
  v_list  text;
BEGIN
  SELECT count(*), string_agg(subdomain, ', ' ORDER BY subdomain)
    INTO v_count, v_list
  FROM public.clinics
  WHERE subdomain IS NOT NULL
    AND status <> 'suspended'
    AND lower(subdomain) NOT IN ('demo', 'test')
    AND public.is_reserved_subdomain(subdomain);

  IF v_count > 0 THEN
    RAISE NOTICE 'Migration 00172: suspending % clinic(s) on reserved subdomains: %',
      v_count, v_list;
  ELSE
    RAISE NOTICE 'Migration 00172: no clinics on reserved subdomains — nothing to quarantine.';
  END IF;
END $$;

-- Only `status` (and its audit timestamp) change; `subdomain` is left intact so
-- the action is transparent and reversible, and so the 00171 "UPDATE OF
-- subdomain" guard trigger is not even engaged.
UPDATE public.clinics
SET status = 'suspended',
    updated_at = now()
WHERE subdomain IS NOT NULL
  AND status <> 'suspended'
  AND lower(subdomain) NOT IN ('demo', 'test')
  AND public.is_reserved_subdomain(subdomain);
