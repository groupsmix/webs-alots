"use client";

/* eslint-disable i18next/no-literal-string */

import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ClinicConfig } from "@/components/agent-builder/types";

interface TemplateMinimalProps {
  config: ClinicConfig;
}

export function TemplateMinimal({ config }: TemplateMinimalProps) {
  const [primary] = config.colors;

  return (
    <div className="overflow-hidden rounded-lg bg-white text-xs dark:bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-light tracking-wide" style={{ color: primary }}>
          {config.name || "Clinic Name"}
        </span>
        <nav className="hidden sm:flex gap-4 text-[10px] text-zinc-500">
          <span>Home</span>
          <span>Services</span>
          <span>Contact</span>
          <span className="font-medium" style={{ color: primary }}>
            Book
          </span>
        </nav>
      </header>

      <div className="mx-4 border-t border-zinc-200 dark:border-zinc-800" />

      {/* Hero */}
      <section className="px-6 py-10 text-center">
        <h1 className="text-lg font-light tracking-tight text-zinc-900 dark:text-zinc-100">
          {config.name || "Your Clinic"}
        </h1>
        <p className="mt-1 text-[11px] text-zinc-500">
          {config.specialty || "Healthcare"} &middot; {config.city || "City"}
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 text-[10px] font-medium"
          style={{ color: primary }}
        >
          Book an appointment <ArrowRight className="h-3 w-3" />
        </button>
      </section>

      <div className="mx-4 border-t border-zinc-200 dark:border-zinc-800" />

      {/* Services */}
      <section className="px-6 py-5">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          Services
        </h2>
        <div className="space-y-2">
          {(config.services.length > 0
            ? config.services
            : ["Consultation", "Diagnosis", "Treatment", "Follow-up"]
          ).map((service) => (
            <div
              key={service}
              className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800"
            >
              <span className="text-[10px] text-zinc-700 dark:text-zinc-300">{service}</span>
              <ArrowRight className="h-3 w-3 text-zinc-400" />
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="px-6 py-5">
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          Contact
        </h2>
        <div className="space-y-2 text-[10px] text-zinc-600 dark:text-zinc-400">
          {config.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {config.phone}
            </div>
          )}
          {config.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              {config.email}
            </div>
          )}
          {config.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              {config.city}, Morocco
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Mon-Fri 9:00-18:00
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 px-4 py-2 text-center text-[9px] text-zinc-400 dark:border-zinc-800">
        {config.name || "Clinic"} — Powered by Oltigo Health
      </footer>
    </div>
  );
}
