"use client";

import { ExternalLink as ExternalLinkIcon, Lock } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import { useLandingLocale } from "./landing-locale-provider";

export function DemoSection() {
  const { t } = useLandingLocale();

  return (
    <section id="demo" className="bg-white dark:bg-gray-950 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {t("landing.demoLabel")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
            {t("landing.demoTitle")}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            {t("landing.demoSubtitle")}
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <ExternalLink
            href="https://demo.oltigo.com"
            className="group w-full max-w-2xl"
          >
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-lg transition-all group-hover:border-gray-300 dark:group-hover:border-gray-600 group-hover:shadow-xl">
              {/* Browser chrome mockup */}
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-300" />
                  <div className="h-3 w-3 rounded-full bg-yellow-300" />
                  <div className="h-3 w-3 rounded-full bg-green-300" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-700 px-4 py-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <Lock className="h-3 w-3 text-green-500" />
                  <span>demo.oltigo.com</span>
                  <ExternalLinkIcon className="h-3 w-3" />
                </div>
              </div>

              {/* Demo site preview */}
              <div className="bg-gradient-to-b from-blue-50/50 dark:from-blue-950/30 to-white dark:to-gray-900 px-8 py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <span className="text-lg font-bold text-blue-600">Dr</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
                  {t("landing.demoClinic")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                  {t("landing.demoSpecialty")} &bull; {t("landing.demoCity")}
                </p>
                <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                  <div className="h-20 rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 flex flex-col items-center justify-center p-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t("landing.demoServices")}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t("landing.demoServicesCount")}</span>
                  </div>
                  <div className="h-20 rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 flex flex-col items-center justify-center p-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t("landing.demoAppointments")}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t("landing.demoAppointmentsAvail")}</span>
                  </div>
                  <div className="h-20 rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 flex flex-col items-center justify-center p-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t("landing.demoReviews")}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t("landing.demoReviewsLabel")}</span>
                  </div>
                </div>
                <p className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors group-hover:text-blue-700">
                  {t("landing.demoViewSite")}
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </p>
              </div>
            </div>
          </ExternalLink>
        </div>

        {/* Try Demo CTA */}
        <div className="mt-8 text-center">
          <ExternalLink
            href="https://demo.oltigo.com"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
          >
            {t("landing.tryDemo")}
            <ExternalLinkIcon className="h-4 w-4" />
          </ExternalLink>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("landing.tryDemoSubtitle")}
          </p>
        </div>
      </div>
    </section>
  );
}
