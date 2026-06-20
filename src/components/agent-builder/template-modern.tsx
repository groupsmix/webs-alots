"use client";

/* eslint-disable i18next/no-literal-string */

import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  Heart,
  Shield,
  Star,
} from "lucide-react";
import type { ClinicConfig } from "@/components/agent-builder/types";

interface TemplateModernProps {
  config: ClinicConfig;
}

export function TemplateModern({ config }: TemplateModernProps) {
  const [primary, secondary, accent, bg] = config.colors;

  return (
    <div className="overflow-hidden rounded-lg text-xs" style={{ backgroundColor: bg }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: primary, color: "#fff" }}
      >
        <span className="font-bold text-sm">{config.name || "Clinic Name"}</span>
        <nav className="hidden sm:flex gap-3 text-[10px]">
          <span>Home</span>
          <span>Services</span>
          <span>About</span>
          <span>Contact</span>
          <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: secondary }}>
            Book Now
          </span>
        </nav>
      </header>

      {/* Hero */}
      <section
        className="px-6 py-8 text-center"
        style={{
          background: `linear-gradient(135deg, ${primary}, ${secondary})`,
          color: "#fff",
        }}
      >
        <h1 className="text-lg font-bold">{config.name || "Your Clinic"}</h1>
        <p className="mt-1 text-[11px] opacity-90">
          {config.specialty || "Healthcare"} in {config.city || "Your City"}
        </p>
        <p className="mt-2 text-[10px] opacity-75">
          Professional healthcare services with modern facilities
        </p>
        <div
          className="mt-3 inline-block rounded-full px-4 py-1.5 text-[10px] font-medium"
          style={{ backgroundColor: accent, color: primary }}
        >
          <Calendar className="mr-1 inline h-3 w-3" />
          Book Appointment
        </div>
      </section>

      {/* Services */}
      <section className="px-4 py-5" style={{ backgroundColor: bg }}>
        <h2 className="mb-3 text-center text-sm font-semibold" style={{ color: primary }}>
          Our Services
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(config.services.length > 0
            ? config.services
            : ["Consultation", "Diagnosis", "Treatment", "Follow-up"]
          ).map((service) => (
            <div
              key={service}
              className="rounded-xl border p-2 text-center shadow-sm"
              style={{ borderColor: `${secondary}40` }}
            >
              <Stethoscope className="mx-auto mb-1 h-4 w-4" style={{ color: primary }} />
              <span className="text-[10px] font-medium">{service}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="px-4 py-4" style={{ backgroundColor: accent }}>
        <h2 className="mb-2 text-center text-sm font-semibold" style={{ color: primary }}>
          Why Choose Us
        </h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <Heart className="mx-auto h-4 w-4" style={{ color: primary }} />
            <p className="mt-0.5 text-[9px]">Patient Care</p>
          </div>
          <div>
            <Shield className="mx-auto h-4 w-4" style={{ color: primary }} />
            <p className="mt-0.5 text-[9px]">Certified</p>
          </div>
          <div>
            <Star className="mx-auto h-4 w-4" style={{ color: primary }} />
            <p className="mt-0.5 text-[9px]">5-Star Rated</p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-4 py-4">
        <h2 className="mb-2 text-center text-sm font-semibold" style={{ color: primary }}>
          Contact Us
        </h2>
        <div className="space-y-1.5 text-[10px] text-muted-foreground">
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
            Mon-Fri 9:00-18:00, Sat 9:00-13:00
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        suppressHydrationWarning
        className="px-4 py-2 text-center text-[9px]"
        style={{ backgroundColor: primary, color: "#fff", opacity: 0.9 }}
      >
        &copy; {new Date().getFullYear()} {config.name || "Clinic"} — Powered by Oltigo Health
      </footer>
    </div>
  );
}
