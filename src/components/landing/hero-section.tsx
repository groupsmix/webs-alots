"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Users,
  Globe,
  ArrowRight,
} from "lucide-react";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const pills: readonly { icon: typeof CalendarCheck; key: TranslationKey }[] = [
  { icon: CalendarCheck, key: "landing.pillAppointments" },
  { icon: Users, key: "landing.pillPatients" },
  { icon: Globe, key: "landing.pillWebsite" },
];

export function HeroSection() {
  const { t } = useLandingLocale();

  return (
    <section className="relative overflow-hidden bg-white dark:bg-gray-950 pb-24 pt-20 sm:pb-32 sm:pt-28">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-transparent dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-transparent" />
        <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-blue-100/40 dark:bg-blue-900/20 blur-3xl" />
        <div className="absolute -left-20 top-40 h-[400px] w-[400px] rounded-full bg-indigo-100/30 dark:bg-indigo-900/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-violet-50/20 dark:bg-violet-900/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/60 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            {t("landing.badge")}
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl lg:text-6xl">
            {t("landing.heroTitle1")}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t("landing.heroTitle2")}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400 sm:text-xl">
            {t("landing.heroSubtitle")}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-xl sm:w-auto"
            >
              {t("landing.ctaPrimary")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#comment-ca-marche"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-8 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 sm:w-auto"
            >
              {t("landing.ctaSecondary")}
            </a>
            <a
              href="https://demo.oltigo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-8 text-sm font-semibold text-amber-700 dark:text-amber-300 transition-all hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 sm:w-auto"
            >
              {t("landing.tryDemo")}
            </a>
          </div>

          {/* Floating feature pills */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {pills.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="inline-flex items-center gap-2 rounded-full border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 shadow-sm"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                {t(key)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
