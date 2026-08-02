"use client";

import { Pause, Play } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { cn } from "@/lib/utils";

/** Metrics ticker — a mono row streaming static metrics in cyan, seamless loop. */
export function TelemetryTicker() {
  const { dict } = useI18n();
  const [paused, setPaused] = useState(false);

  const reducedMotion = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const items: { label: string; value: string }[] = [
    { label: dict.telemetry.rdv, value: "1 248" },
    { label: dict.telemetry.p95, value: "182 ms" },
    { label: dict.telemetry.uptime, value: "99,95 %" },
    { label: dict.telemetry.clinics, value: "340" },
    { label: dict.telemetry.reminders, value: "5 120" },
  ];
  const row = [...items, ...items];

  return (
    <div className="group relative overflow-hidden border-y border-hairline bg-surface/30 py-3 ps-24">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 start-0 z-10 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-24 bg-gradient-to-l from-ink to-transparent" />
      <div
        className={cn(
          "flex w-max gap-10",
          !reducedMotion &&
            "animate-ticker hover:[animation-play-state:paused] active:[animation-play-state:paused]",
        )}
        style={{ animationPlayState: reducedMotion || paused ? "paused" : "running" }}
      >
        {row.map((it, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${it.label}: ${it.value}`}
          >
            <span className="size-1 rounded-full bg-cyan" aria-hidden="true" />
            <span
              className="telemetry text-[11px] uppercase tracking-[0.14em] text-text-secondary"
              aria-hidden="true"
            >
              {it.label}
            </span>
            <span className="text-[10px] text-text-muted" aria-hidden="true">
              :
            </span>
            <span className="telemetry text-[12px] font-medium text-cyan" aria-hidden="true">
              {it.value}
            </span>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? dict.telemetry.play : dict.telemetry.pause}
        className="absolute end-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-hairline bg-ink/80 p-2 text-text-secondary opacity-0 backdrop-blur-sm transition-opacity hover:text-text focus:opacity-100 group-hover:opacity-100"
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
    </div>
  );
}
