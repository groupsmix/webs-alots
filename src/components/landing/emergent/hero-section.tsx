"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useInViewCounter } from "./use-in-view-counter";

const CLINICS = [
  "Cabinet Dr. Bennani · Cardiologie · Casablanca",
  "Clinique El Andalous · Médecine Générale · Rabat",
  "Pharmacie Atlas · Pharmacie · Tanger",
  "Cabinet Dentaire Tazi · Dentisterie · Marrakech",
];

const PATIENTS = [
  { initials: "A.B", status: "Confirmé", insurance: "CNSS validée", reminder: "Rappel WhatsApp envoyé" },
  { initials: "M.K", status: "En attente", insurance: "AMO validée", reminder: "Rappel planifié" },
  { initials: "F.Z", status: "Confirmé", insurance: "CNOPS validée", reminder: "Rappel WhatsApp envoyé" },
];

export function EmergentHero({ rtl }: { rtl: boolean }) {
  const [clinicIdx, setClinicIdx] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const clinics = useInViewCounter(312, 2000);
  const rdv = useInViewCounter(41200, 2500);
  const uptime = useInViewCounter(9998, 2000);

  useEffect(() => {
    const interval = setInterval(() => setClinicIdx((i) => (i + 1) % CLINICS.length), 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsing(true);
      setTimeout(() => setPulsing(false), 600);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "var(--lab-linen)" }}
    >
      {/* Operating-room-dawn gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at ${rtl ? "0%" : "100%"} 0%, var(--surgical-sage-light) 0%, transparent 60%)`,
        }}
      />

      <div
        className="relative mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        <div className="grid gap-12 pt-32 pb-20 lg:grid-cols-[1fr_380px] lg:items-center lg:gap-16">
          {/* Left column: headline + CTAs */}
          <div className={rtl ? "text-right" : ""}>
            {/* Bilingual headline in serif */}
            {/* eslint-disable i18next/no-literal-string */}
            <h1
              style={{
                fontFamily: "var(--font-serif-landing)",
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              <span className="block">
                La santé,{" "}
                <span className="relative inline-block">
                  mieux organisée.
                  <span
                    className="absolute bottom-0 left-0 h-[2px] animate-underline-ltr"
                    style={{ backgroundColor: "var(--carnet-ochre)", width: "100%" }}
                  />
                </span>
              </span>
              <span
                className="mt-3 block"
                style={{ fontFamily: "var(--font-arabic)", direction: "rtl" }}
              >
                الصحة،{" "}
                <span className="relative inline-block">
                  منظمة كما يجب.
                  <span
                    className="absolute bottom-0 right-0 h-[2px] animate-underline-rtl"
                    style={{ backgroundColor: "var(--carnet-ochre)", width: "100%" }}
                  />
                </span>
              </span>
            </h1>

            {/* Subhead */}
            <p
              className="mt-8"
              style={{
                fontFamily: "var(--font-sans-landing)",
                fontSize: "var(--text-body-lg)",
                lineHeight: "var(--lh-body-lg)",
                color: "var(--ink-70)",
                maxWidth: 640,
              }}
            >
              Un système d&apos;exploitation pour les cliniques marocaines.
              Rendez-vous, rappels WhatsApp, dossiers chiffrés, CNSS/CNOPS/AMO
              — sur une seule plateforme calme. Chaque clinique, son propre
              domaine. Toutes, la même sécurité.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register-clinic"
                className="group relative inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-all hover:brightness-110"
                style={{ backgroundColor: "var(--surgical-sage)" }}
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-lg animate-halo"
                  style={{
                    boxShadow: "0 0 16px 4px var(--surgical-sage-halo)",
                    opacity: 0,
                  }}
                />
                Démarrer une clinique · ابدأ عيادتك
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5"
                style={{ borderColor: "var(--rule)", color: "var(--ink-70)" }}
              >
                Voir une démo guidée (2 min)
              </Link>
            </div>
            {/* eslint-enable i18next/no-literal-string */}
          </div>

          {/* Right column: booking card mockup */}
          <div
            className="relative rounded-xl border p-5"
            style={{
              backgroundColor: "white",
              borderColor: "var(--rule)",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04)",
            }}
          >
            {/* Clinic header with cross-fade */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--reassurance-teal)" }}
              >
                O
              </div>
              <span
                className="text-sm font-medium transition-opacity duration-400"
                style={{ color: "var(--ink)" }}
                key={clinicIdx}
              >
                {CLINICS[clinicIdx]}
              </span>
            </div>

            {/* Calendar strip */}
            <div className="mb-4 flex gap-1.5">
              {["Lun", "Mar", "Mer", "Jeu", "Ven"].map((d, i) => (
                <div
                  key={d}
                  className="flex-1 rounded-md py-2 text-center text-xs font-medium"
                  style={{
                    backgroundColor: i === 2 ? "var(--surgical-sage)" : "var(--lab-linen)",
                    color: i === 2 ? "white" : "var(--ink-60)",
                    transition: "box-shadow 0.3s",
                    boxShadow: i === 2 && pulsing ? "0 0 8px var(--surgical-sage-halo)" : "none",
                  }}
                >
                  {d}
                  <div className="mt-0.5 text-[10px] opacity-60">{16 + i}</div>
                </div>
              ))}
            </div>

            {/* Patient list */}
            <div className="space-y-2">
              {PATIENTS.map((p) => (
                <div
                  key={p.initials}
                  className="flex items-center gap-3 rounded-lg p-2"
                  style={{ backgroundColor: "var(--lab-linen)" }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: "var(--bone-2)", color: "var(--ink-60)" }}
                  >
                    {p.initials}
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{ backgroundColor: "var(--surgical-sage-light)", color: "var(--surgical-sage)" }}
                    >
                      {p.status}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{ backgroundColor: "var(--surgical-sage-light)", color: "var(--reassurance-teal)" }}
                    >
                      {p.insurance}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{ backgroundColor: "var(--carnet-ochre-light)", color: "var(--carnet-ochre)" }}
                    >
                      {p.reminder}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        {/* eslint-disable i18next/no-literal-string */}
        <div style={{ borderTop: "1px solid var(--rule)" }} />
        <div
          className="grid grid-cols-2 gap-6 py-6 sm:grid-cols-4"
          style={{
            fontFamily: "var(--font-mono-landing)",
            fontSize: "var(--text-mono)",
            color: "var(--ink-60)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {/* eslint-disable react-hooks/refs -- callback refs from useInViewCounter, not ref objects */}
          <div>
            <span ref={clinics.setNode} style={{ color: "var(--ink)" }}>{clinics.value}</span> cliniques
          </div>
          <div>
            <span ref={rdv.setNode} style={{ color: "var(--ink)" }}>{rdv.value.toLocaleString("fr-FR")}</span> rendez-vous ce mois
          </div>
          <div>
            <span ref={uptime.setNode} style={{ color: "var(--ink)" }}>{(uptime.value / 100).toFixed(2)} %</span> uptime
          </div>
          {/* eslint-enable react-hooks/refs */}
          <div style={{ color: "var(--ink)" }}>
            AES-256-GCM
          </div>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      <style>{`
        @keyframes underline-ltr {
          from { transform: scaleX(0); transform-origin: left; }
          to { transform: scaleX(1); transform-origin: left; }
        }
        @keyframes underline-rtl {
          from { transform: scaleX(0); transform-origin: right; }
          to { transform: scaleX(1); transform-origin: right; }
        }
        .animate-underline-ltr { animation: underline-ltr 0.9s ease-out 0.5s both; }
        .animate-underline-rtl { animation: underline-rtl 0.9s ease-out 0.7s both; }
        @keyframes halo-breathe {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .animate-halo { animation: halo-breathe 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-underline-ltr, .animate-underline-rtl { animation: none !important; transform: scaleX(1) !important; }
          .animate-halo { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
    </section>
  );
}
