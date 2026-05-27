"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-billing";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

function FormatLimit({ value, unlimitedLabel }: { value: number; unlimitedLabel: string }) {
  return <>{value === -1 ? unlimitedLabel : String(value)}</>;
}

const faqKeys: readonly { q: TranslationKey; a: TranslationKey }[] = [
  { q: "pricing.faq1Q", a: "pricing.faq1A" },
  { q: "pricing.faq2Q", a: "pricing.faq2A" },
  { q: "pricing.faq3Q", a: "pricing.faq3A" },
  { q: "pricing.faq4Q", a: "pricing.faq4A" },
];

const ROW_LABELS = [
  { label: "M\u00E9decins", key: "maxDoctors" as const },
  { label: "Patients", key: "maxPatients" as const },
  { label: "RDV / mois", key: "maxAppointmentsPerMonth" as const },
] as const;

/**
 * Editorial pricing page \u2014 4 columns \u00D7 1 row at desktop, 1 column stacked at mobile.
 * No "Most Popular" pill. Professional column has a 2px left rule in --oltigo-green.
 * Check icon at --ink, never green. Em-dash for absent. No "\u2717".
 * Below: 4-question FAQ accordion with hairlines.
 */
export function EditorialPricingContent() {
  const { t } = useLandingLocale();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ backgroundColor: "var(--bone)", color: "var(--ink)" }}>
      {/* Header */}
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingTop: "var(--space-9)",
          paddingBottom: "var(--space-7)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-h1)",
            lineHeight: "var(--lh-h1)",
            letterSpacing: "var(--ls-h1)",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {t("pricing.title")}
        </h1>
        <p
          className="mt-[var(--space-3)]"
          style={{
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: "var(--ink-70)",
            maxWidth: "720px",
          }}
        >
          {t("pricing.subtitle")}
        </p>
      </div>

      {/* Plan columns */}
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBottom: "var(--space-9)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPro = plan.id === "professional";
            return (
              <div
                key={plan.id}
                className="flex flex-col"
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: "var(--radius-landing)",
                  borderLeft: isPro ? "2px solid var(--oltigo-green)" : undefined,
                  padding: "var(--space-5)",
                }}
              >
                {/* Plan name + price */}
                <h3
                  style={{
                    fontSize: "var(--text-h3)",
                    lineHeight: "var(--lh-h3)",
                    letterSpacing: "var(--ls-h3)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {plan.name}
                </h3>
                <div className="mt-[var(--space-3)]">
                  <span
                    style={{
                      fontSize: "var(--text-h2)",
                      lineHeight: "var(--lh-h2)",
                      letterSpacing: "var(--ls-h2)",
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {plan.priceMonthly === 0
                      ? t("pricing.free")
                      : `${plan.priceMonthly}`}
                  </span>
                  {plan.priceMonthly > 0 && (
                    <span
                      className="ms-[var(--space-1)]"
                      style={{
                        fontSize: "var(--text-small)",
                        color: "var(--ink-60)",
                      }}
                    >
                      {`${plan.currency}${t("pricing.perMonth")}`}
                    </span>
                  )}
                </div>
                {plan.priceYearly > 0 && (
                  <p
                    className="mt-[var(--space-1)]"
                    style={{
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      lineHeight: "var(--lh-mono)",
                      color: "var(--ink-60)",
                    }}
                  >
                    {`${plan.priceYearly} ${plan.currency}${t("pricing.perYear")}`}
                  </p>
                )}

                <HairlineRule className="my-[var(--space-4)]" />

                {/* Limits */}
                <div className="flex-1 space-y-[var(--space-2)]">
                  {ROW_LABELS.map(({ label, key }) => {
                    const val = plan[key];
                    return (
                      <p
                        key={key}
                        style={{
                          fontSize: "var(--text-body)",
                          lineHeight: "var(--lh-body)",
                          color: "var(--ink-70)",
                        }}
                      >
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                          <FormatLimit value={val} unlimitedLabel={t("pricing.unlimited")} />
                        </span>
                        {` ${label}`}
                      </p>
                    );
                  })}

                  {/* Features */}
                  <ul className="mt-[var(--space-4)] list-none space-y-[var(--space-2)] p-0">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-[var(--space-2)]"
                        style={{
                          fontSize: "var(--text-small)",
                          lineHeight: "var(--lh-small)",
                          color: "var(--ink-70)",
                        }}
                      >
                        <Check
                          size={16}
                          strokeWidth={1.5}
                          className="mt-0.5 shrink-0"
                          style={{ color: "var(--ink)" }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <Link
                  href={plan.id === "enterprise" ? "/contact" : "/register-clinic"}
                  className="mt-[var(--space-5)] inline-flex items-center justify-center"
                  style={{
                    height: "44px",
                    borderRadius: "var(--radius-landing)",
                    fontSize: "var(--text-small)",
                    fontWeight: 500,
                    textDecoration: "none",
                    transitionDuration: "var(--duration)",
                    transitionTimingFunction: "var(--easing)",
                    ...(plan.id === "free"
                      ? {
                          backgroundColor: "var(--bone)",
                          color: "var(--ink)",
                          border: "1px solid var(--ink)",
                        }
                      : {
                          backgroundColor: "var(--oltigo-green)",
                          color: "var(--bone)",
                        }),
                  }}
                >
                  {plan.id === "enterprise"
                    ? t("pricing.ctaContact")
                    : plan.id === "free"
                      ? t("pricing.ctaFree")
                      : t("pricing.ctaChoose")}
                </Link>
              </div>
            );
          })}
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {/* FAQ */}
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingBottom: "var(--space-9)",
        }}
      >
        <h2
          style={{
            fontSize: "var(--text-h2)",
            lineHeight: "var(--lh-h2)",
            letterSpacing: "var(--ls-h2)",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: "var(--space-7)",
          }}
        >
          {t("pricing.faqTitle")}
        </h2>

        {faqKeys.map(({ q, a }, idx) => (
          <div key={q}>
            <HairlineRule />
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              className="flex w-full items-center justify-between py-[var(--space-5)]"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--lh-body)",
                fontWeight: 500,
                fontFamily: "var(--font-sans-landing)",
                textAlign: "start",
              }}
              aria-expanded={openFaq === idx}
            >
              <span>{t(q)}</span>
              <ChevronDown
                size={20}
                strokeWidth={1.5}
                className="shrink-0 transition-transform"
                style={{
                  transform: openFaq === idx ? "rotate(180deg)" : "rotate(0deg)",
                  transitionDuration: "var(--duration)",
                  color: "var(--ink-60)",
                }}
              />
            </button>
            {openFaq === idx && (
              <p
                className="pb-[var(--space-5)]"
                style={{
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--lh-body)",
                  color: "var(--ink-70)",
                  maxWidth: "720px",
                }}
              >
                {t(a)}
              </p>
            )}
          </div>
        ))}
        <HairlineRule />
      </div>
    </div>
  );
}
