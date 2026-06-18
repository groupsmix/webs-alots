"use client";

import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { Wordmark } from "./section-kit";

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
            <div className="mt-5 inline-flex items-center gap-2">
              <span className="size-1.5 animate-soft-pulse rounded-full bg-emerald" />
              <span className="telemetry text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                {dict.nav.status}
              </span>
            </div>
          </div>

          {dict.footer.columns.map((col) => (
            <div key={col.title}>
              <p className="telemetry text-[10.5px] uppercase tracking-[0.18em] text-text-muted">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#top"
                      className="text-[13.5px] text-text-secondary transition-colors hover:text-text"
                    >
                      {link}
                    </a>
                  </li>
                ))}
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
