"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeaderProps } from "./index";

/**
 * Transparent header — overlays the hero section.
 *
 * Starts transparent over the hero image, then transitions to a
 * solid background with border when the user scrolls down.
 * Supports RTL and dark/light mode from template.
 */
export function HeaderTransparent({ logoUrl, clinicName, navItems, template }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const isRtl = template?.rtl ?? false;
  const isDark = template?.bgMode === "dark";

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  const headerBg = scrolled
    ? "bg-background/95 backdrop-blur border-b shadow-sm"
    : "bg-transparent";

  const textColor = scrolled
    ? "text-foreground"
    : isDark
      ? "text-white"
      : "text-white";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className={`flex items-center gap-2 text-xl font-bold transition-colors ${scrolled ? "text-foreground" : textColor}`}>
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
              className={`text-sm transition-colors hover:opacity-80 ${
                scrolled ? "text-muted-foreground hover:text-foreground" : `${textColor} hover:text-white/80`
              }`}
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
          className={`md:hidden flex items-center justify-center min-h-11 min-w-11 rounded-md transition-colors ${
            scrolled ? "hover:bg-muted" : "hover:bg-white/10"
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? t(locale, "public.closeMenu") : t(locale, "public.openMenu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="transparent-mobile-nav"
        >
          {mobileMenuOpen ? (
            <X size={24} className={scrolled ? "" : textColor} />
          ) : (
            <Menu size={24} className={scrolled ? "" : textColor} />
          )}
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav
          id="transparent-mobile-nav"
          aria-label="Navigation mobile"
          className="border-t bg-background/95 backdrop-blur px-4 py-4 md:hidden"
        >
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
