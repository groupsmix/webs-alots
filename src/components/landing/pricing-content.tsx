"use client";

import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-billing";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

function FormatLimit({
  value,
  unlimitedLabel,
}: {
  value: number;
  unlimitedLabel: string;
}) {
  return <>{value === -1 ? unlimitedLabel : String(value)}</>;
}

const faqKeys: readonly { q: TranslationKey; a: TranslationKey }[] = [
  { q: "pricing.faq1Q", a: "pricing.faq1A" },
  { q: "pricing.faq2Q", a: "pricing.faq2A" },
  { q: "pricing.faq3Q", a: "pricing.faq3A" },
  { q: "pricing.faq4Q", a: "pricing.faq4A" },
];

export function PricingContent() {
  const { t } = useLandingLocale();

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 text-center sm:px-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
          {t("pricing.label")}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t("pricing.subtitle")}
        </p>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isPopular = plan.id === "professional";
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  isPopular
                    ? "border-blue-600 shadow-lg shadow-blue-600/10 ring-1 ring-blue-600"
                    : "border-gray-200"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    {t("pricing.popular")}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {plan.name}
                  </h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      {plan.priceMonthly === 0
                        ? t("pricing.free")
                        : `${plan.priceMonthly}`}
                    </span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-sm text-gray-500">
                        {plan.currency}{t("pricing.perMonth")}
                      </span>
                    )}
                  </div>
                  {plan.priceYearly > 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      {plan.priceYearly} {plan.currency}{t("pricing.perYear")} (
                      {Math.round(
                        ((plan.priceMonthly * 12 - plan.priceYearly) /
                          (plan.priceMonthly * 12)) *
                          100,
                      )}
                      % {t("pricing.savings")})
                    </p>
                  )}
                </div>

                {/* Limits summary */}
                <div className="mb-6 space-y-2 border-b border-gray-100 pb-6 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">
                      <FormatLimit
                        value={plan.maxDoctors}
                        unlimitedLabel={t("pricing.unlimited")}
                      />
                    </span>{" "}
                    {plan.maxDoctors === 1
                      ? t("pricing.doctor")
                      : t("pricing.doctors")}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">
                      <FormatLimit
                        value={plan.maxPatients}
                        unlimitedLabel={t("pricing.unlimited")}
                      />
                    </span>{" "}
                    {t("pricing.patients")}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">
                      <FormatLimit
                        value={plan.maxAppointmentsPerMonth}
                        unlimitedLabel={t("pricing.unlimited")}
                      />
                    </span>{" "}
                    {t("pricing.appointmentsPerMonth")}
                  </p>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.priceMonthly === 0 ? "/register" : "/contact"}
                  className={`group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                    isPopular
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                      : plan.priceMonthly === 0
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {plan.priceMonthly === 0
                    ? t("pricing.ctaFree")
                    : plan.id === "enterprise"
                      ? t("pricing.ctaContact")
                      : t("pricing.ctaChoose")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* FAQ section */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            {t("pricing.faqTitle")}
          </h2>
          <div className="space-y-6">
            {faqKeys.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-xl border border-gray-100 p-6"
              >
                <h3 className="font-semibold text-gray-900">{t(q)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {t(a)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
