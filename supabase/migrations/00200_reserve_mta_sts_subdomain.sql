-- ============================================================
-- Migration 00200: Reserve the `mta-sts` subdomain
--
-- Follow-up to migration 00171 (AUDIT F-2) and the public/ folder audit.
--
-- WHY
-- ---
-- The MTA-STS policy (public/.well-known/mta-sts.txt) must be served from the
-- dedicated `mta-sts.<root-domain>` host. If a clinic could register the
-- `mta-sts` subdomain, the tenant resolver would intercept that host and the
-- mail-transport security policy would never be served — and the name could
-- be squatted. `mta-sts` is now added to the shared reserved blocklist in
-- `src/lib/reserved-subdomains.ts`; this migration mirrors that change at the
-- database layer so no code path (super-admin onboarding, a manual SQL insert,
-- a seed, or a future endpoint) can claim it.
--
-- This only re-creates the IMMUTABLE `is_reserved_subdomain(text)` helper with
-- `mta-sts` added to the Infrastructure / DNS group. The trigger from 00171
-- (`enforce_clinic_subdomain_guard`) already calls this function, so no
-- trigger changes are needed.
--
-- KEEP IN SYNC: the reserved set below mirrors
-- `src/lib/reserved-subdomains.ts`. If you change one, change the other.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_reserved_subdomain(slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(slug, '')) = ANY (ARRAY[
    -- Infrastructure / DNS
    'www','api','app','cdn','assets','static','media','uploads','files','img',
    'images','ns1','ns2','ns3','mx','mail','email','smtp','imap','pop','pop3',
    'mta-sts','ftp','sftp','vpn','proxy','gateway','edge','origin','host','server',
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
  'AUDIT F-2 (+ 00197): true when a subdomain is reserved (infra/security/'
  'brand/role, incl. mta-sts). Mirrors src/lib/reserved-subdomains.ts. '
  'demo/test are NOT reserved.';
