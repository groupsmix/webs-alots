import Link from "next/link";

const links = [
  { label: "\u00c0 propos", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Connexion", href: "/login" },
  { label: "Confidentialit\u00e9", href: "/privacy" },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-gray-950/[0.04] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                <span className="text-sm font-bold text-white">O</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-gray-900">
                Oltigo
              </span>
            </Link>
            <p className="mt-4 text-[14px] leading-relaxed text-gray-400">
              La plateforme tout-en-un pour les professionnels de sant&eacute;.
            </p>
          </div>

          {/* Nav */}
          <nav className="flex flex-wrap gap-x-10 gap-y-3">
            {links.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-[14px] text-gray-400 transition-colors duration-150 hover:text-gray-900"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 border-t border-gray-950/[0.04] pt-8 text-[13px] text-gray-300">
          &copy; {new Date().getFullYear()} Oltigo. Tous droits
          r&eacute;serv&eacute;s.
        </div>
      </div>
    </footer>
  );
}
