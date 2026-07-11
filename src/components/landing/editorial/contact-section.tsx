"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { HairlineRule } from "./hairline-rule";

/**
 * Contact / Demo request section.
 * Simple form: clinic name, doctor name, phone, email, city.
 * On submit: opens WhatsApp or mailto link.
 */
export function ContactSection() {
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = encodeURIComponent(
      `Bonjour, je suis ${doctorName} du ${clinicName} à ${city}. Je souhaite une démonstration d'Oltigo. Email: ${email}, Tél: ${phone}`,
    );
    window.open(`https://wa.me/212600000000?text=${message}`, "_blank", "noopener");
  };

  const inputClass =
    "w-full border border-[var(--rule)] bg-[var(--bone)] rounded-[var(--radius-landing)] px-4 py-3 font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink)] placeholder:text-[var(--ink-60)] focus:outline-none focus:ring-1 focus:ring-[var(--oltigo-green)] focus:border-[var(--oltigo-green)] transition-colors duration-[var(--duration)]";

  return (
    <section id="contact" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {}
        <HairlineRule />

        <div className="py-[var(--space-7)]">
          <div className="grid gap-12 md:grid-cols-2">
            <div className="max-w-full md:max-w-[480px]">
              <h2 className="font-[var(--font-sans-landing)] text-[length:var(--text-h1)] leading-[var(--lh-h1)] tracking-[var(--ls-h1)] font-medium text-[var(--ink)]">
                Demandez une démo
              </h2>
              <p className="mt-[var(--space-5)] font-[var(--font-sans-landing)] text-[length:var(--text-body-lg)] leading-[var(--lh-body-lg)] text-[var(--ink-70)]">
                Remplissez le formulaire et notre équipe vous contactera sous 24h pour une
                démonstration personnalisée.
              </p>
              <div className="mt-[var(--space-5)]">
                <p className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
                  OU CONTACTEZ-NOUS DIRECTEMENT
                </p>
                <a
                  href="https://wa.me/212600000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-[var(--space-3)] group inline-flex items-center gap-2 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium text-[var(--oltigo-green)] no-underline hover:underline"
                >
                  WhatsApp · +212 6 00 00 00 00
                  <ArrowRight className="size-3.5 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="contact-clinic"
                  className="block mb-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
                >
                  NOM DU CABINET
                </label>
                <input
                  id="contact-clinic"
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Cabinet Al Amal"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="contact-doctor"
                  className="block mb-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
                >
                  NOM DU MÉDECIN
                </label>
                <input
                  id="contact-doctor"
                  type="text"
                  required
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr Fatima Bennani"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="contact-phone"
                    className="block mb-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
                  >
                    TÉLÉPHONE
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+212 6XX XXX XXX"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block mb-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
                  >
                    EMAIL
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@cabinet.ma"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="contact-city"
                  className="block mb-2 font-[var(--font-mono-landing)] text-[length:var(--text-mono)] leading-[var(--lh-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]"
                >
                  VILLE
                </label>
                <input
                  id="contact-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Casablanca"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="mt-2 group inline-flex items-center justify-center gap-2 font-[var(--font-sans-landing)] text-[length:var(--text-small)] font-medium h-11 px-6 rounded-[var(--radius-landing)] bg-[var(--oltigo-green)] text-[var(--bone)] no-underline transition-opacity duration-[var(--duration)] ease-[var(--easing)] hover:opacity-90"
              >
                Envoyer la demande
                <ArrowRight className="size-4 transition-transform duration-[var(--duration)] ease-[var(--easing)] group-hover:translate-x-0.5" />
              </button>
            </form>
          </div>
        </div>

        <HairlineRule />
        {}
      </div>
    </section>
  );
}
