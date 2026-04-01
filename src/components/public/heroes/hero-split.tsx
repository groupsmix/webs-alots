"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { HeroProps } from "./index";

/**
 * Split hero — text on one side, image on the other.
 *
 * The default hero layout. Text content on the left (or right in RTL),
 * with a large image on the opposite side. Responsive: stacks vertically on mobile.
 */
export function HeroSplit({ clinicName, description, imageUrl, template }: HeroProps) {
  const [locale] = useLocale();
  const isRtl = template?.rtl ?? false;

  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className={`flex flex-col items-center gap-8 md:flex-row ${isRtl ? "md:flex-row-reverse" : ""}`}>
        {/* Text content */}
        <div className="flex-1 space-y-6 text-center md:text-start">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {clinicName}
          </h1>
          {description && (
            <p className="text-lg text-muted-foreground md:text-xl">
              {description}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Link href="/book" className={buttonVariants({ size: "lg" })}>
              {t(locale, "public.bookAppointment")}
            </Link>
            <Link href="/services" className={buttonVariants({ variant: "outline", size: "lg" })}>
              {t(locale, "public.services")}
            </Link>
          </div>
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="flex-1">
            <Image
              src={imageUrl}
              alt={clinicName}
              width={600}
              height={400}
              className="rounded-xl object-cover shadow-lg"
              priority
            />
          </div>
        )}
      </div>
    </section>
  );
}
