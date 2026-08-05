"use client";

import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { HeaderProps } from "./index";

/**
 * Premium top-sticky header.
 *
 * A more spacious, polished header used by the "premium" template.
 * Larger logo, subtle shadow, rounded CTA, and a cleaner contact bar.
 */
export function HeaderPremium({
  logoUrl,
  clinicName,
  navItems,
  template,
  phone,
  email,
  address,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const isRtl = template?.rtl ?? false;
  const hasContact = phone || email || address;

  return (
    <header className="sticky top-0 z-50" dir={isRtl ? "rtl" : undefined}>
      {hasContact && (
        <div className="border-b border-border/40 bg-background py-2 text-xs sm:text-sm">
          <div className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 sm:justify-end">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline truncate max-w-[60vw] sm:max-w-none"
              >
                <Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{phone}</span>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground hover:underline"
              >
                <Mail className="h-3 w-3" aria-hidden="true" />
                {email}
              </a>
            )}
            {address && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border-b bg-background/95 backdrop-blur shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 h-18 sm:h-20">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-foreground min-w-0 text-xl sm:text-2xl"
          >
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={displayName}
                width={44}
                height={44}
                className="h-8 sm:h-10 w-auto flex-shrink-0"
                priority
                sizes="44px"
              />
            )}
            <span className="truncate">{displayName}</span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-base transition-colors",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "default" }),
                "hidden lg:inline-flex",
              )}
            >
              {t(locale, "public.doctorSpace")}
            </Link>
            <Link href="/book" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
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
            aria-controls="header-mobile-nav"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav
          id="header-mobile-nav"
          aria-label="Navigation mobile"
          className="border-b border-border bg-background/95 backdrop-blur px-4 py-4 md:hidden max-h-[calc(100dvh-8rem)] overflow-y-auto"
        >
          <div className="flex flex-col gap-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-base min-h-11 flex items-center",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="grid grid-cols-1 gap-3 pt-2">
              <Link
                href="/login"
                className={buttonVariants({ variant: "outline", className: "w-full" })}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(locale, "public.doctorSpace")}
              </Link>
              <Link
                href="/book"
                className={cn(buttonVariants({ className: "w-full" }), "rounded-full")}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t(locale, "public.patientSpace")}
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
