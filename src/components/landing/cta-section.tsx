import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-gray-900 py-20 sm:py-28">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Lancez votre cabinet en ligne d&egrave;s aujourd&apos;hui
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Rejoignez les professionnels de sant&eacute; qui simplifient la gestion de
            leur cabinet avec Oltigo.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-sm font-semibold text-gray-900 shadow-lg transition-all hover:bg-gray-100"
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-600 px-8 text-sm font-semibold text-gray-300 transition-all hover:border-gray-400 hover:text-white"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
