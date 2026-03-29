"use client";

import {
  CalendarCheck,
  Users,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useLandingLocale } from "./landing-locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const items: readonly { icon: typeof CalendarCheck; key: TranslationKey }[] = [
  { icon: CalendarCheck, key: "landing.trustAppointments" },
  { icon: Users, key: "landing.trustPatients" },
  { icon: Globe, key: "landing.trustWebsite" },
  { icon: ShieldCheck, key: "landing.trustSecurity" },
];

export function TrustSection() {
  const { t } = useLandingLocale();

  return (
    <section className="border-y border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mx-auto max-w-lg text-center text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
          {t("landing.trustText")}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t(key)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
