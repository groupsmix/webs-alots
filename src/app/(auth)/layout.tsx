import {
  CalendarCheck,
  FileText,
  CreditCard,
  ShieldCheck,
  Activity,
  HeartPulse,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { t, type Locale } from "@/lib/i18n";

/* eslint-disable i18next/no-literal-string -- static French marketing copy for hero panel */

const HERO_FEATURES = [
  {
    icon: CalendarCheck,
    title: "Gestion des rendez-vous",
    desc: "Planifiez et suivez tous vos rendez-vous en un seul endroit.",
  },
  {
    icon: FileText,
    title: "Dossiers patients",
    desc: "Accédez aux dossiers médicaux de manière sécurisée et conforme.",
  },
  {
    icon: CreditCard,
    title: "Facturation simplifiée",
    desc: "Gérez les paiements, assurances et factures facilement.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité & conformité",
    desc: "Conforme à la Loi 09-08 et au RGPD pour la protection des données.",
  },
];

// Auth pages (login/register/forgot-password/onboarding/setup-2fa) must not
// be indexed by search engines. The post-deploy smoke test (Audit Task 17 —
// Layer 6) asserts that /login and /register carry either an
// `<meta name="robots" content="…noindex…">` tag or an `X-Robots-Tag` header.
// Next.js's metadata.robots from this shared server layout is the cleanest
// way to emit the meta tag for every auth route at once.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = "fr";

  return (
    <div className="flex min-h-screen bg-muted/50">
      {/* F-5: No skip link here. The root layout already renders the single
          "skip to content" link, and on auth pages it targets #main-content
          below (the form). A second skip link caused a WCAG 2.4.1 ambiguity
          (two "Aller au…" targets) on /login/. */}

      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="relative hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#005a3b] via-[#00795a] to-[#009e74] text-white">
        {/* Looping background video (decorative). The container gradient acts as
            a fallback while the video loads or if autoplay is blocked. */}
        <video
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover motion-reduce:hidden"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>
        {/* Brand tint over the video: light enough to let the loop show
            clearly, with a stronger bottom scrim so the white text and
            feature copy stay legible over the brighter video frames. */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-[#005a3b]/45 via-[#00795a]/30 to-[#009e74]/45" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />

        {/* Decorative background shapes */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/[0.06]" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/[0.04]" />
          <div className="absolute top-1/2 right-10 h-48 w-48 rounded-full bg-white/[0.05]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center flex-1 px-10 xl:px-12 py-12">
          {/* Brand lockup */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <HeartPulse className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Oltigo Health</h1>
                <p className="text-xs font-medium text-white/70 tracking-wide uppercase">
                  Plateforme santé
                </p>
              </div>
            </div>
            <p className="text-lg leading-relaxed text-white/85 max-w-sm">
              La plateforme tout-en-un pour la gestion de votre cabinet médical au Maroc.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="space-y-5">
            {HERO_FEATURES.map((feat) => (
              <div key={feat.title} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <feat.icon className="h-4.5 w-4.5 text-white/90" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/95">{feat.title}</p>
                  <p className="text-xs leading-relaxed text-white/65">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative bottom */}
        <div className="relative z-10 border-t border-white/10 px-10 xl:px-12 py-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-white/50" />
            <p className="text-xs text-white/50">
              Utilisé par des professionnels de santé à travers le Maroc
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col">
        <header className="border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {/* Mobile-only brand mark */}
              <span className="lg:hidden flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                <span className="font-bold text-foreground">Oltigo Health</span>
              </span>
              <span className="hidden lg:inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                {t(locale, "nav.backToHome")}
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div
          id="main-content"
          className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8"
        >
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
