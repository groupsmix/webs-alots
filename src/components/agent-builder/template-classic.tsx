"use client";

import { Calendar, Clock, Mail, MapPin, Phone, Stethoscope } from "lucide-react";
import type { ClinicConfig } from "@/components/agent-builder/types";

interface TemplateClassicProps {
  config: ClinicConfig;
}

export function TemplateClassic({ config }: TemplateClassicProps) {
  const [primary, secondary, , bg] = config.colors;

  return (
    <div className="overflow-hidden rounded-lg text-xs" style={{ backgroundColor: bg }}>
      {/* Header */}
      <header className="border-b-2 px-4 py-2" style={{ borderColor: primary }}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-serif text-sm font-bold" style={{ color: primary }}>
              {config.name || "Clinic Name"}
            </span>
            <p className="text-[9px] text-muted-foreground">
              {config.specialty || "Healthcare Services"}
            </p>
          </div>
          <nav className="hidden sm:flex gap-3 text-[10px] font-medium" style={{ color: primary }}>
            <span>Home</span>
            <span>Services</span>
            <span>About</span>
            <span>Contact</span>
            <span>Book</span>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b px-6 py-6 text-center" style={{ borderColor: `${primary}20` }}>
        <h1 className="font-serif text-lg font-bold" style={{ color: primary }}>
          {config.name || "Your Clinic"}
        </h1>
        <div className="mx-auto mt-1 h-0.5 w-12" style={{ backgroundColor: secondary }} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Trusted {config.specialty || "healthcare"} services in {config.city || "your city"}
        </p>
        <div
          className="mt-3 inline-block border-2 px-4 py-1.5 text-[10px] font-semibold"
          style={{ borderColor: primary, color: primary }}
        >
          Schedule a Visit
        </div>
      </section>

      {/* Services */}
      <section className="px-4 py-5">
        <h2
          className="mb-3 text-center font-serif text-sm font-semibold"
          style={{ color: primary }}
        >
          Our Services
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(config.services.length > 0
            ? config.services
            : ["Consultation", "Diagnosis", "Treatment", "Follow-up"]
          ).map((service) => (
            <div key={service} className="border-l-2 p-2" style={{ borderColor: secondary }}>
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-3 w-3" style={{ color: primary }} />
                <span className="text-[10px] font-medium">{service}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Operating Hours */}
      <section className="border-t px-4 py-4" style={{ borderColor: `${primary}20` }}>
        <h2
          className="mb-2 text-center font-serif text-sm font-semibold"
          style={{ color: primary }}
        >
          Operating Hours
        </h2>
        <div className="mx-auto max-w-[200px] space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span>Monday - Friday</span>
            <span className="font-medium">9:00 - 18:00</span>
          </div>
          <div className="flex justify-between">
            <span>Saturday</span>
            <span className="font-medium">9:00 - 13:00</span>
          </div>
          <div className="flex justify-between">
            <span>Sunday</span>
            <span className="text-muted-foreground">Closed</span>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t px-4 py-4" style={{ borderColor: `${primary}20` }}>
        <h2
          className="mb-2 text-center font-serif text-sm font-semibold"
          style={{ color: primary }}
        >
          Contact Information
        </h2>
        <div className="mx-auto max-w-[200px] space-y-1.5 text-[10px]">
          {config.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" style={{ color: primary }} />
              {config.phone}
            </div>
          )}
          {config.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" style={{ color: primary }} />
              {config.email}
            </div>
          )}
          {config.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" style={{ color: primary }} />
              {config.city}, Morocco
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" style={{ color: primary }} />
            <Calendar className="h-3 w-3" style={{ color: primary }} />
            Online booking available
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-2 text-center text-[9px] text-muted-foreground">
        &copy; 2025 {config.name || "Clinic"} — Powered by Oltigo Health
      </footer>
    </div>
  );
}
