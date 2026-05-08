"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeaderProps } from "./index";

/**
 * Top-sticky header — the default header variant.
 *
 * Fixed to the top of the viewport with a border and backdrop blur.
 * Includes responsive hamburger menu for mobile.
 */
export function HeaderTopSticky({ logoUrl, clinicName, navItems, template }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const isRtl = template?.rtl ?? false;

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" dir={isRtl ? "rtl" : undefined}>
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          {logoUrl && (
            <Image src={logoUrl} alt={displayName} width={32} height={32} className="h-8 w-auto" />
          )}
          {displayName}
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
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
          aria-controls="header-mobile-nav"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav id="header-mobile-nav" aria-label="Navigation mobile" className="border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className="text-sm text-muted-foreground min-h-11 flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
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
