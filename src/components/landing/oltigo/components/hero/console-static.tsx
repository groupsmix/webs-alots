"use client";

import { useI18n } from "../../i18n/context";
import { AgendaFace, DossierFace, WhatsappFace } from "./faces";

/**
 * High-quality static fallback for <768px and prefers-reduced-motion:
 * a tidy, layered stagger of the three faces — each fully readable, with a
 * soft contact shadow. No looping motion.
 */
export function ConsoleStatic() {
  const { dict } = useI18n();
  return (
    <div className="relative mx-auto w-full max-w-[330px] py-4">
      {/* matte floor contact shadow */}
      <div
        className="absolute -bottom-2 left-1/2 h-10 w-[70%] -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.7), transparent 70%)" }}
        aria-hidden
      />
      <div className="relative flex flex-col items-stretch">
        <div className="relative z-30 self-end" style={{ transform: "rotate(-1.2deg)" }}>
          <AgendaFace />
        </div>
        <div className="relative z-20 -mt-6 self-start" style={{ transform: "rotate(1.1deg)" }}>
          <DossierFace dict={dict} />
        </div>
        <div className="relative z-10 -mt-6 self-end" style={{ transform: "rotate(-0.8deg)" }}>
          <WhatsappFace dict={dict} />
        </div>
      </div>
    </div>
  );
}
