"use client";

import { useLocale } from "@/components/locale-switcher";
import { HEADER_COMPONENTS } from "@/components/public/headers";
import { t, type TranslationKey } from "@/lib/i18n";
import type { TemplateDefinition, HeaderVariant } from "@/lib/templates";

interface NavLink {
  href: string;
  labelKey: TranslationKey;
}

const defaultNavLinks: NavLink[] = [
  { href: "/", labelKey: "public.home" },
  { href: "/services", labelKey: "public.services" },
  { href: "/about", labelKey: "public.about" },
  { href: "/how-to-book", labelKey: "public.appointments" },
  { href: "/location", labelKey: "public.locationHours" },
  { href: "/contact", labelKey: "public.contact" },
  { href: "/reviews", labelKey: "public.reviews" },
];

interface DynamicHeaderProps {
  logoUrl: string | null;
  clinicName: string;
  headerVariant: HeaderVariant;
  template: TemplateDefinition;
}

/**
 * Client component that dynamically selects the right header variant
 * based on the clinic's template configuration.
 *
 * Converts translation keys to localized labels and passes
 * them to the selected header component.
 */
export function DynamicHeader({ logoUrl, clinicName, headerVariant, template }: DynamicHeaderProps) {
  const [locale] = useLocale();

  const navItems = defaultNavLinks.map((link) => ({
    label: t(locale, link.labelKey),
    href: link.href,
  }));

  const HeaderComponent = HEADER_COMPONENTS[headerVariant] ?? HEADER_COMPONENTS["top-sticky"];

  return (
    <HeaderComponent
      logoUrl={logoUrl}
      clinicName={clinicName}
      navItems={navItems}
      template={template}
    />
  );
}
