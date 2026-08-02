"use client";

import { Reveal } from "@/components/landing/oltigo/components/primitives/reveal";
import { useI18n } from "@/components/landing/oltigo/i18n/context";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-kit";

function getInitials(name: string): string {
  const parts = name
    .replace(/^(dr\.?|doctor|med\.?)\s*/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Testimonials() {
  const { dict } = useI18n();
  return (
    <section className="relative border-b border-hairline py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading eyebrow={dict.testimonials.eyebrow} title={dict.testimonials.title} />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {dict.testimonials.items.map((t, i) => (
            <Reveal key={t.name} delay={i * 90}>
              <figure className="panel flex h-full flex-col justify-between rounded-2xl p-6">
                <blockquote className="text-[15px] leading-relaxed text-text">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-7 flex items-center gap-3 border-t border-hairline pt-5">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-surface text-[12.5px] font-medium text-text",
                    )}
                  >
                    {t.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      getInitials(t.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-text">{t.name}</p>
                    <p className="truncate text-[12px] text-text-muted">
                      {t.role}
                      {t.clinic ? ` · ${t.clinic}` : ""} · {t.city}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
