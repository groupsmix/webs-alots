"use client";

import { useState, useEffect } from "react";

interface PrayerTime {
  name: string;
  nameFr: string;
  nameAr: string;
  time: string;
}

interface PrayerTimesWidgetProps {
  /** City name for Aladhan API (e.g., "Casablanca") */
  city?: string;
  /** Country name for Aladhan API */
  country?: string;
  /** Locale for display text */
  locale?: "fr" | "ar";
}

const PRAYER_LABELS: Record<string, { fr: string; ar: string }> = {
  Fajr: { fr: "Fajr", ar: "الفجر" },
  Dhuhr: { fr: "Dhuhr", ar: "الظهر" },
  Asr: { fr: "Asr", ar: "العصر" },
  Maghrib: { fr: "Maghrib", ar: "المغرب" },
  Isha: { fr: "Isha", ar: "العشاء" },
};

/**
 * Prayer times widget using the Aladhan API (free, no API key required).
 * Designed for waiting room TV displays.
 */
export function PrayerTimesWidget({
  city = "Casablanca",
  country = "Morocco",
  locale = "fr",
}: PrayerTimesWidgetProps) {
  const [prayers, setPrayers] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPrayerTimes() {
      try {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, "0");
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const yyyy = today.getFullYear();

        const response = await fetch(
          `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=21`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const timings = data?.data?.timings;

        if (!timings) {
          setLoading(false);
          return;
        }

        const prayerNames = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
        const prayerList: PrayerTime[] = prayerNames.map((name) => ({
          name,
          nameFr: PRAYER_LABELS[name].fr,
          nameAr: PRAYER_LABELS[name].ar,
          time: timings[name]?.replace(/\s*\(.*\)/, "") ?? "",
        }));

        setPrayers(prayerList);

        // Determine next prayer
        const now = today;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const upcoming = prayerList.find((p) => {
          const [h, m] = p.time.split(":").map(Number);
          return h * 60 + m > currentMinutes;
        });
        setNextPrayer(upcoming?.name ?? null);

        setLoading(false);
      } catch {
        setLoading(false);
      }
    }

    fetchPrayerTimes();
    return () => {
      controller.abort();
    };
  }, [city, country]);

  if (loading || prayers.length === 0) {
    return null;
  }

  const isRTL = locale === "ar";

  return (
    <div
      className={`bg-white/10 rounded-xl p-4 backdrop-blur-sm ${isRTL ? "rtl" : "ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <h3 className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-2">
        <span className="text-lg">🕌</span>
        {locale === "ar" ? "مواقيت الصلاة" : "Horaires de prière"}
      </h3>
      <div className="space-y-1.5">
        {prayers.map((prayer) => (
          <div
            key={prayer.name}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all ${
              nextPrayer === prayer.name
                ? "bg-green-500/20 text-green-100 font-medium"
                : "text-blue-100"
            }`}
          >
            <span>
              {locale === "ar" ? prayer.nameAr : prayer.nameFr}
              {nextPrayer === prayer.name && (
                <span className="text-[10px] ml-1 bg-green-500/30 px-1.5 py-0.5 rounded-full">
                  {locale === "ar" ? "التالية" : "Suivante"}
                </span>
              )}
            </span>
            <span className="font-mono text-sm">{prayer.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
