"use client";

import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

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
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export function PublicHeader({
  logoUrl,
  clinicName,
  sectionVisibility,
  phone,
  email,
  address,
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const navLinks = getNavLinks(sectionVisibility);
  const hasContact = phone || email || address;

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Top contact bar — phone-only on very small screens, full row on sm+ */}
      {hasContact && (
        <div className="bg-primary text-primary-foreground py-1.5 text-xs">
          <div className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 sm:justify-end">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 hover:underline truncate max-w-[60vw] sm:max-w-none"
              >
                <Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{phone}</span>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="hidden sm:inline-flex items-center gap-1.5 hover:underline"
              >
                <Mail className="h-3 w-3" aria-hidden="true" />
                {email}
              </a>
            )}
            {address && (
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main nav */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg sm:text-xl font-bold text-foreground min-w-0"
          >
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={displayName}
                width={36}
                height={36}
                className="h-8 sm:h-9 w-auto flex-shrink-0"
              />
            )}
            <span className="truncate">{displayName}</span>
          </Link>

          {/* Desktop navigation */}
          <nav
            aria-label={t(locale, "public.navMain")}
            className="hidden items-center gap-6 md:flex"
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`text-sm transition-colors ${
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(locale, link.labelKey)}
                </Link>
              );
            })}
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {t(locale, "public.doctorSpace")}
            </Link>
            <Link href="/book" className={buttonVariants({ size: "sm" })}>
              {t(locale, "public.patientSpace")}
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={
              mobileMenuOpen ? t(locale, "public.closeMenu") : t(locale, "public.openMenu")
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="clinic-mobile-nav"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav
          id="clinic-mobile-nav"
          aria-label={t(locale, "public.navMobile")}
          className="border-b border-border bg-background/95 backdrop-blur px-4 py-4 md:hidden max-h-[calc(100dvh-8rem)] overflow-y-auto"
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`text-sm min-h-11 flex items-center ${
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t(locale, link.labelKey)}
                </Link>
              );
            })}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", className: "w-full" })}
              >
                {t(locale, "public.doctorSpace")}
              </Link>
              <Link href="/book" className={buttonVariants({ className: "w-full" })}>
                {t(locale, "public.patientSpace")}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
