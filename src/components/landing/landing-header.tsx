import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
          Oltigo
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#fonctionnalites" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
            Fonctionnalités
          </a>
          <a href="#comment-ca-marche" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
            Comment ça marche
          </a>
          <a href="#demo" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
            Démo
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 sm:inline-flex"
          >
            Connexion
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}
