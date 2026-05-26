"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    title: "Prendre rendez-vous",
    content: (
      <div className="space-y-3">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--rule)", backgroundColor: "white" }}>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>Cabinet Dr. Bennani · Cardiologie</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-60)" }}>Casablanca · Lun-Ven 8h-18h</p>
          <button
            className="mt-3 rounded-md px-4 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: "var(--surgical-sage)" }}
          >
            Prendre rendez-vous
          </button>
        </div>
      </div>
    ),
  },
  {
    title: "Choisir un créneau",
    content: (
      <div className="grid grid-cols-4 gap-1.5">
        {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30"].map((t, i) => (
          <div
            key={t}
            className="cursor-default rounded-md py-2 text-center text-xs font-medium transition-colors"
            style={{
              backgroundColor: i === 2 ? "var(--surgical-sage)" : "var(--lab-linen)",
              color: i === 2 ? "white" : "var(--ink-60)",
            }}
          >
            {t}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Assurance",
    content: (
      <div className="space-y-1.5">
        {["CNSS", "CNOPS", "AMO", "RAMED", "Privé"].map((ins, i) => (
          <div
            key={ins}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: i === 0 ? "var(--surgical-sage-light)" : "var(--lab-linen)",
              color: i === 0 ? "var(--surgical-sage)" : "var(--ink-60)",
              border: i === 0 ? "1px solid var(--surgical-sage)" : "1px solid transparent",
            }}
          >
            {i === 0 && <span style={{ color: "var(--surgical-sage)" }}>✓</span>}
            {ins}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Rappel WhatsApp",
    content: (
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: "#DCF8C6", maxWidth: 280 }}
      >
        <p className="text-sm" style={{ color: "#303030", direction: "rtl", fontFamily: "var(--font-arabic)" }}>
          سلام، تسجيلك ف Cabinet Dr. Bennani تأكد. موعيد: الخميس 18 أبريل، 10h30. باش تلغي، كتبي 1.
        </p>
        <p className="mt-1 text-right text-[10px]" style={{ color: "#6B7B6B" }}>10:32 ✓✓</p>
      </div>
    ),
  },
  {
    title: "Confirmé",
    content: (
      <div className="flex items-center gap-4">
        <div className="flex-1 rounded-lg border p-4" style={{ borderColor: "var(--surgical-sage)", backgroundColor: "var(--surgical-sage-light)" }}>
          <p className="text-center text-sm font-medium" style={{ color: "var(--surgical-sage)" }}>Rendez-vous confirmé</p>
          <p className="mt-1 text-center text-xs" style={{ color: "var(--ink-60)" }}>Jeudi 18 Avril · 10h30</p>
          <p className="mt-1 text-center text-xs" style={{ color: "var(--reassurance-teal)" }}>CNSS validée · Rappel WhatsApp envoyé</p>
        </div>
      </div>
    ),
  },
];

export function BookingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollH = el.offsetHeight - window.innerHeight;
      if (scrollH <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollH));
      setStep(Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length)));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={ref}
      className="relative"
      style={{ backgroundColor: "var(--lab-linen)", height: `${STEPS.length * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center">
        <div
          className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
          style={{ maxWidth: "var(--container-max)" }}
        >
          {/* eslint-disable i18next/no-literal-string */}
          <h2
            className="mb-3"
            style={{
              fontFamily: "var(--font-sans-landing)",
              fontSize: "var(--text-h2)",
              lineHeight: "var(--lh-h2)",
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            Le rendez-vous, sans le téléphone.
          </h2>
          <p className="mb-8" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "var(--ink-60)", direction: "rtl" }}>
            الموعد، بدون هاتف.
          </p>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Step indicator */}
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300"
                  style={{
                    backgroundColor: i === step ? "var(--surgical-sage-light)" : "transparent",
                    borderLeft: i === step ? "3px solid var(--surgical-sage)" : "3px solid transparent",
                  }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: i <= step ? "var(--surgical-sage)" : "var(--bone-2)",
                      color: i <= step ? "white" : "var(--ink-60)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: i === step ? "var(--ink)" : "var(--ink-60)" }}
                  >
                    {s.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm transition-opacity duration-300" key={step}>
                {STEPS[step]?.content}
              </div>
            </div>
          </div>
          {/* eslint-enable i18next/no-literal-string */}
        </div>
      </div>
    </section>
  );
}
