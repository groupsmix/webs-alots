"use client";

import { useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { Button } from "@/components/landing/oltigo/components/ui/button";
import { Eyebrow } from "./section-kit";

type Status = "idle" | "submitting" | "success" | "error";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "212600000000";

export function CtaDemo() {
  const { dict } = useI18n();
  const c = dict.cta;
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("submitting");
    // TODO(lead-capture): persist this lead for real. Add a POST route under
    // /api, register it in PUBLIC_API_ROUTES (src/middleware.ts is deny-by-
    // default for /api/*), then insert into Supabase. For now we acknowledge
    // client-side and steer prospects to the WhatsApp channel above — this
    // mirrors the upstream oltigo-landing, which shipped a no-op stub.
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    setStatus("success");
    form.reset();
  }

  const fields = [
    { id: "clinic", type: "text", autoComplete: "organization" },
    { id: "doctor", type: "text", autoComplete: "name" },
    { id: "phone", type: "tel", autoComplete: "tel" },
    { id: "email", type: "email", autoComplete: "email" },
    { id: "city", type: "text", autoComplete: "address-level2" },
  ] as const;

  return (
    <section id="demo" className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl items-start gap-12 px-6 lg:grid-cols-2 lg:gap-20">
        {/* pitch */}
        <div className="lg:sticky lg:top-28">
          <Reveal>
            <Eyebrow>{c.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.8rem)] text-text">{c.title}</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-text-secondary">{c.sub}</p>
          </Reveal>
          <Reveal delay={180}>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2.5 rounded-[10px] border border-hairline bg-surface/40 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:border-emerald/50 hover:text-text"
            >
              <MessageCircle className="size-4 text-emerald" strokeWidth={1.75} aria-hidden />
              {c.whatsapp}
            </a>
          </Reveal>
        </div>

        {/* form */}
        <Reveal delay={80}>
          <form onSubmit={onSubmit} className="panel rounded-2xl p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <label
                  key={f.id}
                  className={f.id === "clinic" || f.id === "doctor" ? "sm:col-span-2" : ""}
                >
                  <span className="telemetry mb-1.5 block text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
                    {c.fields[f.id]}
                  </span>
                  <input
                    name={f.id}
                    type={f.type}
                    autoComplete={f.autoComplete}
                    required={f.id !== "city"}
                    placeholder={c.placeholders[f.id]}
                    className="h-11 w-full rounded-[10px] border border-hairline bg-ink px-3.5 text-[14px] text-text placeholder:text-text-muted/70 transition-colors focus:border-emerald focus:outline-none"
                  />
                </label>
              ))}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-6 w-full"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? c.submitting : c.submit}
              {status !== "submitting" && <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.75} />}
            </Button>

            <p
              aria-live="polite"
              className="mt-3 min-h-[1.25rem] text-[12.5px]"
              style={{
                color:
                  status === "success"
                    ? "var(--color-emerald)"
                    : status === "error"
                      ? "#e08a7a"
                      : "var(--color-text-muted)",
              }}
            >
              {status === "success" ? c.success : status === "error" ? c.error : c.consent}
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
