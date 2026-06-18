"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/landing/oltigo/i18n/context";

const SECTIONS = [
  { id: "features", key: "features" as const },
  { id: "how", key: "how" as const },
  { id: "pricing", key: "pricing" as const },
  { id: "faq", key: "faq" as const },
];

/**
 * Sticky left progress rail (Stripe/Linear docs style). A hairline with an
 * emerald fill tracking scroll, plus section ticks that activate as you pass.
 * Mirrors to the right under RTL. Hidden on small screens.
 */
export function ProgressRail() {
  const { dict, dir } = useI18n();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(h.scrollTop / max, 1) : 0);

      let current = 0;
      SECTIONS.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= h.clientHeight * 0.4) current = i;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const side = dir === "rtl" ? { right: "1.75rem" } : { left: "1.75rem" };

  return (
    <nav
      aria-hidden="true"
      className="pointer-events-none fixed top-1/2 z-30 hidden -translate-y-1/2 lg:block"
      style={side}
    >
      <div className="pointer-events-auto relative flex flex-col gap-7">
        {/* track */}
        <span
          className="absolute top-0 h-full w-px bg-hairline"
          style={{ insetInlineStart: "3px" }}
        />
        {/* fill */}
        <span
          className="absolute top-0 w-px bg-emerald/70 transition-[height] duration-200 ease-out"
          style={{ insetInlineStart: "3px", height: `${progress * 100}%` }}
        />
        {SECTIONS.map((s, i) => (
          <div key={s.id} className="group relative flex items-center gap-3">
            <span
              className={[
                "h-[7px] w-[7px] rounded-full border transition-all duration-300",
                i === active
                  ? "scale-125 border-emerald bg-emerald"
                  : i < active
                    ? "border-emerald/60 bg-emerald/60"
                    : "border-text-muted bg-ink",
              ].join(" ")}
            />
            {/* label revealed on hover only — keeps the gutter clear of content */}
            <span
              className={[
                "telemetry whitespace-nowrap text-[10px] uppercase tracking-[0.18em] opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                i === active ? "text-text-secondary" : "text-text-muted/70",
              ].join(" ")}
            >
              {dict.nav.sections[s.key]}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}
