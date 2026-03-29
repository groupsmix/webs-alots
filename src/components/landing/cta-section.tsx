"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLandingLocale } from "./landing-locale-provider";

export function CtaSection() {
  const { t } = useLandingLocale();

  return (
    <section className="relative overflow-hidden bg-gray-900 py-20 sm:py-28">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            {t("landing.ctaSubtitle")}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-sm font-semibold text-gray-900 shadow-lg transition-all hover:bg-gray-100"
            >
              {t("landing.ctaPrimary")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              {t("landing.ctaPricing")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
