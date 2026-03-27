"use client";

import Link from "next/link";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const links: readonly { key: TranslationKey; href: string }[] = [
  { key: "landing.footerAbout", href: "/about" },
  { key: "landing.footerPricing", href: "/pricing" },
  { key: "landing.footerContact", href: "/contact" },
  { key: "landing.footerLogin", href: "/login" },
  { key: "landing.footerPrivacy", href: "/privacy" },
];

export function LandingFooter() {
  const { t } = useLandingLocale();

  return (
    <footer className="border-t border-gray-100 bg-white py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-gray-900"
          >
            Oltigo
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-6">
            {links.map(({ key, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Oltigo. {t("landing.footerCopyright")}
        </div>
      </div>
    </footer>
  );
}
