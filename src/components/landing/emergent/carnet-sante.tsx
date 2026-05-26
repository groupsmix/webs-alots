"use client";

import { useEffect, useState } from "react";

const ENTRIES = [
  { section: 2, date: "2026-05-26", fr: "Diagnostic visuel : multi-tenant", ar: "التشخيص : عيادة لكل مهني" },
  { section: 3, date: "2026-05-26", fr: "Symptôme : trop d'appels téléphoniques\nPrescription : rendez-vous en ligne", ar: "الأعراض : كثرة المكالمات" },
  { section: 4, date: "2026-05-26", fr: "Observation : darija OK sur WhatsApp", ar: "ملاحظة : درجة ممتازة" },
  { section: 5, date: "2026-05-26", fr: "Bilan : dossier chiffré · AES-256-GCM", ar: "النتيجة : الملف مشفر" },
];

const FINAL_ENTRY = {
  fr: "Le patient cherche un système\ncalme pour sa clinique.",
  ar: "المريض يبحث عن نظام هادئ\nلعيادته.",
  treatment: "→ Oltigo Health",
};

export function CarnetSante({ rtl }: { rtl: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Skip scroll tracking; derive values from scrollProgress = 0
      // and override visibleEntries/showFinal below via CSS-only
      return;
    }

    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0) setScrollProgress(window.scrollY / total);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const visibleEntries = Math.min(ENTRIES.length, Math.floor(scrollProgress * (ENTRIES.length + 2)));
  const showFinal = scrollProgress > 0.85;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-lg border"
        style={{
          [rtl ? "right" : "left"]: 24,
          backgroundColor: "var(--carnet-ochre-light)",
          borderColor: "var(--carnet-ochre)",
          color: "var(--carnet-ochre)",
        }}
        aria-label="Ouvrir le carnet de santé"
      >
        <span className="text-sm">📒</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 z-40 w-56 overflow-hidden rounded-lg border shadow-lg"
      style={{
        [rtl ? "right" : "left"]: 24,
        backgroundColor: "#FDF8EE",
        borderColor: "var(--carnet-ochre)",
        fontFamily: "var(--font-mono-landing)",
        fontSize: 10,
        maxHeight: "min(50vh, 360px)",
      }}
    >
      {/* Header */}
      {/* eslint-disable i18next/no-literal-string */}
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--carnet-ochre-light)" }}>
        <span className="font-bold" style={{ color: "var(--carnet-ochre)" }}>CARNET DE SANTÉ · كناش الصحة</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs"
          style={{ color: "var(--ink-60)" }}
          aria-label="Réduire le carnet"
        >
          ×
        </button>
      </div>

      {/* Patient info */}
      <div className="border-b px-3 py-2 space-y-0.5" style={{ borderColor: "var(--carnet-ochre-light)", color: "var(--ink-60)" }}>
        <p>Patient : Visiteur du site</p>
        <p>Médecin : Oltigo Health</p>
        <p>Cabinet : en ligne · على الإنترنت</p>
      </div>

      {/* Entries */}
      <div className="overflow-y-auto px-3 py-2 space-y-2" style={{ maxHeight: 200 }}>
        {ENTRIES.slice(0, visibleEntries).map((e, i) => (
          <div
            key={i}
            className="border-b pb-2"
            style={{ borderColor: "var(--carnet-ochre-light)" }}
          >
            <p style={{ color: "var(--ink-60)" }}>[Section {e.section}] {e.date}</p>
            <p style={{ color: "var(--ink-70)", whiteSpace: "pre-line" }}>{e.fr}</p>
            <p style={{ color: "var(--ink-60)", direction: "rtl", fontFamily: "var(--font-arabic)" }}>{e.ar}</p>
            <p className="mt-0.5 text-center font-bold" style={{ color: "var(--surgical-sage)" }}>VU · مرئي</p>
          </div>
        ))}

        {/* Final diagnostic */}
        {showFinal && (
          <div className="pt-1">
            <p className="font-bold" style={{ color: "var(--ink)" }}>Diagnostic final · التشخيص النهائي</p>
            <p className="mt-1" style={{ color: "var(--ink-70)", whiteSpace: "pre-line" }}>{FINAL_ENTRY.fr}</p>
            <p style={{ color: "var(--ink-60)", direction: "rtl", fontFamily: "var(--font-arabic)", whiteSpace: "pre-line" }}>{FINAL_ENTRY.ar}</p>
            <p className="mt-1" style={{ color: "var(--surgical-sage)" }}>Traitement recommandé :</p>
            <p className="font-bold" style={{ color: "var(--surgical-sage)" }}>{FINAL_ENTRY.treatment}</p>
            <div className="mt-2 rounded border py-1 text-center font-bold" style={{ borderColor: "var(--surgical-sage)", color: "var(--surgical-sage)" }}>
              APPROUVÉ
            </div>
          </div>
        )}
      </div>
      {/* eslint-enable i18next/no-literal-string */}
    </div>
  );
}
