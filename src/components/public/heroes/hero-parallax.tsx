"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeroProps } from "./index";

/**
 * Parallax hero — parallax scrolling background.
 *
 * Background image moves at a slower rate than the content,
 * creating a depth effect. Text is centered over the image.
 * Works best with elegant and luxury templates.
 */
export function HeroParallax({ clinicName, description, imageUrl, template }: HeroProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Only apply parallax when the section is in view
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          setOffsetY(window.scrollY * 0.4);
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[70vh] overflow-hidden"
      dir={isRtl ? "rtl" : undefined}
    >
      {/* Parallax background */}
      {imageUrl && (
        <div
          className="absolute inset-0 -top-20"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            priority
            aria-hidden="true"
          />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex min-h-[70vh] items-center justify-center px-4">
        <div className="mx-auto max-w-3xl text-center text-white">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
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
      </div>
    </section>
  );
}
