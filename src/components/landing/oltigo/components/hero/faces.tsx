"use client";

import { Calendar, Check, CheckCheck, Fingerprint, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/landing/oltigo/i18n/context";

/* ===========================================================================
   The three console faces. Crisp DOM, reused by both the static fallback and
   the 3D slabs (via drei <Html>). Fixed pixel sizing so they read identically.
   =========================================================================== */

/** 01 — Weekly agenda grid with appointment chips. */
export function AgendaFace() {
  const days = ["L", "M", "M", "J", "V"];
  // Each cell: 0 empty · 1 booked · 2 active(emerald, pulses)
  const grid = [
    [1, 0, 1, 0, 2],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 2, 0, 1, 0],
  ];
  const times = ["09:00", "10:30", "12:00", "14:30"];
  return (
    <div className="panel w-[300px] rounded-[14px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="telemetry text-[10px] uppercase tracking-[0.2em] text-text-muted">
          Semaine 24
        </span>
        <Calendar className="size-3.5 text-text-muted" strokeWidth={1.5} aria-hidden />
      </div>
      <div className="grid grid-cols-[42px_repeat(5,1fr)] gap-1.5">
        <span />
        {days.map((d, i) => (
          <span key={i} className="telemetry text-center text-[10px] text-text-muted">
            {d}
          </span>
        ))}
        {grid.map((row, r) => (
          <FaceRow key={r} time={times[r]} row={row} />
        ))}
      </div>
    </div>
  );
}

function FaceRow({ time, row }: { time: string; row: number[] }) {
  return (
    <>
      <span className="telemetry self-center text-[9.5px] text-text-muted">{time}</span>
      {row.map((cell, c) => (
        <span
          key={c}
          className={[
            "h-5 rounded-[5px] border",
            cell === 0 && "border-hairline bg-transparent",
            cell === 1 && "border-transparent bg-[var(--color-surface-high)]",
            cell === 2 && "animate-soft-pulse border-emerald/40 bg-emerald/25",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </>
  );
}

/** 02 — Encrypted patient dossier with brushed-metal seal. */
export function DossierFace() {
  const { dict } = useI18n();
  return (
    <div className="panel panel-high w-[300px] rounded-[14px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-text">{dict.features[1].title}</span>
        {/* brushed-metal seal / lock — AES motif */}
        <span
          className="relative grid size-7 place-items-center rounded-full"
          style={{
            background: "conic-gradient(from 210deg, #2a3236, #5b6568, #1c2225, #454f52, #2a3236)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 2px 6px -2px rgba(0,0,0,0.8)",
          }}
        >
          <Lock className="size-3 text-[#cdd4d3]" strokeWidth={2} aria-hidden />
        </span>
      </div>

      <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-ink/60 px-2 py-1">
        <Fingerprint className="size-3 text-cyan" strokeWidth={1.5} aria-hidden />
        <span className="telemetry text-[10px] tracking-wide text-cyan">AES-256-GCM</span>
      </div>

      {/* redacted rows */}
      <div className="space-y-2">
        {[88, 64, 72].map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-1.5 w-10 rounded-full bg-text-muted/30" />
            <span
              className="h-1.5 rounded-full bg-[var(--color-surface-high)]"
              style={{ width: `${w}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3">
        <span className="size-1.5 rounded-full bg-emerald" />
        <span className="text-[10.5px] text-text-muted">{dict.features[1].bullets[3]}</span>
      </div>
    </div>
  );
}

/** 03 — WhatsApp Darija reminder tile, with a looping micro-conversation. */
export function WhatsappFace() {
  const { dict } = useI18n();
  const [step, setStep] = useState(0); // 0 incoming · 1 reply · 2 ✓✓ confirmed

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(2);
      return;
    }
    let s = 0;
    const id = window.setInterval(() => {
      s = (s + 1) % 3;
      setStep(s);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="panel w-[300px] rounded-[14px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="telemetry text-[10px] uppercase tracking-[0.2em] text-text-muted">
          WhatsApp · Darija
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald" />
          <span className="telemetry text-[9.5px] text-text-muted">live</span>
        </span>
      </div>

      {/* incoming reminder */}
      <div className="mb-2 max-w-[78%] rounded-2xl rounded-ss-sm border border-hairline bg-[var(--color-surface-high)] px-3 py-2">
        <p className="text-[11.5px] leading-snug text-text-secondary">{dict.whatsapp.incoming}</p>
      </div>

      {/* patient reply OUI */}
      <div
        className="ms-auto mb-1 flex max-w-[60%] items-center justify-end gap-1.5 rounded-2xl rounded-ee-sm bg-[var(--color-emerald-dim)] px-3 py-1.5 transition-opacity duration-500"
        style={{ opacity: step >= 1 ? 1 : 0.15 }}
      >
        <span className="text-[12px] font-medium text-text">{dict.whatsapp.reply}</span>
        {step >= 2 ? (
          <CheckCheck className="size-3.5 text-emerald" strokeWidth={2.2} aria-hidden />
        ) : (
          <Check className="size-3.5 text-text-muted" strokeWidth={2.2} aria-hidden />
        )}
      </div>

      <div className="flex items-center justify-end">
        <span
          className="telemetry text-[9.5px] transition-colors duration-500"
          style={{ color: step >= 2 ? "var(--color-emerald)" : "var(--color-text-muted)" }}
        >
          {step >= 2 ? dict.whatsapp.status : "···"}
        </span>
      </div>
    </div>
  );
}
