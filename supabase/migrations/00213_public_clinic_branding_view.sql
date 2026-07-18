-- =============================================================================
-- Migration 00213: Public clinic branding view for anonymous public sites
--
-- BUG: The public clinic homepage never rendered a clinic's chosen branding
-- (brand colors, fonts, template) — every tenant site fell back to the
-- built-in DEFAULT_BRANDING (modern template, default blue). Root cause:
--
--   src/lib/data/public.ts:fetchBrandingFromDb() reads clinic branding with a
--   cookie-free ANON Supabase client (inside a `use cache` block it cannot
--   read cookies). That read hits the `clinics` table directly and relies on
--   RLS. But `clinics` has NO anonymous SELECT policy — only
--   clinics_select_own (authenticated, id = get_user_clinic_id()),
--   admin_clinics_update and sa_clinics_all. So the anon read returns zero
--   rows and the code silently applies DEFAULT_BRANDING.
--
--   The sibling public reads DO work because their tables carry a safe
--   anon policy scoped to the x-clinic-id header ONLY for anonymous callers
--   (see services_select_public / reviews_select_public /
--   users_select_public_doctors: `auth.uid() IS NULL AND clinic_id =
--   get_request_clinic_id()`). `clinics` was simply never given an
--   equivalent public read path for branding.
--
-- DESIGN: We do NOT add an anon SELECT policy to the `clinics` base table.
-- Unlike services/reviews, `clinics` rows contain sensitive columns
-- (config, owner_email, owner_phone, whatsapp_*, tier, trial_*, ...). A
-- row-level anon policy would let a spoofed x-clinic-id header read ALL of
-- those columns. Instead we follow the established `public_clinic_directory`
-- pattern (migration 00068 S-07 / 00212): expose a NARROW, non-PHI view of
-- the branding columns only, running with security_invoker = off so it
-- bypasses `clinics` RLS via the view owner's privileges and relies on
-- GRANT SELECT TO anon.
--
-- The view exposes ONLY public-site branding + public contact fields, and a
-- sanitized `config` object limited to the phone/address/email fallback keys
-- the renderer needs — never the raw `config` blob.
--
-- Like public_clinic_directory, do NOT switch this view to
-- security_invoker = on — it would re-enforce `clinics` RLS and break public
-- branding again.
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS public_clinic_branding;

CREATE VIEW public_clinic_branding
WITH (security_invoker = off) AS
SELECT
  id,
  name,
  logo_url,
  favicon_url,
  primary_color,
  secondary_color,
  heading_font,
  body_font,
  hero_image_url,
  tagline,
  cover_photo_url,
  template_id,
  section_visibility,
  website_config,
  phone,
  address,
  owner_email,
  jsonb_build_object(
    'phone', config->>'phone',
    'address', config->>'address',
    'email', config->>'email'
  ) AS config
FROM clinics
WHERE status = 'active'
  AND deleted_at IS NULL;

GRANT SELECT ON public_clinic_branding TO anon;

COMMENT ON VIEW public_clinic_branding IS
  'Restricted, non-PHI subset of clinics branding exposed to anonymous '
  'callers for public-site rendering (colors, fonts, template, logo, public '
  'contact). Runs with security_invoker = off so it relies on GRANT SELECT '
  'TO anon instead of clinics RLS. The config column is sanitized to only '
  'phone/address/email. Do NOT switch to security_invoker = on — it breaks '
  'public branding (see migration 00212 for the equivalent directory case).';

COMMIT;
