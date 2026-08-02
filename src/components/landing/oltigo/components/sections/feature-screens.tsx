"use client";

/* eslint-disable i18next/no-literal-string -- realistic product UI mockup strings */

import { Calendar, Clock, FileText, Pill, Shield, User } from "lucide-react";
import type { Dictionary } from "@/components/landing/oltigo/i18n/dictionaries";

/** Realistic in-code product screenshot for the Appointments feature. */
export function AppointmentScreen({ dict }: { dict: Dictionary }) {
  const days = ["L", "M", "M", "J", "V"];
  const slots = [
    { time: "09:00", cells: [1, 0, 0, 1, 2] },
    { time: "10:30", cells: [0, 2, 1, 0, 1] },
    { time: "12:00", cells: [1, 1, 0, 2, 0] },
    { time: "14:30", cells: [0, 0, 2, 1, 1] },
  ];

  return (
    <div className="panel w-full max-w-[340px] overflow-hidden rounded-[16px] p-4 sm:max-w-[400px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-emerald/10 text-emerald">
            <Calendar className="size-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <p className="text-[13px] font-medium text-text">{dict.features[0].title}</p>
            <p className="text-[11px] text-text-muted">Semaine 24 · 3 praticiens</p>
          </div>
        </div>
        <span className="telemetry rounded-md border border-hairline bg-ink px-2 py-1 text-[10px] text-text-secondary">
          Vue semaine
        </span>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: "44px repeat(5, 1fr)" }}>
        <span />
        {days.map((d, i) => (
          <span
            key={i}
            className="telemetry text-center text-[10px] font-medium uppercase tracking-wide text-text-secondary"
          >
            {d}
          </span>
        ))}
        {slots.map(({ time, cells }) => (
          <SlotRow key={time} time={time} cells={cells} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-ink px-3 py-2">
        <Clock className="size-3.5 text-emerald" strokeWidth={1.75} aria-hidden />
        <span className="text-[11.5px] text-text-secondary">12 RDV confirmés aujourd’hui</span>
      </div>
    </div>
  );
}

function SlotRow({ time, cells }: { time: string; cells: number[] }) {
  return (
    <>
      <span className="telemetry self-center text-[10px] text-text-secondary">{time}</span>
      {cells.map((cell, c) => (
        <span
          key={c}
          className={cn(
            "h-7 rounded-md border",
            cell === 0 && "border-hairline bg-transparent",
            cell === 1 && "border-transparent bg-surface-high",
            cell === 2 &&
              "flex items-center justify-center border-emerald/40 bg-emerald/15 text-[9px] font-medium text-emerald",
          )}
        >
          {cell === 2 ? "RDV" : null}
        </span>
      ))}
    </>
  );
}

/** Realistic in-code product screenshot for the Patient Record feature. */
export function RecordScreen({ dict }: { dict: Dictionary }) {
  return (
    <div className="panel w-full max-w-[340px] overflow-hidden rounded-[16px] p-0 sm:max-w-[400px]">
      <div className="flex items-center gap-3 border-b border-hairline p-4">
        <div className="grid size-10 place-items-center rounded-full bg-surface text-[12px] font-medium text-text">
          <User className="size-4 text-text-secondary" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <p className="text-[13px] font-medium text-text">Yasmine Berrada</p>
          <p className="text-[11px] text-text-muted">{dict.features[1].title} · 32 ans</p>
        </div>
        <Shield className="ms-auto size-4 text-emerald" strokeWidth={1.75} aria-hidden />
      </div>

      <div className="flex gap-1 border-b border-hairline px-4 py-2">
        {["Historique", "Ordonnances", "Documents"].map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "rounded-md px-2 py-1 text-[11px]",
              i === 1 ? "bg-surface font-medium text-text" : "text-text-secondary",
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="space-y-2 p-4">
        <div className="rounded-lg border border-hairline bg-ink p-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="size-3.5 text-cyan" strokeWidth={1.75} aria-hidden />
            <span className="text-[11px] font-medium text-text">Ordonnance · 12 juin 2026</span>
          </div>
          <ul className="space-y-1.5">
            {[
              { name: "Paracétamol 500 mg", freq: "3× / jour" },
              { name: "Amoxicilline 1 g", freq: "2× / jour" },
            ].map((m) => (
              <li
                key={m.name}
                className="flex items-center gap-2 text-[11.5px] text-text-secondary"
              >
                <Pill className="size-3 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{m.name}</span>
                <span className="text-[10px] text-text-muted">{m.freq}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span className="size-1.5 rounded-full bg-emerald" />
          {dict.features[1].bullets[3]}
        </div>
      </div>
    </div>
  );
}

/** Realistic in-code product screenshot for the WhatsApp reminders feature. */
export function WhatsAppScreen({ dict }: { dict: Dictionary }) {
  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[16px] border border-hairline bg-[#0b141a] sm:max-w-[400px]">
      <div className="flex items-center gap-2.5 bg-[#1f2c34] px-3 py-2.5">
        <div className="grid size-9 place-items-center rounded-full bg-surface text-[11px] font-medium text-text">
          CB
        </div>
        <div>
          <p className="text-[13px] font-medium text-text">Cabinet Berrada</p>
          <p className="text-[10px] text-emerald">en ligne</p>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="max-w-[86%] rounded-lg rounded-tl-none bg-surface-high px-3 py-2">
          <p className="text-[12px] leading-snug text-text-secondary">{dict.whatsapp.incoming}</p>
          <p className="mt-1 text-right text-[10px] text-text-muted">14:30</p>
        </div>

        <div
          className="ms-auto flex max-w-[64%] items-center gap-1.5 rounded-lg rounded-tr-none px-3 py-1.5"
          style={{ background: "var(--color-emerald-dim)" }}
        >
          <span className="text-[13px] font-medium text-text">{dict.whatsapp.reply}</span>
          <span className="text-[10px] font-medium text-emerald">{dict.whatsapp.status}</span>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}
