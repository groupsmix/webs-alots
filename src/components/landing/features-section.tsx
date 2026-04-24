"use client";

import {
  CalendarDays,
  ClipboardList,
  MonitorSmartphone,
  Zap,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";
import { useLandingLocale } from "./landing-locale-provider";

const features: readonly { icon: typeof CalendarDays; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    icon: CalendarDays,
    titleKey: "landing.featureAppointmentsTitle",
    descKey: "landing.featureAppointmentsDesc",
  },
  {
    icon: ClipboardList,
    titleKey: "landing.featurePatientsTitle",
    descKey: "landing.featurePatientsDesc",
  },
  {
    icon: MonitorSmartphone,
    titleKey: "landing.featureWebsiteTitle",
    descKey: "landing.featureWebsiteDesc",
  },
  {
    icon: Zap,
    titleKey: "landing.featureAutomationTitle",
    descKey: "landing.featureAutomationDesc",
  },
];

export function FeaturesSection() {
  const { t } = useLandingLocale();

  return (
    <section id="fonctionnalites" className="bg-white dark:bg-gray-950 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {t("landing.featuresLabel")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-4xl">
            {t("landing.featuresTitle")}
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            {t("landing.featuresSubtitle")}
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {features.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className="group rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 transition-all hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-gray-900/50"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{t(titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
