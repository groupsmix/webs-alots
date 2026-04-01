"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeroProps } from "./index";

/**
 * Slider hero — auto-rotating slides with transition.
 *
 * Displays multiple slides with a crossfade transition.
 * Falls back to a single slide if only one image is provided.
 * Auto-rotates every 5 seconds with manual prev/next controls.
 */
export function HeroSlider({ clinicName, description, imageUrl, slides, template }: HeroProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;

  // Build slide list from either `slides` prop or single imageUrl
  const slideList = slides && slides.length > 0
    ? slides
    : imageUrl
      ? [{ imageUrl, title: clinicName, description }]
      : [{ imageUrl: null, title: clinicName, description }];

  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slideList.length);
  }, [slideList.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slideList.length) % slideList.length);
  }, [slideList.length]);

  // Auto-rotate
  useEffect(() => {
    if (slideList.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [nextSlide, slideList.length]);

  const slide = slideList[currentSlide];

  return (
    <section className="relative min-h-[60vh] overflow-hidden" dir={isRtl ? "rtl" : undefined}>
      {/* Background image */}
      {slide && slide.imageUrl && (
        <Image
          src={slide.imageUrl}
          alt=""
          fill
          className="object-cover transition-opacity duration-700"
          priority={currentSlide === 0}
          aria-hidden="true"
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center px-4">
        <div className="mx-auto max-w-3xl text-center text-white">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {slide?.title || clinicName}
          </h1>
          {(slide?.description || description) && (
            <p className="mt-4 text-lg text-white/80 md:text-xl">
              {slide?.description || description}
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

      {/* Slide controls */}
      {slideList.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute top-1/2 left-4 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50 transition-colors min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute top-1/2 right-4 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white hover:bg-black/50 transition-colors min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>

          {/* Slide indicators */}
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {slideList.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all min-h-[8px] ${
                  index === currentSlide ? "w-8 bg-white" : "w-2 bg-white/50"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
