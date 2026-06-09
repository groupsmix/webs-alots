-- ============================================================
-- Migration 00171: Database-level reserved / malformed subdomain guard
--
-- AUDIT F-2
-- ---------
-- Self-service registration (`/api/v1/register-clinic`), the request
-- resolver (`extractSubdomain`), and the public sitemap now all share one
-- blocklist (`src/lib/reserved-subdomains.ts`). This migration adds the same
-- rule at the database layer so that NO code path — super-admin onboarding,
-- a future endpoint, a manual SQL insert, or a seed — can create a clinic on
-- a reserved (admin, api, www, staging, …) or structurally invalid subdomain.
--
-- DESIGN
-- ------
-- A BEFORE INSERT OR UPDATE trigger (NOT a CHECK constraint) is used on
-- purpose: a CHECK is validated against existing rows when added, which would
-- fail the migration if any pre-existing reserved row (e.g. a stray `admin`
-- clinic) is already present. The trigger only validates rows as they are
-- inserted or when `subdomain` actually changes, so historical rows are left
-- untouched and can be cleaned up as a separate, deliberate data operation.
--
-- Operational tenants `demo` and `test` are explicitly allowed — `demo` backs
-- the public demo site (https://demo.oltigo.com).
--
-- KEEP IN SYNC: the reserved set and slug rules below mirror
-- `src/lib/reserved-subdomains.ts`. If you change one, change the other.
-- ============================================================

-- ------------------------------------------------------------
-- is_reserved_subdomain(slug): true when the slug must never be a tenant.
-- IMMUTABLE + no table access so it is safe to call from a trigger / CHECK.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_reserved_subdomain(slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(slug, '')) = ANY (ARRAY[
    -- Infrastructure / DNS
    'www','api','app','cdn','assets','static','media','uploads','files','img',
    'images','ns1','ns2','ns3','mx','mail','email','smtp','imap','pop','pop3',
    'ftp','sftp','vpn','proxy','gateway','edge','origin','host','server',
    -- Environments (demo/test intentionally excluded — operational tenants)
    'staging','stage','dev','develop','development','preview','sandbox','qa',
    'uat','prod','production',
    -- Platform / brand
    'oltigo','root','system','internal','console','panel','portal','platform','core',
    -- Auth / security
    'admin','administrator','superadmin','super-admin','auth','oauth','sso',
    'login','logout','signin','sign-in','signup','sign-up','register','account',
    'accounts','secure','security','password','reset','verify','verification',
    -- Product surfaces
    'dashboard','support','help','helpdesk','docs','documentation','blog','news',
    'status','about','contact','pricing','billing','pay','payment','payments',
    'checkout','invoice','invoices','webhook','webhooks','callback','callbacks',
    'cron','jobs','queue',
    -- Observability / tooling
    'sentry','grafana','metrics','monitoring','logs','git','ci','cd',
    -- Generic role / medical words
    'staff','team','doctor','doctors','patient','patients','pharmacy','pharmacist',
    'receptionist','nurse','clinic','clinics','cabinet','medical','health','sante',
    'hopital','hospital'
  ]);
$$;

COMMENT ON FUNCTION public.is_reserved_subdomain(text) IS
  'AUDIT F-2: true when a subdomain is reserved (infra/security/brand/role). '
  'Mirrors src/lib/reserved-subdomains.ts. demo/test are NOT reserved.';

-- ------------------------------------------------------------
-- Trigger: reject reserved or structurally invalid subdomains on write.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_clinic_subdomain_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v text;
BEGIN
  -- Nothing to validate when there is no subdomain.
  IF NEW.subdomain IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only validate when the subdomain actually changes so we never
  -- retroactively break a grandfathered row that is updated for other reasons.
  IF TG_OP = 'UPDATE' AND NEW.subdomain IS NOT DISTINCT FROM OLD.subdomain THEN
    RETURN NEW;
  END IF;

  v := lower(NEW.subdomain);

  -- Operational tenants are always allowed (demo backs the public demo site).
  IF v IN ('demo', 'test') THEN
    RETURN NEW;
  END IF;

  -- Reserved words are never allowed.
  IF public.is_reserved_subdomain(v) THEN
    RAISE EXCEPTION 'Subdomain "%" is reserved and cannot be used.', NEW.subdomain
      USING ERRCODE = 'check_violation';
  END IF;

  -- Structural rules (mirror isValidSubdomainSlug):
  --   length 3..40, lowercase, no punycode, no consecutive hyphens,
  --   start/end alphanumeric, hyphens only in the middle.
  IF char_length(v) < 3 OR char_length(v) > 40
     OR NEW.subdomain <> v                  -- must already be lowercase
     OR v LIKE '%xn--%'                      -- no punycode / IDN homographs
     OR v LIKE '%--%'                        -- no consecutive hyphens
     OR v !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'  -- RFC 1123 host label
  THEN
    RAISE EXCEPTION 'Subdomain "%" is not a valid tenant slug.', NEW.subdomain
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_clinic_subdomain_guard ON public.clinics;
CREATE TRIGGER trg_enforce_clinic_subdomain_guard
  BEFORE INSERT OR UPDATE OF subdomain ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_clinic_subdomain_guard();

COMMENT ON FUNCTION public.enforce_clinic_subdomain_guard() IS
  'AUDIT F-2: BEFORE INSERT/UPDATE guard rejecting reserved or malformed '
  'clinic subdomains at the DB layer. See migration 00171.';
