"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Fonctionnalit\u00e9s", href: "#fonctionnalites" },
  { label: "Comment \u00e7a marche", href: "#comment-ca-marche" },
  { label: "D\u00e9mo", href: "#demo" },
] as const;

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-950/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            Oltigo
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900 sm:inline-flex"
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-full bg-gray-900 px-5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
          >
            Commencer gratuitement
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-gray-950/5 bg-white px-6 pb-5 pt-3 md:hidden">
          {navLinks.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="block rounded-xl px-3 py-3 text-[15px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </a>
          ))}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <Link
              href="/login"
              className="block rounded-xl px-3 py-3 text-[15px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 sm:hidden"
              onClick={() => setMobileOpen(false)}
            >
              Se connecter
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
