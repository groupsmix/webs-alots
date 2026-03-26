import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-white pb-28 pt-24 sm:pb-40 sm:pt-36">
      {/* Layered background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]" />
        <div className="absolute right-0 top-0 h-[600px] w-[600px] -translate-y-1/4 translate-x-1/4 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-gradient-to-tr from-slate-50 to-blue-50/60 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Pill badge */}
          <div className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white px-4 py-2 text-[13px] font-medium text-gray-600 shadow-sm shadow-gray-950/[0.03]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Plateforme SaaS pour professionnels de sant&eacute;
          </div>

          <h1 className="text-[2.5rem] font-bold leading-[1.08] tracking-tight text-gray-950 sm:text-[3.5rem] lg:text-[4rem]">
            La plateforme compl&egrave;te pour{" "}
            <br className="hidden sm:block" />
            g&eacute;rer votre{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              cabinet m&eacute;dical
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-[17px] leading-relaxed text-gray-500 sm:text-lg">
            Cr&eacute;ez le site de votre cabinet, g&eacute;rez les rendez-vous
            et d&eacute;veloppez votre activit&eacute; &mdash; simplement.
          </p>

          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/register"
              className="group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-gray-900 px-7 text-[15px] font-semibold text-white shadow-lg shadow-gray-900/25 transition-all duration-200 hover:bg-gray-800 hover:shadow-xl hover:shadow-gray-900/30 sm:w-auto"
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#comment-ca-marche"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-gray-200 bg-white px-7 text-[15px] font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm sm:w-auto"
            >
              Voir comment &ccedil;a marche
            </a>
          </div>

          {/* Social proof nudge */}
          <div className="mt-16 flex items-center justify-center gap-3">
            <div className="flex -space-x-2">
              {[
                "bg-blue-100 text-blue-700",
                "bg-emerald-100 text-emerald-700",
                "bg-amber-100 text-amber-700",
                "bg-violet-100 text-violet-700",
              ].map((colors, i) => (
                <div
                  key={i}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white ${colors}`}
                >
                  <span className="text-xs font-bold">
                    {["Dr", "Me", "Cl", "Dr"][i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-gray-400">
              Utilis&eacute; par des professionnels de sant&eacute;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
