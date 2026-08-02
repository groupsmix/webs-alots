"use client";

import { Mail, MapPin, Phone, Shield } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { defaultWebsiteConfig } from "@/lib/website-config";
import { Wordmark } from "./section-kit";

/**
 * Destination matrix for the footer link columns.
 *
 * The localized dictionaries (`dict.footer.columns`) keep the link *labels*
 * only — translations stay a flat string list so the i18n coverage gate is
 * untouched. Destinations are locale-independent and parallel by position:
 * `FOOTER_HREFS[columnIndex][linkIndex]` lines up 1:1 with
 * `dict.footer.columns[columnIndex].links[linkIndex]` across FR / AR / EN.
 *
 * Every href points at a route that actually exists (verified against the
 * App Router tree) or an on-page section anchor. No link resolves to "#top".
 * For a Loi 09-08 product the Legal column in particular must reach real,
 * reviewable Privacy / Terms / Security pages.
 */
const FOOTER_HREFS: string[][] = [
  // 0 — Product / Produit / المنتج
  ["/#appointments", "/#records", "/#whatsapp", "/pricing"],
  // 1 — Resources / Ressources / الموارد
  ["/api-docs", "/how-to-book", "/status", "/blog"],
  // 2 — Company / Entreprise / الشركة
  // Carrières / Partenaires fall back to About / Contact until dedicated pages exist.
  ["/about", "/contact", "/about", "/contact"],
  // 3 — Legal / Légal / قانوني
  // Labels (parallel by position): Confidentialité · Conditions · Loi 09-08 · Sécurité
  // "Sécurité" points at the RFC 9116 security policy file.
  ["/privacy", "/terms", "/sub-processors", "/.well-known/security.txt"],
];

/** On-page anchors and real routes use Next.js client navigation.
 *  The security.txt file is a static text asset, so it stays a plain anchor.
 */
function isAnchor(href: string): boolean {
  return href.startsWith("#");
}

function isStaticAsset(href: string): boolean {
  return href.startsWith("/.well-known/");
}

function isExternal(href: string): boolean {
  return href.startsWith("/status");
}

export function Footer() {
  const { dict } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="relative">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Wordmark className="text-base" />
            <p className="mt-4 text-[13.5px] leading-relaxed text-text-secondary">
              {dict.footer.tagline}
            </p>
            <Link
              href="/status"
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <span className="size-1.5 animate-soft-pulse rounded-full bg-emerald" />
              <span className="telemetry text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                {dict.nav.status}
              </span>
            </Link>
            <div className="mt-5 space-y-1.5">
              <a
                href={`tel:${defaultWebsiteConfig.contact.phone.replace(/\s|-/g, "")}`}
                className="flex items-center gap-2 text-[12.5px] text-text-secondary transition-colors hover:text-text"
              >
                <Phone className="size-3.5 text-text-muted" aria-hidden="true" />
                {defaultWebsiteConfig.contact.phone}
              </a>
              <a
                href={`mailto:${defaultWebsiteConfig.contact.email}`}
                className="flex items-center gap-2 text-[12.5px] text-text-secondary transition-colors hover:text-text"
              >
                <Mail className="size-3.5 text-text-muted" aria-hidden="true" />
                {defaultWebsiteConfig.contact.email}
              </a>
              <p className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                <MapPin className="size-3.5 text-text-muted" aria-hidden="true" />
                {defaultWebsiteConfig.contact.address}
              </p>
            </div>
          </div>

          {dict.footer.columns.map((col, colIndex) => (
            <div key={col.title}>
              <p className="telemetry text-[10.5px] uppercase tracking-[0.18em] text-text-muted">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link, linkIndex) => {
                  const href = FOOTER_HREFS[colIndex]?.[linkIndex] ?? "/";
                  return (
                    <li key={link}>
                      {isStaticAsset(href) ? (
                        <a
                          href={href}
                          rel="noopener"
                          target="_blank"
                          className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
                        >
                          {link}
                        </a>
                      ) : (
                        <Link
                          href={href}
                          {...(isAnchor(href) ? {} : { rel: "noopener" })}
                          {...(isExternal(href) ? { target: "_blank", rel: "noopener" } : {})}
                          className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
                        >
                          {link}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-hairline pt-6 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} OLTIGO. {dict.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/40 px-2.5 py-1 text-text-secondary">
              <Shield className="size-3.5 text-emerald" aria-hidden="true" />
              {dict.footer.cndp}
            </span>
            <p className="telemetry tracking-wide">{dict.footer.law}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
