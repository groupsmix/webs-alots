import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pb-20 pt-16 sm:pb-28 sm:pt-24">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-blue-50/60 to-transparent" />
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-blue-100/30 blur-3xl" />
        <div className="absolute left-0 top-40 h-[300px] w-[300px] rounded-full bg-indigo-100/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            La plateforme complète pour gérer votre{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              cabinet médical
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Créez le site de votre cabinet, gérez les rendez-vous et
            développez votre activité facilement.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-gray-900 px-8 text-sm font-semibold text-white shadow-lg shadow-gray-900/20 transition-all hover:bg-gray-800 hover:shadow-xl sm:w-auto"
            >
              Commencer maintenant
            </Link>
            <a
              href="#comment-ca-marche"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-8 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
            >
              Voir comment ça marche
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
