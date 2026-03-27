import Link from "next/link";
import {
  CalendarCheck,
  Users,
  Globe,
  ArrowRight,
} from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pb-24 pt-20 sm:pb-32 sm:pt-28">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-transparent" />
        <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute -left-20 top-40 h-[400px] w-[400px] rounded-full bg-indigo-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-violet-50/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-1.5 text-sm font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Plateforme SaaS pour professionnels de sant&eacute;
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            La plateforme compl&egrave;te pour g&eacute;rer votre{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              cabinet m&eacute;dical
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Cr&eacute;ez le site de votre cabinet, g&eacute;rez les rendez-vous et
            d&eacute;veloppez votre activit&eacute; facilement.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-xl sm:w-auto"
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#comment-ca-marche"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-8 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
            >
              Voir comment &ccedil;a marche
            </a>
          </div>

          {/* Floating feature pills */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: CalendarCheck, text: "Rendez-vous en ligne" },
              { icon: Users, text: "Gestion patients" },
              { icon: Globe, text: "Site web inclus" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm"
              >
                <Icon className="h-4 w-4 text-gray-400" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
