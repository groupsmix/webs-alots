"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeroProps } from "./index";

/**
 * Fullscreen hero — full viewport height with text overlay.
 *
 * Background image or video fills the entire viewport.
 * Text is centered over a dark overlay for readability.
 * Works well with bold and dark templates.
 */
export function HeroFullscreen({ clinicName, description, imageUrl, template }: HeroProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;

  return (
    <section className="relative flex min-h-[80vh] items-center justify-center" dir={isRtl ? "rtl" : undefined}>
      {/* Background image */}
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          className="object-cover"
          priority
          aria-hidden="true"
        />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center text-white">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          {clinicName}
        </h1>
        {description && (
          <p className="mt-6 text-lg text-white/80 md:text-xl">
            {description}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/book" className={buttonVariants({ size: "lg" })}>
            {t(locale, "public.bookAppointment")}
          </Link>
          <Link
            href="/services"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "border-white text-white hover:bg-white/10",
            })}
          >
            {t(locale, "public.services")}
          </Link>
        </div>
      </div>
    </section>
  );
}
