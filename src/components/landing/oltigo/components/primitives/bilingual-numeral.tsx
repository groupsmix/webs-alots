"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EASTERN: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
  ",": "٫",
  ".": "٫",
};

function toEastern(value: string): string {
  return value.replace(/[0-9.,]/g, (c) => EASTERN[c] ?? c);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Props = {
  /** Western-format source string, e.g. "99,95" or "200". */
  value: string;
  className?: string;
  /** Per-digit stagger in ms. */
  stagger?: number;
};

/**
 * Bilingual living numeral. Renders Eastern Arabic numerals first (٩٩٫٩٥),
 * then morphs digit-by-digit into Western (99,95) on reveal. Under
 * prefers-reduced-motion it renders Western immediately.
 */
export function BilingualNumeral({ value, className, stagger = 70 }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    if (prefersReducedMotion()) {
      timeouts.push(
        setTimeout(() => {
          setResolved(true);
        }, 0),
      );

      return () => {
        timeouts.forEach((t) => clearTimeout(t));
      };
    }

    const el = ref.current;

    if (!el)
      return () => {
        timeouts.forEach((t) => clearTimeout(t));
      };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Brief beat so the Eastern form is legible before it resolves.
            window.setTimeout(() => setResolved(true), 240);
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    // Failsafe: never leave a numeral stuck in Eastern form if it is never
    // scrolled to the required ratio (e.g. very short viewports).
    const failsafe = window.setTimeout(() => setResolved(true), 6000);

    return () => {
      timeouts.forEach((t) => clearTimeout(t));

      (() => {
        io.disconnect();
        window.clearTimeout(failsafe);
      })();
    };
  }, []);

  const chars = value.split("");
  const isMorphable = (c: string) => /[0-9.,]/.test(c);
  // Per-digit stagger ordinal, computed without render-phase mutation:
  // the number of morphable characters before position i.
  const digitOrdinal = (i: number) => chars.slice(0, i).filter(isMorphable).length;

  return (
    <span ref={ref} className={cn("telemetry tabular-nums", className)} aria-label={value}>
      {chars.map((c, i) => {
        if (!isMorphable(c)) {
          return (
            <span key={i} aria-hidden="true">
              {c}
            </span>
          );
        }
        const delay = digitOrdinal(i) * stagger;
        return (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transitionDelay: `${delay}ms` }}
          >
            {resolved ? c : toEastern(c)}
          </span>
        );
      })}
    </span>
  );
}
