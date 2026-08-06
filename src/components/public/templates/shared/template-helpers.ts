import type { ClinicBranding } from "@/lib/data/public";
import { defaultWebsiteConfig } from "@/lib/website-config";

export interface HeroOverrides {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export function getHeroOverrides(branding: ClinicBranding): HeroOverrides {
  const websiteHero = (
    branding.websiteConfig as { hero?: { title?: string; subtitle?: string } } | null
  )?.hero;
  return {
    title: websiteHero?.title ?? branding.clinicName,
    subtitle: (websiteHero?.subtitle ?? branding.tagline) || undefined,
    imageUrl: branding.heroImageUrl ?? branding.coverPhotoUrl ?? undefined,
  };
}

export function getFaqFromBranding(branding: ClinicBranding) {
  const websiteFaq = (
    branding.websiteConfig as {
      faq?: { title?: string; subtitle?: string; items?: { q: string; a: string }[] };
    } | null
  )?.faq;
  return {
    title: websiteFaq?.title ?? defaultWebsiteConfig.faq.title,
    subtitle: websiteFaq?.subtitle ?? defaultWebsiteConfig.faq.subtitle,
    items: websiteFaq?.items ?? defaultWebsiteConfig.faq.items,
  };
}
