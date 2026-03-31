"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { useLocale } from "@/components/locale-switcher";
import { t, type TranslationKey } from "@/lib/i18n";

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

/**
 * Returns navigation links filtered by section visibility configuration.
 * Clinics can hide sections via sectionVisibility in their config/branding.
 */
function getNavLinks(sectionVisibility?: Record<string, boolean>): NavLink[] {
  if (!sectionVisibility) return defaultNavLinks;
  const sectionKeyMap: Record<string, string> = {
    "/services": "services",
    "/about": "about",
    "/how-to-book": "appointments",
    "/location": "location",
    "/contact": "contact",
    "/reviews": "reviews",
  };
  return defaultNavLinks.filter((link) => {
    const sectionKey = sectionKeyMap[link.href];
    if (!sectionKey) return true; // Always show Home
    return sectionVisibility[sectionKey] !== false;
  });
}

interface PublicHeaderProps {
  logoUrl?: string | null;
  clinicName?: string;
  sectionVisibility?: Record<string, boolean>;
}

export function PublicHeader({ logoUrl, clinicName, sectionVisibility }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const navLinks = getNavLinks(sectionVisibility);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          {logoUrl && (
            <Image src={logoUrl} alt={displayName} width={32} height={32} className="h-8 w-auto" />
          )}
          {displayName}
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(locale, link.labelKey)}
            </Link>
          ))}
          <Link href="/book" className={buttonVariants()}>
            {t(locale, "public.bookAppointment")}
          </Link>
        </nav>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-md hover:bg-muted transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? t(locale, "public.closeMenu") : t(locale, "public.openMenu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="clinic-mobile-nav"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav id="clinic-mobile-nav" aria-label="Navigation mobile" className="border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="text-sm text-muted-foreground min-h-11 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(locale, link.labelKey)}
              </Link>
            ))}
            <Link href="/book" className={buttonVariants({ className: "mt-2" })}>
              {t(locale, "public.bookAppointment")}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
