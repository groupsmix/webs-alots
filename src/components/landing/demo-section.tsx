"use client";

import { ArrowRight } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

/**
 * Demo section — clean screenshot frame, no browser chrome mockup.
 *
 * Eyebrow: 03 — DEMO
 * A single screenshot of demo.oltigo.com rendered at 1:1, framed by a 1px hairline.
 * Caption below in mono. Single text link "View live site ->" in Oltigo Green.
 */
export function DemoSection() {
  const { t } = useLandingLocale();

  return (
    <section
      id="demo"
      className="py-[var(--space-9)] md:py-[var(--space-10)]"
      style={{ backgroundColor: "var(--bone)" }}
    >
      <div
        className="mx-auto px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* Eyebrow + heading */}
        {/* eslint-disable-next-line i18next/no-literal-string -- section numbering is not translatable */}
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--ink-60)",
            textTransform: "uppercase",
            marginBottom: "var(--space-4)",
          }}
        >
          03 &mdash; {t("landing.demoLabel")}
        </p>
        <h2
          style={{
            fontSize: "var(--text-h2)",
            lineHeight: "var(--lh-h2)",
            letterSpacing: "var(--ls-h2)",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {t("landing.demoTitle")}
        </h2>
        <p
          className="mt-[var(--space-3)]"
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            letterSpacing: "var(--ls-body-lg)",
            color: "var(--ink-70)",
          }}
        >
          {t("landing.demoSubtitle")}
        </p>

        {/* Screenshot frame */}
        <div
          className="mt-[var(--space-8)]"
          style={{
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-landing)",
            overflow: "hidden",
            backgroundColor: "var(--bone)",
          }}
        >
          {/* Placeholder for real screenshot — rendered as a styled block */}
          <div
            className="flex items-center justify-center"
            style={{
              minHeight: "400px",
              backgroundColor: "var(--bone-2)",
            }}
          >
            {/* eslint-disable-next-line i18next/no-literal-string -- domain name is not translatable */}
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-small)",
                color: "var(--ink-60)",
              }}
            >
              demo.oltigo.com
            </p>
          </div>
        </div>

        {/* Caption */}
        {/* eslint-disable-next-line i18next/no-literal-string -- domain name is not translatable */}
        <p
          className="mt-[var(--space-3)]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono)",
            lineHeight: "var(--lh-mono)",
            color: "var(--ink-60)",
          }}
        >
          demo.oltigo.com &middot; {t("landing.demoLastRefreshed" as TranslationKey)}
        </p>

        {/* View live site link */}
        <ExternalLink
          href="https://demo.oltigo.com"
          className="mt-[var(--space-4)] inline-flex items-center gap-[var(--space-2)] transition-colors"
          style={{
            fontSize: "var(--text-body)",
            fontWeight: 500,
            color: "var(--oltigo-green)",
            transitionDuration: "var(--duration)",
          }}
        >
          {t("landing.demoViewSite")}
          <ArrowRight className="h-4 w-4" />
        </ExternalLink>
      </div>
    </section>
  );
}
