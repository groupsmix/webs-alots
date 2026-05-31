/**
 * White-label branding configuration.
 *
 * Manages custom branding per clinic: logos, colors, domains,
 * email templates, and CSS overrides.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrandingConfig {
  clinicId: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customDomain: string | null;
  emailFromName: string | null;
  emailFooterText: string | null;
  faviconUrl: string | null;
  customCss: string | null;
}

export interface BrandingUpdateInput {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  customDomain?: string | null;
  emailFromName?: string | null;
  emailFooterText?: string | null;
  faviconUrl?: string | null;
  customCss?: string | null;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: Omit<BrandingConfig, "clinicId"> = {
  logoUrl: null,
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  accentColor: "#3b82f6",
  customDomain: null,
  emailFromName: null,
  emailFooterText: null,
  faviconUrl: null,
  customCss: null,
};

// ─── Implementation ──────────────────────────────────────────────────────────

export async function getBranding(
  supabase: SupabaseClient<Database>,
  clinicId: string,
): Promise<BrandingConfig> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("branding")
    .select("*")
    .eq("clinic_id", clinicId)
    .single();

  if (!data) {
    return { clinicId, ...DEFAULT_BRANDING };
  }

  const row = data as Record<string, unknown>;
  return {
    clinicId,
    logoUrl: (row.logo_url as string) ?? null,
    primaryColor: (row.primary_color as string) ?? DEFAULT_BRANDING.primaryColor,
    secondaryColor: (row.secondary_color as string) ?? DEFAULT_BRANDING.secondaryColor,
    accentColor: (row.accent_color as string) ?? DEFAULT_BRANDING.accentColor,
    customDomain: (row.custom_domain as string) ?? null,
    emailFromName: (row.email_from_name as string) ?? null,
    emailFooterText: (row.email_footer_text as string) ?? null,
    faviconUrl: (row.favicon_url as string) ?? null,
    customCss: (row.custom_css as string) ?? null,
  };
}

export async function upsertBranding(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  input: BrandingUpdateInput,
): Promise<BrandingConfig | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("branding")
    .upsert(
      {
        clinic_id: clinicId,
        logo_url: input.logoUrl,
        primary_color: input.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        secondary_color: input.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
        accent_color: input.accentColor ?? DEFAULT_BRANDING.accentColor,
        custom_domain: input.customDomain,
        email_from_name: input.emailFromName,
        email_footer_text: input.emailFooterText,
        favicon_url: input.faviconUrl,
        custom_css: input.customCss,
      },
      { onConflict: "clinic_id" },
    )
    .select()
    .single();

  if (error || !data) return null;

  return getBranding(supabase, clinicId);
}

export function generateCSSVariables(branding: BrandingConfig): string {
  return `:root {
  --brand-primary: ${branding.primaryColor};
  --brand-secondary: ${branding.secondaryColor};
  --brand-accent: ${branding.accentColor};
}`;
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

export function validateCustomDomain(domain: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    domain,
  );
}
