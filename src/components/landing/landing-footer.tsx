import Link from "next/link";

const links = [
  { label: "À propos", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Connexion", href: "/login" },
  { label: "Confidentialité", href: "/privacy" },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-100 bg-white py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-gray-900"
          >
            Oltigo
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-6">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Oltigo. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
