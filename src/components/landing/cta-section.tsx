import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gray-950 px-8 py-20 sm:px-16 sm:py-28">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/[0.07] blur-3xl" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/[0.07] blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
          </div>

          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.15]">
              Lancez votre cabinet en ligne
              <br className="hidden sm:block" />
              d&egrave;s aujourd&apos;hui
            </h2>
            <p className="mt-5 text-[17px] leading-relaxed text-gray-400">
              Rejoignez les professionnels de sant&eacute; qui simplifient la
              gestion de leur cabinet avec Oltigo.
            </p>
            <div className="mt-10">
              <Link
                href="/register"
                className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-white px-7 text-[15px] font-semibold text-gray-900 shadow-lg transition-all duration-200 hover:bg-gray-50 hover:shadow-xl"
              >
                Cr&eacute;er un compte gratuit
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-gray-500">
              Aucune carte de cr&eacute;dit requise
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
