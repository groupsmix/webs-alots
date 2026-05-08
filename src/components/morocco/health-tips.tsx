"use client";

import { useState, useEffect } from "react";

interface HealthTip {
  fr: string;
  ar: string;
}

/**
 * Health tips content in French and Darija/Arabic.
 * Rotating display for waiting room TV screens.
 */
const HEALTH_TIPS: HealthTip[] = [
  {
    fr: "Buvez au moins 1,5 litre d'eau par jour pour rester hydraté.",
    ar: "شرب على الأقل 1.5 لتر ديال الما فالنهار باش تبقى رطب.",
  },
  {
    fr: "Lavez-vous les mains régulièrement avec du savon pendant 20 secondes.",
    ar: "غسل يديك بالصابون 20 ثانية بشكل منتظم.",
  },
  {
    fr: "Faites au moins 30 minutes d'activité physique par jour.",
    ar: "دير على الأقل 30 دقيقة ديال الرياضة فالنهار.",
  },
  {
    fr: "Mangez 5 fruits et légumes par jour pour une alimentation équilibrée.",
    ar: "كول 5 حبات ديال الفواكه والخضرة فالنهار.",
  },
  {
    fr: "Dormez au moins 7 à 8 heures par nuit pour une bonne santé.",
    ar: "نعس 7 تال 8 ساعات فالليل باش تكون صحتك مزيانة.",
  },
  {
    fr: "Évitez de fumer — le tabac est la première cause de maladies évitables.",
    ar: "بعد على الدخان — هو السبب الأول ديال الأمراض اللي ممكن تفاداها.",
  },
  {
    fr: "Consultez votre médecin au moins une fois par an pour un bilan de santé.",
    ar: "زور الطبيب مرة فالعام على الأقل باش دير الفحص.",
  },
  {
    fr: "Protégez-vous du soleil avec de la crème solaire et un chapeau.",
    ar: "حمي راسك من الشمس بالكريم والشابو.",
  },
  {
    fr: "Limitez votre consommation de sucre et de sel pour prévenir le diabète et l'hypertension.",
    ar: "نقص من السكر والملح باش تفادى السكري وضغط الدم.",
  },
  {
    fr: "Prenez soin de votre santé mentale — n'hésitez pas à en parler.",
    ar: "اهتم بصحتك النفسية — ماتحشمش تهدر عليها.",
  },
  {
    fr: "Gardez vos vaccinations à jour pour vous protéger et protéger les autres.",
    ar: "خلي التلقيحات ديالك محدثة باش تحمي راسك والآخرين.",
  },
  {
    fr: "Aérez votre maison au moins 10 minutes par jour, même en hiver.",
    ar: "فتح الشرجم ديال الدار 10 دقايق فالنهار، حتى فالشتا.",
  },
];

interface HealthTipsWidgetProps {
  locale?: "fr" | "ar";
  /** Interval between tips in milliseconds (default: 8000) */
  interval?: number;
}

/**
 * Rotating health tips widget for TV display.
 * Shows tips in French with Darija translation.
 */
export function HealthTipsWidget({
  locale = "fr",
  interval = 8000,
}: HealthTipsWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % HEALTH_TIPS.length);
        setIsVisible(true);
      }, 500);
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);

  const tip = HEALTH_TIPS[currentIndex];

  return (
    <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
        <span className="text-lg">💡</span>
        {locale === "ar" ? "نصيحة صحية" : "Conseil santé"}
      </h3>
      <div
        className={`transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0"}`}
      >
        <p className="text-sm text-blue-50 leading-relaxed">
          {locale === "ar" ? tip.ar : tip.fr}
        </p>
        {locale === "fr" && (
          <p className="text-xs text-blue-300 mt-1 italic" dir="rtl">
            {tip.ar}
          </p>
        )}
      </div>
      <div className="flex gap-1 mt-3 justify-center">
        {HEALTH_TIPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === currentIndex ? "w-4 bg-blue-300" : "w-1 bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
