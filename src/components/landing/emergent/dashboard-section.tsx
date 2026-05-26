"use client";

import { useState } from "react";

type TabKey = "today" | "week" | "month";

const DATA: Record<TabKey, { rdv: number; annulations: number; ordonnances: number; encaisse: string; rows: { name: string; time: string; type: string; status: string }[] }> = {
  today: {
    rdv: 47, annulations: 3, ordonnances: 12, encaisse: "89 400",
    rows: [
      { name: "Mme A.", time: "08:30", type: "Consultation", status: "Confirmé" },
      { name: "M. B.", time: "09:00", type: "ECG", status: "En attente" },
      { name: "Mlle C.", time: "09:30", type: "Suivi", status: "Confirmé" },
      { name: "M. D.", time: "10:00", type: "Consultation", status: "Confirmé" },
      { name: "Mme E.", time: "10:30", type: "Ordonnance", status: "Annulé" },
    ],
  },
  week: {
    rdv: 198, annulations: 11, ordonnances: 67, encaisse: "412 800",
    rows: [
      { name: "Mme F.", time: "Lun 08:30", type: "Consultation", status: "Confirmé" },
      { name: "M. G.", time: "Mar 10:00", type: "ECG", status: "Confirmé" },
      { name: "Mlle H.", time: "Mer 14:00", type: "Suivi", status: "En attente" },
      { name: "M. I.", time: "Jeu 09:30", type: "Consultation", status: "Confirmé" },
      { name: "Mme J.", time: "Ven 11:00", type: "Bilan", status: "Confirmé" },
    ],
  },
  month: {
    rdv: 847, annulations: 42, ordonnances: 289, encaisse: "1 780 600",
    rows: [
      { name: "Mme K.", time: "01/05", type: "Consultation", status: "Confirmé" },
      { name: "M. L.", time: "05/05", type: "ECG", status: "Confirmé" },
      { name: "Mlle M.", time: "12/05", type: "Suivi", status: "Confirmé" },
      { name: "M. N.", time: "18/05", type: "Consultation", status: "Annulé" },
      { name: "Mme O.", time: "25/05", type: "Bilan", status: "Confirmé" },
    ],
  },
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
];

export function DashboardSection() {
  const [tab, setTab] = useState<TabKey>("today");
  const d = DATA[tab];

  return (
    <section className="py-24 lg:py-32" style={{ backgroundColor: "var(--lab-linen)" }}>
      <div
        className="mx-auto w-full px-[var(--gutter-mobile)] md:px-[var(--gutter-tablet)] lg:px-[var(--gutter-desktop)]"
        style={{ maxWidth: "var(--container-max)" }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <h2
          className="mb-3"
          style={{ fontFamily: "var(--font-sans-landing)", fontSize: "var(--text-h2)", fontWeight: 600, color: "var(--ink)" }}
        >
          Votre tableau de bord. En temps réel.
        </h2>
        <p className="mb-12" style={{ fontFamily: "var(--font-arabic)", fontSize: "var(--text-h3)", color: "var(--ink-60)", direction: "rtl" }}>
          لوحة التحكم. في الوقت الفعلي.
        </p>

        <div className="rounded-xl border" style={{ borderColor: "var(--rule)", backgroundColor: "white" }}>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: "var(--rule)" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  color: tab === t.key ? "var(--surgical-sage)" : "var(--ink-60)",
                  borderBottom: tab === t.key ? "2px solid var(--surgical-sage)" : "2px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 border-b p-6 sm:grid-cols-4" style={{ borderColor: "var(--rule)" }}>
            {[
              { label: "Rendez-vous", value: d.rdv },
              { label: "Annulations", value: d.annulations, color: "var(--clinic-coral)" },
              { label: "Ordonnances", value: d.ordonnances },
              { label: "Encaissé (MAD)", value: d.encaisse },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xs" style={{ color: "var(--ink-60)" }}>{stat.label}</p>
                <p
                  className="mt-1 text-xl font-semibold"
                  style={{
                    fontFamily: "var(--font-mono-landing)",
                    fontVariantNumeric: "tabular-nums",
                    color: stat.color ?? "var(--ink)",
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                  {["Patient", "Heure", "Type", "Statut"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium" style={{ color: "var(--ink-60)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="transition-colors hover:bg-[var(--lab-linen)]" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <td className="px-6 py-3 font-medium" style={{ color: "var(--ink)" }}>{r.name}</td>
                    <td className="px-6 py-3" style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)", fontVariantNumeric: "tabular-nums" }}>{r.time}</td>
                    <td className="px-6 py-3" style={{ color: "var(--ink-70)" }}>{r.type}</td>
                    <td className="px-6 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: r.status === "Annulé" ? "rgba(212,116,106,0.1)" : r.status === "En attente" ? "var(--carnet-ochre-light)" : "var(--surgical-sage-light)",
                          color: r.status === "Annulé" ? "var(--clinic-coral)" : r.status === "En attente" ? "var(--carnet-ochre)" : "var(--surgical-sage)",
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ fontFamily: "var(--font-mono-landing)", color: "var(--ink-60)" }}>
          Données fictives anonymisées · Mme A. · M. B. · Mlle C.
        </p>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </section>
  );
}
