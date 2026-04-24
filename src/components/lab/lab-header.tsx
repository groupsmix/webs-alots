"use client";

import { Menu, X, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

const navLinks = [
  { href: "/lab", label: "Home" },
  { href: "/lab/tests", label: "Tests & Exams" },
  { href: "/lab/my-results", label: "Results" },
  { href: "/lab/collection-points", label: "Collection Points" },
  { href: "/lab/contact", label: "Contact" },
];

export function LabHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/lab" className="flex items-center gap-2 text-xl font-bold">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FlaskConical className="h-4 w-4 text-white" />
          </div>
          <span>Laboratoire Central</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/lab/my-results" className={buttonVariants({ className: "bg-blue-600 hover:bg-blue-700" })}>
            Access Results
          </Link>
        </nav>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/lab/my-results"
              className={buttonVariants({ className: "mt-2 bg-blue-600 hover:bg-blue-700" })}
              onClick={() => setMobileMenuOpen(false)}
            >
              Access Results
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
