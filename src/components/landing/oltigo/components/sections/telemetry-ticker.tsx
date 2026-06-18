"use client";

import { useI18n } from "@/components/landing/oltigo/i18n/context";

/** Live telemetry ticker — a mono row streaming metrics in cyan, seamless loop. */
export function TelemetryTicker() {
  const { dict } = useI18n();
  const items: { label: string; value: string }[] = [
    { label: dict.telemetry.rdv, value: "1 248" },
    { label: dict.telemetry.p95, value: "182 ms" },
    { label: dict.telemetry.uptime, value: "99,95 %" },
    { label: dict.telemetry.clinics, value: "340" },
    { label: dict.telemetry.reminders, value: "5 120" },
  ];
  const row = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-hairline bg-surface/30 py-3">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 start-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent" />
      <div className="flex w-max animate-ticker gap-10 ps-10">
        {row.map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2.5">
            <span className="size-1 rounded-full bg-cyan" />
            <span className="telemetry text-[11px] uppercase tracking-[0.14em] text-text-muted">
              {it.label}
            </span>
            <span className="telemetry text-[12px] font-medium text-cyan">{it.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
