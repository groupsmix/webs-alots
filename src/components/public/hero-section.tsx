/* eslint-disable i18next/no-literal-string */
import { Award, Clock, Star, Stethoscope, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import type { TemplateDefinition } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { defaultWebsiteConfig } from "@/lib/website-config";

interface HeroOverrides {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

/** Hero layout, taken from the clinic's chosen template `heroStyle`. */
type HeroVariant = "split" | "centered" | "fullwidth" | "overlay" | "premium";

interface HeroSectionProps {
  overrides?: HeroOverrides;
  /** Layout variant from the template. Defaults to the classic split layout. */
  variant?: HeroVariant;
  /** Clinic template used for premium styling cues. */
  template?: TemplateDefinition;
}

export function HeroSection({ overrides, variant = "split", template }: HeroSectionProps) {
  const cfg = {
    ...defaultWebsiteConfig.hero,
    ...overrides,
  };
  const isPremium = variant === "premium" || template?.id === "premium";

  const ctas = (align: "center" | "start") => (
    <div
      className={cn(
        "mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3",
        align === "center" ? "justify-center" : "justify-center lg:justify-start",
      )}
    >
      <Link href="/book" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
        {cfg.ctaPrimary}
      </Link>
      <Link
        href="/services"
        className={buttonVariants({
          variant: "outline",
          size: "lg",
          className: "w-full sm:w-auto",
        })}
      >
        {cfg.ctaSecondary}
      </Link>
    </div>
  );

  if (isPremium) {
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
              {ctas("start")}

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

  // Centered / fullwidth / overlay all use a single stacked column. They
  // differ in background treatment and vertical rhythm.
  if (variant === "centered" || variant === "fullwidth" || variant === "overlay") {
    const bg =
      variant === "overlay"
        ? "bg-primary text-primary-foreground"
        : variant === "fullwidth"
          ? "bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
          : "bg-gradient-to-br from-primary/5 to-primary/10";
    const isOverlay = variant === "overlay";
    return (
      <section
        className={`relative ${bg} ${variant === "fullwidth" ? "py-20 sm:py-32" : "py-16 sm:py-24"}`}
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {cfg.title}
            </h1>
            <p
              className={`mx-auto mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg ${
                isOverlay ? "text-primary-foreground/80" : "text-muted-foreground"
              }`}
            >
              {cfg.subtitle}
            </p>
            {ctas("center")}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative bg-gradient-to-br from-primary/5 to-primary/10 py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-start">
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {cfg.title}
            </h1>
            <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground lg:mx-0">
              {cfg.subtitle}
            </p>
            {ctas("start")}
          </div>

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
                  {/* Background card */}
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

                  {/* Decorative circles */}
                  <circle cx="420" cy="60" r="40" className="fill-primary/5" />
                  <circle cx="80" cy="350" r="30" className="fill-primary/5" />

                  {/* Stethoscope icon */}
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

                  {/* Appointment card 1 */}
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

                  {/* Appointment card 2 */}
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

                  {/* Stats bar */}
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

                  {/* Floating pulse dot */}
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
