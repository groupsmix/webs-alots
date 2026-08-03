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
 * Top-sticky header — the default header variant.
 *
 * Fixed to the top of the viewport with a border and backdrop blur.
 * Includes responsive hamburger menu for mobile.
 * Switches to a premium, more spacious layout for the "premium" template.
 */
export function HeaderTopSticky({
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
  const isPremium = template?.id === "premium";

  return (
    <header className="sticky top-0 z-50" dir={isRtl ? "rtl" : undefined}>
      {hasContact && (
        <div
          className={cn(
            "text-xs sm:text-sm",
            isPremium
              ? "border-b border-border/40 bg-background py-2"
              : "bg-primary text-primary-foreground py-1.5",
          )}
        >
          <div className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 sm:justify-end">
            {phone && (
              <a
                href={`tel:${phone}`}
                className={cn(
                  "inline-flex items-center gap-1.5 hover:underline truncate max-w-[60vw] sm:max-w-none",
                  isPremium ? "text-muted-foreground" : "",
                )}
              >
                <Phone className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{phone}</span>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className={cn(
                  "hidden sm:inline-flex items-center gap-1.5 hover:underline",
                  isPremium ? "text-muted-foreground" : "",
                )}
              >
                <Mail className="h-3 w-3" aria-hidden="true" />
                {email}
              </a>
            )}
            {address && (
              <span
                className={cn(
                  "hidden sm:inline-flex items-center gap-1.5",
                  isPremium ? "text-muted-foreground" : "",
                )}
              >
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {address}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={cn("border-b bg-background/95 backdrop-blur", isPremium && "shadow-sm")}>
        <div
          className={cn(
            "container mx-auto flex items-center justify-between px-4",
            isPremium ? "h-18 sm:h-20" : "h-16",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 font-bold text-foreground min-w-0",
              isPremium ? "text-xl sm:text-2xl" : "text-lg sm:text-xl",
            )}
          >
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={displayName}
                width={isPremium ? 44 : 36}
                height={isPremium ? 44 : 36}
                className="h-8 sm:h-10 w-auto flex-shrink-0"
                priority
                sizes={isPremium ? "44px" : "36px"}
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
                    "text-sm transition-colors",
                    isPremium && "text-base",
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
                buttonVariants({ variant: isPremium ? "ghost" : "ghost", size: "default" }),
                isPremium && "hidden lg:inline-flex",
              )}
            >
              {t(locale, "public.doctorSpace")}
            </Link>
            <Link
              href="/book"
              className={cn(
                buttonVariants({ size: isPremium ? "lg" : "default" }),
                isPremium && "rounded-full px-6",
              )}
            >
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
                className={cn(buttonVariants({ className: "w-full" }), isPremium && "rounded-full")}
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
