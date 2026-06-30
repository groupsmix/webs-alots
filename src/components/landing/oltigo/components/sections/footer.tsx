"use client";

import { useI18n } from "@/components/landing/oltigo/i18n/context";
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
  ["#features", "#features", "#features", "/pricing"],
  // 1 — Resources / Ressources / الموارد
  ["/api-docs", "/how-to-book", "/status", "/blog"],
  // 2 — Company / Entreprise / الشركة
  ["/about", "/contact", "/about", "/contact"],
  // 3 — Legal / Légal / قانوني
  ["/privacy", "/terms", "/privacy", "/sub-processors"],
];

/** On-page anchors stay client-side scroll links; real routes are nav links. */
function isAnchor(href: string): boolean {
  return href.startsWith("#");
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
            <a
              href="/status"
              className="mt-5 inline-flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <span className="size-1.5 animate-soft-pulse rounded-full bg-emerald" />
              <span className="telemetry text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                {dict.nav.status}
              </span>
            </a>
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
                      <a
                        href={href}
                        {...(isAnchor(href) ? {} : { rel: "noopener" })}
                        className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
                      >
                        {link}
                      </a>
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
          <p className="telemetry tracking-wide">{dict.footer.law}</p>
        </div>
      </div>
    </footer>
  );
}
