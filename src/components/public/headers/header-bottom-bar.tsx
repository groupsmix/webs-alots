"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeaderProps } from "./index";

/**
 * Bottom-bar header — mobile-app style navigation at the bottom.
 *
 * On desktop, renders a minimal top bar with logo and CTA.
 * On mobile, renders a fixed bottom navigation bar.
 * Supports RTL and dark/light mode from template.
 */
export function HeaderBottomBar({ logoUrl, clinicName, navItems, template }: HeaderProps) {
  const [locale] = useLocale();
  const pathname = usePathname();
  const displayName = clinicName || "Oltigo";
  const isRtl = template?.rtl ?? false;

  // Show max 5 items in the bottom bar
  const bottomItems = navItems.slice(0, 5);

  return (
    <>
      {/* Top bar — logo + CTA (desktop & mobile) */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur" dir={isRtl ? "rtl" : undefined}>
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            {logoUrl && (
              <Image src={logoUrl} alt={displayName} width={28} height={28} className="h-7 w-auto" />
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
            <Link href="/book" className={buttonVariants({ size: "sm" })}>
              {t(locale, "public.bookAppointment")}
            </Link>
          </nav>

          {/* Mobile CTA */}
          <div className="md:hidden">
            <Link href="/book" className={buttonVariants({ size: "sm" })}>
              {t(locale, "public.bookAppointment")}
            </Link>
          </div>
        </div>
      </header>

      {/* Bottom navigation bar — mobile only */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur md:hidden"
        dir={isRtl ? "rtl" : undefined}
      >
        <div className="flex items-center justify-around h-14">
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 px-2 text-xs transition-colors ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
