import type { ClinicBranding } from "@/lib/data/public";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { templatePackages } from "@/lib/template-registry";
import type { TemplateDefinition } from "@/lib/templates";
import { TemplateFooter } from "./template-footer";
import { TemplateHeader } from "./template-header";

interface DefaultTemplateLayoutProps {
  children: React.ReactNode;
  branding: ClinicBranding;
  template: TemplateDefinition;
  locale: Locale;
}

const PUBLIC_NAV_LINKS: { href: string; labelKey: TranslationKey }[] = [
  { href: "/", labelKey: "public.home" },
  { href: "/services", labelKey: "public.services" },
  { href: "/about", labelKey: "public.about" },
  { href: "/how-to-book", labelKey: "public.appointments" },
  { href: "/location", labelKey: "public.locationHours" },
  { href: "/contact", labelKey: "public.contact" },
  { href: "/reviews", labelKey: "public.reviews" },
];

function buildNavItems(locale: Locale, sectionVisibility?: Record<string, boolean>) {
  const sectionKeyMap: Record<string, string> = {
    "/services": "services",
    "/about": "about",
    "/how-to-book": "appointments",
    "/location": "location",
    "/contact": "contact",
    "/reviews": "reviews",
  };

  return PUBLIC_NAV_LINKS.filter((link) => {
    const sectionKey = sectionKeyMap[link.href];
    if (!sectionKey) return true; // Always show Home
    return sectionVisibility?.[sectionKey] !== false;
  }).map((link) => ({
    href: link.href,
    label: t(locale, link.labelKey),
  }));
}

/**
 * Default public page shell used by the tenant public layouts.
 *
 * A template package can supply its own `Layout` to take complete control of
 * the shell; otherwise this component renders the template's chosen Header and
 * Footer (or legacy variant-based fallbacks) around the page content.
 */
export function DefaultTemplateLayout({
  children,
  branding,
  template,
  locale,
}: DefaultTemplateLayoutProps) {
  const pkg = templatePackages[template.id];

  if (pkg?.Layout) {
    return (
      <pkg.Layout branding={branding} template={template} locale={locale}>
        {children}
      </pkg.Layout>
    );
  }

  const navItems = buildNavItems(locale, branding.sectionVisibility);

  return (
    <>
      <TemplateHeader
        logoUrl={branding.logoUrl ?? null}
        clinicName={branding.clinicName}
        template={template}
        navItems={navItems}
        sectionVisibility={branding.sectionVisibility}
        phone={branding.phone}
        email={branding.email}
        address={branding.address}
      />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <TemplateFooter
        clinicName={branding.clinicName}
        template={template}
        phone={branding.phone}
        email={branding.email}
        address={branding.address}
        locale={locale}
      />
    </>
  );
}
