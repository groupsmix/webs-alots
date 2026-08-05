/* eslint-disable i18next/no-literal-string */
import { Award, Clock, Star, Stethoscope, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ClinicBranding } from "@/lib/data/public";
import { defaultWebsiteConfig } from "@/lib/website-config";

interface PremiumHeroProps {
  branding: ClinicBranding;
}

export function PremiumHero({ branding }: PremiumHeroProps) {
  const websiteHero = (
    branding.websiteConfig as { hero?: { title?: string; subtitle?: string } } | null
  )?.hero;
  const cfg = {
    ...defaultWebsiteConfig.hero,
    title: websiteHero?.title ?? branding.clinicName,
    subtitle: websiteHero?.subtitle ?? branding.tagline ?? defaultWebsiteConfig.hero.subtitle,
    ctaPrimary: defaultWebsiteConfig.hero.ctaPrimary,
    ctaSecondary: defaultWebsiteConfig.hero.ctaSecondary,
    imageUrl: branding.heroImageUrl ?? branding.coverPhotoUrl ?? undefined,
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-primary/10 pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Soft floating background blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -left-24 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:gap-16 lg:grid-cols-2">
          <div className="text-center lg:text-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm mb-6">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              <span>4.9/5 de satisfaction patient</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {cfg.title}
            </h1>
            <p className="mx-auto mt-5 sm:mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground lg:mx-0">
              {cfg.subtitle}
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <Link
                href="/book"
                data-event="cta-public-hero-primary"
                className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
              >
                {cfg.ctaPrimary}
              </Link>
              <Link
                href="/services"
                data-event="cta-public-hero-secondary"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                {cfg.ctaSecondary}
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-8 sm:mt-10 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              {[
                { icon: Award, label: "15+ ans", sub: "d'expérience" },
                { icon: Users, label: "5000+", sub: "patients soignés" },
                { icon: Clock, label: "Rappels", sub: "WhatsApp" },
              ].map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.label}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-bold">{badge.label}</p>
                      <p className="text-xs text-muted-foreground">{badge.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hero image / visual */}
          <div className="relative mx-auto max-w-lg lg:max-w-none">
            <div className="relative rounded-[2rem] bg-gradient-to-br from-primary/20 to-secondary/20 p-2 shadow-2xl">
              {cfg.imageUrl ? (
                <Image
                  src={cfg.imageUrl}
                  alt={cfg.title ? `Photo du cabinet ${cfg.title}` : "Cabinet médical"}
                  width={600}
                  height={500}
                  className="rounded-[1.75rem] h-80 sm:h-96 w-full object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="flex h-80 sm:h-96 items-center justify-center rounded-[1.75rem] bg-card">
                  <Stethoscope className="h-24 w-24 text-primary/40" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Floating stat cards */}
            <div className="absolute -left-4 top-8 hidden sm:flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold">5000+</p>
                <p className="text-xs text-muted-foreground">patients</p>
              </div>
            </div>
            <div className="absolute -right-4 bottom-12 hidden sm:flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-600">
                <Star className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold">4.9/5</p>
                <p className="text-xs text-muted-foreground">avis vérifiés</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
