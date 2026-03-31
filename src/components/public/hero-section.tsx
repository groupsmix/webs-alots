import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
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
                alt="Clinic"
                width={500}
                height={384}
                className="rounded-2xl shadow-xl max-h-96 object-cover"
              />
            ) : (
              <div className="relative h-80 w-full max-w-md" aria-hidden="true">
                <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full drop-shadow-xl">
                  {/* Background card */}
                  <rect x="60" y="30" width="380" height="340" rx="24" className="fill-background" opacity="0.9" />
                  <rect x="60" y="30" width="380" height="340" rx="24" className="stroke-primary/20" strokeWidth="1.5" fill="none" />

                  {/* Decorative circles */}
                  <circle cx="420" cy="60" r="40" className="fill-primary/5" />
                  <circle cx="80" cy="350" r="30" className="fill-primary/5" />

                  {/* Stethoscope icon */}
                  <g transform="translate(200, 60)">
                    <circle cx="50" cy="50" r="42" className="fill-primary/10" />
                    <path d="M35 35 C35 25, 45 20, 50 20 C55 20, 65 25, 65 35 L65 55" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M35 35 L35 55" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <circle cx="50" cy="65" r="10" className="stroke-primary" strokeWidth="2.5" fill="none" />
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
                    <text x="268" y="35" textAnchor="middle" className="fill-background" fontSize="10" fontWeight="600">09:00</text>
                  </g>

                  {/* Appointment card 2 */}
                  <g transform="translate(95, 230)">
                    <rect width="310" height="60" rx="12" className="fill-primary/5" />
                    <rect x="12" y="12" width="36" height="36" rx="8" className="fill-emerald-500/15" />
                    <circle cx="30" cy="26" r="6" className="fill-emerald-500/40" />
                    <path d="M24 36 C24 32 27 30 30 30 C33 30 36 32 36 36" className="fill-emerald-500/40" />
                    <rect x="60" y="16" width="100" height="8" rx="4" className="fill-primary/30" />
                    <rect x="60" y="32" width="60" height="6" rx="3" className="fill-primary/15" />
                    <rect x="240" y="20" width="56" height="22" rx="11" className="fill-emerald-500" />
                    <text x="268" y="35" textAnchor="middle" className="fill-background" fontSize="10" fontWeight="600">10:30</text>
                  </g>

                  {/* Stats bar */}
                  <g transform="translate(95, 310)">
                    <rect width="95" height="44" rx="10" className="fill-primary/10" />
                    <text x="48" y="22" textAnchor="middle" className="fill-primary" fontSize="14" fontWeight="700">24</text>
                    <text x="48" y="36" textAnchor="middle" className="fill-primary/60" fontSize="8">Patients</text>

                    <rect x="108" y="0" width="95" height="44" rx="10" className="fill-emerald-500/10" />
                    <text x="155" y="22" textAnchor="middle" className="fill-emerald-600" fontSize="14" fontWeight="700">98%</text>
                    <text x="155" y="36" textAnchor="middle" className="fill-emerald-600/60" fontSize="8">Satisfaction</text>

                    <rect x="215" y="0" width="95" height="44" rx="10" className="fill-blue-500/10" />
                    <text x="263" y="22" textAnchor="middle" className="fill-blue-600" fontSize="14" fontWeight="700">15+</text>
                    <text x="263" y="36" textAnchor="middle" className="fill-blue-600/60" fontSize="8">Services</text>
                  </g>

                  {/* Floating pulse dot */}
                  <circle cx="390" cy="170" r="6" className="fill-emerald-500 animate-pulse" />
                  <circle cx="390" cy="170" r="10" className="stroke-emerald-500/30" strokeWidth="2" fill="none" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
