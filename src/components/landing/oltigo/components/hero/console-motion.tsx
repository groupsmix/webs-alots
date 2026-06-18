"use client";

import { useEffect, useRef } from "react";
import { AgendaFace, DossierFace, WhatsappFace } from "./faces";

/**
 * The Oltigo Console — a precision-machined stack of three floating face-cards
 * rendered as crisp DOM in CSS 3D, driven by a single rAF loop:
 *   · assemble (slide + settle, ease-out, 80ms stagger, no bounce)
 *   · anchored sway (±2° Y / ±1° X, ~20s) — held instrument, never a turntable
 *   · per-layer breathing (own rhythm, never in unison)
 *   · auto-explode focus loop (one layer steps forward, others recede + blur)
 *   · cursor parallax on top (max ~3° tilt)
 * Honors prefers-reduced-motion by settling into one composed static shot.
 */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const EXPLODE_PERIOD = 5.2;
const explodeEnv = (localT: number) =>
  smoothstep(0.12, 0.42, localT) * (1 - smoothstep(0.58, 0.9, localT));

type Layer = { ox: number; oy: number; oz: number; rate: number; phase: number };
const LAYERS: Layer[] = [
  { ox: 78, oy: -150, oz: 70, rate: 0.62, phase: 0 }, // 01 agenda
  { ox: -8, oy: 8, oz: 0, rate: 0.52, phase: 2.1 }, // 02 dossier
  { ox: -74, oy: 168, oz: -46, rate: 0.74, phase: 4.0 }, // 03 whatsapp
];

export function ConsoleMotion({ onFocus }: { onFocus?: (i: number) => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const lastShown = useRef(-2);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const apply = (
      el: HTMLDivElement,
      L: Layer,
      a: number,
      by: number,
      ez: number,
      ey: number,
      scale: number,
      opacity: number,
      blur: number,
    ) => {
      const assembleY = (1 - a) * 46;
      el.style.transform =
        `translate(-50%, -50%) ` +
        `translate3d(${L.ox}px, ${L.oy + by + ey + assembleY}px, ${L.oz + ez}px) ` +
        `scale(${scale})`;
      el.style.opacity = String(opacity * a);
      el.style.filter = blur > 0.02 ? `blur(${blur}px)` : "none";
      el.style.zIndex = String(200 + Math.round(L.oz + ez));
    };

    // Composed static state for reduced-motion (no loop).
    if (reduce) {
      LAYERS.forEach((L, i) => {
        const el = cards.current[i];
        if (el) apply(el, L, 1, 0, 0, 0, 1, 1, 0);
      });
      onFocus?.(-1);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const st = stage.current;

      // anchored sway + cursor parallax (max ~3°)
      if (st) {
        const swayY = Math.sin(t * 0.31) * 2; // deg
        const swayX = Math.sin(t * 0.23) * 1;
        const tiltY = pointer.current.x * 3;
        const tiltX = -pointer.current.y * 3;
        st.style.transform = `rotateX(${swayX + tiltX}deg) rotateY(${swayY + tiltY}deg)`;
      }

      const idx = Math.floor(t / EXPLODE_PERIOD) % 3;
      const env = explodeEnv((t % EXPLODE_PERIOD) / EXPLODE_PERIOD);

      LAYERS.forEach((L, i) => {
        const el = cards.current[i];
        if (!el) return;
        const a = easeOutCubic(clamp01((t - i * 0.08) / 0.9));
        const by = Math.sin(t * L.rate + L.phase) * 7;
        let ez = 0;
        let ey = 0;
        let scale = 1;
        let opacity = 1;
        let blur = 0;
        if (i === idx) {
          ez = env * 90;
          scale = 1 + env * 0.06;
        } else {
          ez = -env * 60;
          ey = (i < idx ? -1 : 1) * env * 34;
          opacity = 1 - env * 0.5;
          scale = 1 - env * 0.03;
          blur = env * 3;
        }
        apply(el, L, a, by, ez, ey, scale, opacity, blur);
      });

      // report focused layer for the caption overlay (only on change)
      const shown = env > 0.28 ? idx : -1;
      if (shown !== lastShown.current) {
        lastShown.current = shown;
        onFocus?.(shown);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onFocus]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    };
  };
  const onLeave = () => {
    pointer.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="relative mx-auto h-[520px] w-full max-w-[440px]"
      style={{ perspective: "1500px" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* matte floor contact shadow */}
      <div
        className="absolute bottom-4 left-1/2 h-12 w-[70%] -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.75), transparent 70%)" }}
        aria-hidden
      />
      <div
        ref={stage}
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d", willChange: "transform" }}
      >
        {[<AgendaFace key="a" />, <DossierFace key="d" />, <WhatsappFace key="w" />].map((face, i) => (
          <div
            key={i}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="absolute left-1/2 top-1/2"
            style={{ transformStyle: "preserve-3d", willChange: "transform, opacity, filter" }}
          >
            {face}
          </div>
        ))}
      </div>
    </div>
  );
}
