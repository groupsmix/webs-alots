"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HairlineRule } from "./hairline-rule";

/**
 * §3.1.9 Closing CTA — same compact pattern as hero top.
 * No second hero. Primary + ghost.
 */
export function ClosingCtaSection() {
  return (
    <section
      style={{
        backgroundColor: "var(--bone)",
        paddingBlock: "var(--space-9)",
      }}
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <HairlineRule />
        <div style={{ paddingBlock: "var(--space-7)", maxWidth: 720 }}>
          <h2
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-h1)",
              lineHeight: "var(--lh-h1)",
              letterSpacing: "var(--ls-h1)",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Prêt à simplifier votre cabinet&nbsp;?
          </h2>
          <p
            style={{
              marginTop: "var(--space-5)",
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--ink-70)",
            }}
          >
            Créez votre compte en 2 minutes. Aucune carte bancaire requise.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/register-clinic"
              className="group inline-flex items-center gap-2"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
                height: 44,
                paddingInline: 24,
                borderRadius: "var(--radius-landing)",
                backgroundColor: "var(--oltigo-green)",
                color: "var(--bone)",
                textDecoration: "none",
                transition: `opacity var(--duration) var(--easing)`,
              }}
            >
              Ouvrir un compte
              <ArrowRight
                style={{
                  width: 16,
                  height: 16,
                  transition: `transform var(--duration) var(--easing)`,
                }}
                className="group-hover:translate-x-0.5"
              />
            </Link>
            <a
              href="#contact"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-small)",
                fontWeight: 500,
                color: "var(--oltigo-green)",
                textDecoration: "none",
              }}
              className="hover:underline"
            >
              Parler aux ventes →
            </a>
          </div>
        </div>
        <HairlineRule />
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
