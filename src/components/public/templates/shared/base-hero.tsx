import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ClinicBranding } from "@/lib/data/public";
import { cn } from "@/lib/utils";
import { defaultWebsiteConfig } from "@/lib/website-config";

export interface HeroOverrides {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export type HeroVariant = "split" | "centered" | "fullwidth" | "overlay" | "minimal";

interface BaseHeroProps {
  branding: ClinicBranding;
  overrides?: HeroOverrides;
  variant?: HeroVariant;
  dark?: boolean;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function BaseHero({
  branding,
  overrides,
  variant = "split",
  dark = false,
  className,
  contentClassName,
  titleClassName,
  subtitleClassName,
}: BaseHeroProps) {
  const cfg = {
    ...defaultWebsiteConfig.hero,
    title: overrides?.title ?? branding.clinicName,
    subtitle: overrides?.subtitle ?? branding.tagline ?? defaultWebsiteConfig.hero.subtitle,
    imageUrl: overrides?.imageUrl ?? undefined,
  };

  const isCentered = variant === "centered" || variant === "minimal";
  const isFullwidth = variant === "fullwidth";
  const isOverlay = variant === "overlay";
  const isMinimal = variant === "minimal";

  const baseBg = dark
    ? "bg-gray-950 text-white"
    : isOverlay
      ? "bg-primary text-primary-foreground"
      : isMinimal
        ? "bg-transparent"
        : isFullwidth
          ? "bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
          : "bg-gradient-to-br from-primary/5 to-primary/10";

  const titleBase = isMinimal
    ? "text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl"
    : "text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl";

  const subtitleBase = dark
    ? "text-white/80"
    : isOverlay
      ? "text-primary-foreground/80"
      : "text-muted-foreground";

  const align = isCentered || isFullwidth || isOverlay ? "center" : "start";

  const primaryBtn = cn(
    buttonVariants({ size: "lg" }),
    "w-full sm:w-auto",
    (dark || isOverlay) && "bg-white text-primary hover:bg-white/90",
  );

  const secondaryBtn = cn(
    buttonVariants({ variant: "outline", size: "lg" }),
    "w-full sm:w-auto",
    dark && "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white",
    isOverlay && "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white",
  );

  const ctas = (
    <div
      className={cn(
        "mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3",
        align === "center" ? "justify-center" : "justify-center lg:justify-start",
      )}
    >
      <Link href="/book" data-event="cta-public-hero-primary" className={primaryBtn}>
        {cfg.ctaPrimary}
      </Link>
      <Link href="/services" data-event="cta-public-hero-secondary" className={secondaryBtn}>
        {cfg.ctaSecondary}
      </Link>
    </div>
  );

  const content = (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <h1 className={cn(titleBase, titleClassName)}>{cfg.title}</h1>
      {cfg.subtitle ? (
        <p
          className={cn(
            "mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg",
            align === "center" ? "mx-auto" : "lg:mx-0",
            subtitleBase,
            subtitleClassName,
          )}
        >
          {cfg.subtitle}
        </p>
      ) : null}
      {ctas}
    </div>
  );

  if (isCentered || isFullwidth || isOverlay) {
    return (
      <section
        className={cn(
          baseBg,
          isFullwidth ? "py-20 sm:py-32 lg:py-40" : isMinimal ? "py-12 sm:py-16" : "py-16 sm:py-24",
          className,
        )}
      >
        <div className={cn("container mx-auto px-4", contentClassName)}>
          <div className={cn("max-w-3xl mx-auto text-center", align === "center" && "mx-auto")}>
            {content}
          </div>
        </div>
      </section>
    );
  }

  // Split layout
  return (
    <section className={cn(baseBg, "py-16 sm:py-24", className)}>
      <div className={cn("container mx-auto px-4", contentClassName)}>
        <div className="grid items-center gap-10 lg:gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-start">{content}</div>

          <div className="hidden lg:flex justify-center">
            {cfg.imageUrl ? (
              <Image
                src={cfg.imageUrl}
                alt={cfg.title ? `Photo du cabinet ${cfg.title}` : "Cabinet médical"}
                width={500}
                height={384}
                className="rounded-2xl shadow-xl max-h-96 object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="relative h-80 w-full max-w-md" aria-hidden="true">
                <svg
                  viewBox="0 0 500 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-full w-full drop-shadow-xl"
                >
                  <rect
                    x="60"
                    y="30"
                    width="380"
                    height="340"
                    rx="24"
                    className="fill-background"
                    opacity="0.9"
                  />
                  <rect
                    x="60"
                    y="30"
                    width="380"
                    height="340"
                    rx="24"
                    className="stroke-primary/20"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <circle cx="420" cy="60" r="40" className="fill-primary/5" />
                  <circle cx="80" cy="350" r="30" className="fill-primary/5" />
                  <g transform="translate(200, 60)">
                    <circle cx="50" cy="50" r="42" className="fill-primary/10" />
                    <path
                      d="M35 35 C35 25, 45 20, 50 20 C55 20, 65 25, 65 35 L65 55"
                      className="stroke-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M35 35 L35 55"
                      className="stroke-primary"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="65"
                      r="10"
                      className="stroke-primary"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle cx="65" cy="58" r="3" className="fill-primary" />
                  </g>
                  <g transform="translate(95, 155)">
                    <rect width="310" height="60" rx="12" className="fill-primary/5" />
                    <rect x="12" y="12" width="36" height="36" rx="8" className="fill-primary/15" />
                    <rect x="18" y="22" width="24" height="2" rx="1" className="fill-primary" />
                    <rect x="18" y="28" width="24" height="2" rx="1" className="fill-primary" />
                    <rect x="18" y="34" width="14" height="2" rx="1" className="fill-primary" />
                    <rect x="60" y="16" width="120" height="8" rx="4" className="fill-primary/30" />
                    <rect x="60" y="32" width="80" height="6" rx="3" className="fill-primary/15" />
                    <rect x="240" y="20" width="56" height="22" rx="11" className="fill-primary" />
                    <text
                      x="268"
                      y="35"
                      textAnchor="middle"
                      className="fill-background"
                      fontSize="10"
                      fontWeight="600"
                    >
                      09:00
                    </text>
                  </g>
                  <g transform="translate(95, 230)">
                    <rect width="310" height="60" rx="12" className="fill-primary/5" />
                    <rect
                      x="12"
                      y="12"
                      width="36"
                      height="36"
                      rx="8"
                      className="fill-emerald-500/15"
                    />
                    <circle cx="30" cy="26" r="6" className="fill-emerald-500/40" />
                    <path
                      d="M24 36 C24 32 27 30 30 30 C33 30 36 32 36 36"
                      className="fill-emerald-500/40"
                    />
                    <rect x="60" y="16" width="100" height="8" rx="4" className="fill-primary/30" />
                    <rect x="60" y="32" width="60" height="6" rx="3" className="fill-primary/15" />
                    <rect
                      x="240"
                      y="20"
                      width="56"
                      height="22"
                      rx="11"
                      className="fill-emerald-500"
                    />
                    <text
                      x="268"
                      y="35"
                      textAnchor="middle"
                      className="fill-background"
                      fontSize="10"
                      fontWeight="600"
                    >
                      10:30
                    </text>
                  </g>
                  <g transform="translate(95, 310)">
                    <rect width="95" height="44" rx="10" className="fill-primary/10" />
                    <text
                      x="48"
                      y="22"
                      textAnchor="middle"
                      className="fill-primary"
                      fontSize="14"
                      fontWeight="700"
                    >
                      24
                    </text>
                    <text
                      x="48"
                      y="36"
                      textAnchor="middle"
                      className="fill-primary/60"
                      fontSize="8"
                    >
                      Patients
                    </text>
                    <rect
                      x="108"
                      y="0"
                      width="95"
                      height="44"
                      rx="10"
                      className="fill-emerald-500/10"
                    />
                    <text
                      x="155"
                      y="22"
                      textAnchor="middle"
                      className="fill-emerald-600"
                      fontSize="14"
                      fontWeight="700"
                    >
                      98%
                    </text>
                    <text
                      x="155"
                      y="36"
                      textAnchor="middle"
                      className="fill-emerald-600/60"
                      fontSize="8"
                    >
                      Satisfaction
                    </text>
                    <rect
                      x="215"
                      y="0"
                      width="95"
                      height="44"
                      rx="10"
                      className="fill-blue-500/10"
                    />
                    <text
                      x="263"
                      y="22"
                      textAnchor="middle"
                      className="fill-blue-600"
                      fontSize="14"
                      fontWeight="700"
                    >
                      15+
                    </text>
                    <text
                      x="263"
                      y="36"
                      textAnchor="middle"
                      className="fill-blue-600/60"
                      fontSize="8"
                    >
                      Services
                    </text>
                  </g>
                  <circle cx="390" cy="170" r="6" className="fill-emerald-500 animate-pulse" />
                  <circle
                    cx="390"
                    cy="170"
                    r="10"
                    className="stroke-emerald-500/30"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
