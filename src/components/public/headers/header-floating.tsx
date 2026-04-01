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
 * Floating header — centered floating nav with glass effect.
 *
 * A pill-shaped floating navigation bar centered in the viewport
 * with a frosted glass backdrop. Provides a modern, premium feel.
 * Supports RTL and dark/light mode from template.
 */
export function HeaderFloating({ logoUrl, clinicName, navItems, template }: HeaderProps) {
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
    <header className="fixed top-4 left-0 right-0 z-50" dir={isRtl ? "rtl" : undefined}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-full border bg-background/80 backdrop-blur-lg shadow-lg px-6 py-2">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              {logoUrl && (
                <Image src={logoUrl} alt={displayName} width={28} height={28} className="h-7 w-auto" />
              )}
              <span className="hidden sm:inline">{displayName}</span>
            </Link>

            {/* Desktop navigation */}
            <nav aria-label="Navigation principale" className="hidden items-center gap-4 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`text-sm transition-colors px-2 py-1 rounded-full ${
                    pathname === item.href
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/book" className={buttonVariants({ size: "sm", className: "rounded-full" })}>
                {t(locale, "public.bookAppointment")}
              </Link>
            </nav>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-full hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t(locale, "public.closeMenu") : t(locale, "public.openMenu")}
              aria-expanded={mobileMenuOpen}
              aria-controls="floating-mobile-nav"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile navigation — drops down below the floating bar */}
        {mobileMenuOpen && (
          <div className="mx-auto max-w-4xl mt-2">
            <nav
              id="floating-mobile-nav"
              aria-label="Navigation mobile"
              className="rounded-2xl border bg-background/95 backdrop-blur-lg shadow-lg px-4 py-4"
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className={`text-sm min-h-11 flex items-center px-3 rounded-lg transition-colors ${
                      pathname === item.href
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link href="/book" className={buttonVariants({ className: "mt-2 rounded-full" })}>
                  {t(locale, "public.bookAppointment")}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
