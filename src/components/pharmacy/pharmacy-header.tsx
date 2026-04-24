"use client";

import { Menu, X, Pill } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

const navLinks = [
  { href: "/pharmacy", label: "Home" },
  { href: "/pharmacy/catalog", label: "Products" },
  { href: "/pharmacy/services", label: "Services" },
  { href: "/pharmacy/prescription-upload", label: "Upload Prescription" },
  { href: "/pharmacy/contact", label: "Contact" },
];

export function PharmacyHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/pharmacy" className="flex items-center gap-2 text-xl font-bold">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Pill className="h-4 w-4 text-white" />
          </div>
          <span>Pharmacie Centrale</span>
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
          <Link href="/pharmacy/prescription-upload" className={buttonVariants({ className: "bg-emerald-600 hover:bg-emerald-700" })}>
            Upload Prescription
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
              href="/pharmacy/prescription-upload"
              className={buttonVariants({ className: "mt-2 bg-emerald-600 hover:bg-emerald-700" })}
              onClick={() => setMobileMenuOpen(false)}
            >
              Upload Prescription
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
