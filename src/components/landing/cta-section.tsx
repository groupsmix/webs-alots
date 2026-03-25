import Link from "next/link";

export function CtaSection() {
  return (
    <section className="bg-gray-900 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Lancez votre cabinet en ligne dès aujourd&apos;hui
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Rejoignez les professionnels de santé qui simplifient la gestion de
            leur cabinet avec Oltigo.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-8 text-sm font-semibold text-gray-900 shadow-lg transition-all hover:bg-gray-100"
            >
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
