"use client";

import {
  UserPlus,
  Settings,
  Share2,
  CalendarCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const steps: readonly { number: string; titleKey: TranslationKey; descKey: TranslationKey; icon: LucideIcon }[] = [
  {
    number: "01",
    icon: UserPlus,
    titleKey: "landing.howStep1Title",
    descKey: "landing.howStep1Desc",
  },
  {
    number: "02",
    icon: Settings,
    titleKey: "landing.howStep2Title",
    descKey: "landing.howStep2Desc",
  },
  {
    number: "03",
    icon: Share2,
    titleKey: "landing.howStep3Title",
    descKey: "landing.howStep3Desc",
  },
  {
    number: "04",
    icon: CalendarCheck,
    titleKey: "landing.howStep4Title",
    descKey: "landing.howStep4Desc",
  },
];

export function HowItWorksSection() {
  const { t } = useLandingLocale();

  return (
    <section id="comment-ca-marche" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {t("landing.howLabel")}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t("landing.howTitle")}
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            {t("landing.howSubtitle")}
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, titleKey, descKey, icon: Icon }, idx) => (
            <div key={number} className="relative text-center">
              {/* Connector line (hidden on first item and on mobile) */}
              {idx > 0 && (
                <div className="pointer-events-none absolute -left-4 top-7 hidden h-px w-8 bg-gray-200 lg:block" />
              )}

              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-gray-100">
                <Icon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-600">
                {t("landing.howStep")} {number}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{t(titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
