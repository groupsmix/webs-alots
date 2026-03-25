"use client";

import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { clinicConfig } from "@/config/clinic.config";
import { defaultWebsiteConfig } from "@/lib/website-config";

export function HeroSection() {
  const cfg = defaultWebsiteConfig.hero;

  return (
    <section className="relative bg-gradient-to-br from-primary/5 to-primary/10 py-24">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {cfg.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground lg:mx-0">
              {cfg.subtitle}
            </p>
            <div className="mt-10 flex items-center justify-center gap-4 lg:justify-start">
              <Link href="/book" className={buttonVariants({ size: "lg" })}>
                {cfg.ctaPrimary}
              </Link>
              <Link
                href="/services"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {cfg.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            {cfg.imageUrl ? (
              <Image
                src={cfg.imageUrl}
                alt={clinicConfig.name}
                width={500}
                height={384}
                className="rounded-2xl shadow-xl max-h-96 object-cover"
              />
            ) : (
              <div className="flex h-80 w-full max-w-md items-center justify-center rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5">
                <div className="text-center text-muted-foreground">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">Photo du médecin</p>
                  <p className="text-xs mt-1">Configurable via l&apos;éditeur</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
