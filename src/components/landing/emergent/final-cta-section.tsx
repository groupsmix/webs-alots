"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden py-32"
      style={{ backgroundColor: "var(--lab-linen)" }}
    >
      {/* Operating-room-dawn gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, var(--surgical-sage-light) 0%, transparent 50%)" }}
      />

      <div className="relative mx-auto max-w-2xl px-6 text-center">
        {/* eslint-disable i18next/no-literal-string */}
        <h2
          style={{
            fontFamily: "var(--font-serif-landing)",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.1,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          <span className="block">Votre cabinet mérite un système calme.</span>
          <span className="mt-3 block" style={{ fontFamily: "var(--font-arabic)", direction: "rtl" }}>
            عيادتك تستحق نظاما هادئا.
          </span>
        </h2>

        <div className="mt-10 flex justify-center">
          <Link
            href="/contact"
            className="group relative inline-flex items-center gap-2 rounded-lg px-8 py-4 text-sm font-medium text-white transition-all hover:brightness-110"
            style={{ backgroundColor: "var(--surgical-sage)" }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-lg animate-halo"
              style={{ boxShadow: "0 0 16px 4px var(--surgical-sage-halo)", opacity: 0 }}
            />
            Réserver une démo · حجز عرض توضيحي
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p
          className="mt-6 text-xs"
          style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)" }}
        >
          Démo de 20 minutes. Sans engagement. Sans carte bancaire.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      <style>{`
        @keyframes halo-breathe { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
        .animate-halo { animation: halo-breathe 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .animate-halo { animation: none !important; opacity: 0 !important; } }
      `}</style>
    </section>
  );
}
