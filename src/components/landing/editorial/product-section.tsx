/* eslint-disable i18next/no-literal-string */
"use client";

import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

function AppointmentCalendarMock() {
  const days = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
  const slots = [
    { day: 0, hour: "09:00", patient: "A. Bennani", status: "confirmed" },
    { day: 0, hour: "10:30", patient: "F. Idrissi", status: "confirmed" },
    { day: 1, hour: "09:00", patient: "M. Tazi", status: "pending" },
    { day: 2, hour: "11:00", patient: "S. Alaoui", status: "confirmed" },
    { day: 2, hour: "14:00", patient: "K. Fassi", status: "confirmed" },
    { day: 3, hour: "09:30", patient: "R. Berrada", status: "pending" },
    { day: 4, hour: "10:00", patient: "N. Chraibi", status: "confirmed" },
    { day: 5, hour: "09:00", patient: "H. Mouline", status: "confirmed" },
  ];

  return (
    <div className="aspect-[16/10] rounded-[var(--radius-landing)] border border-[var(--rule)] bg-[var(--bone)] p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
          SEMAINE 22 · MAI 2025
        </span>
        <span className="inline-flex h-5 items-center rounded-full bg-[var(--oltigo-green)] px-2 font-[var(--font-mono-landing)] text-[length:10px] tracking-[var(--ls-mono)] text-[var(--bone)]">
          8 RDV
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1 flex-1 min-h-0">
        {days.map((day, di) => (
          <div key={day} className="flex flex-col gap-1">
            <span className="text-center font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] text-[var(--ink-60)] uppercase pb-1 border-b border-[var(--rule)]">
              {day}
            </span>
            {slots
              .filter((s) => s.day === di)
              .map((s) => (
                <div
                  key={s.hour}
                  className={`rounded px-1 py-0.5 ${s.status === "confirmed" ? "bg-[var(--oltigo-green)]/10 border-l-2 border-l-[var(--oltigo-green)]" : "bg-[var(--ink)]/5 border-l-2 border-l-[var(--ink-60)]"}`}
                >
                  <span className="block font-[var(--font-mono-landing)] text-[length:8px] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
                    {s.hour}
                  </span>
                  <span className="block font-[var(--font-sans-landing)] text-[length:9px] text-[var(--ink)] truncate">
                    {s.patient}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientRecordMock() {
  return (
    <div className="aspect-[16/10] rounded-[var(--radius-landing)] border border-[var(--rule)] bg-[var(--bone)] p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
          DOSSIER PATIENT
        </span>
        <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
          AES-256-GCM
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="rounded border border-[var(--rule)] p-2">
          <div className="flex items-center justify-between">
            <span className="font-[var(--font-sans-landing)] text-[length:12px] font-medium text-[var(--ink)]">
              Amina Bennani
            </span>
            <span className="font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
              CNSS · F · 34 ANS
            </span>
          </div>
          <div className="mt-1.5 border-t border-[var(--rule)] pt-1.5">
            <span className="font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
              TEL +212 6XX XXX XXX
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-1 min-h-0">
          <div className="flex-1 rounded border border-[var(--rule)] p-2">
            <span className="block font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)] mb-1">
              DERNIÈRE VISITE
            </span>
            <span className="block font-[var(--font-sans-landing)] text-[length:10px] text-[var(--ink)]">
              2025-05-15
            </span>
            <span className="block font-[var(--font-sans-landing)] text-[length:10px] text-[var(--ink-70)] mt-0.5">
              Consultation générale
            </span>
          </div>
          <div className="flex-1 rounded border border-[var(--rule)] p-2">
            <span className="block font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)] mb-1">
              ORDONNANCES
            </span>
            <span className="block font-[var(--font-sans-landing)] text-[length:10px] text-[var(--ink)]">
              3 actives
            </span>
            <span className="block font-[var(--font-sans-landing)] text-[length:10px] text-[var(--ink-70)] mt-0.5">
              12 historiques
            </span>
          </div>
        </div>
        <div className="rounded border border-[var(--rule)] p-2 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--oltigo-green)]" />
          <span className="font-[var(--font-mono-landing)] text-[length:9px] tracking-[var(--ls-mono)] text-[var(--ink-60)]">
            PROCHAIN RDV · 2025-06-02 · 10:00
          </span>
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreviewMock() {
  const messages = [
    {
      from: "system",
      text: "Salam Amina, n\u2019oubliez pas votre RDV demain \u00e0 10h chez Dr. Bennani. R\u00e9pondez OUI pour confirmer.",
      time: "09:00",
    },
    { from: "patient", text: "OUI", time: "09:02" },
    {
      from: "system",
      text: "Votre RDV est confirm\u00e9. \u00c0 demain incha\u2019Allah !",
      time: "09:02",
    },
  ];

  return (
    <div className="aspect-[16/10] rounded-[var(--radius-landing)] border border-[var(--rule)] bg-[var(--bone)] p-4 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="font-[var(--font-mono-landing)] text-[length:var(--text-mono)] tracking-[var(--ls-mono)] uppercase text-[var(--ink-60)]">
          WHATSAPP BUSINESS
        </span>
        <span className="inline-flex h-5 items-center rounded-full border border-[var(--oltigo-green)] px-2 font-[var(--font-mono-landing)] text-[length:10px] tracking-[var(--ls-mono)] text-[var(--oltigo-green)]">
          TEMPLATE DARIJA
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 min-h-0 justify-end">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.from === "system" ? "self-start bg-[var(--ink)]/5" : "self-end bg-[var(--oltigo-green)]/10"}`}
          >
            <span className="block font-[var(--font-sans-landing)] text-[length:11px] leading-tight text-[var(--ink)]">
              {msg.text}
            </span>
            <span className="block mt-1 font-[var(--font-mono-landing)] text-[length:8px] tracking-[var(--ls-mono)] text-[var(--ink-60)] text-right">
              {msg.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCK_COMPONENTS: Record<string, () => React.JSX.Element> = {
  appointments: AppointmentCalendarMock,
  patientRecord: PatientRecordMock,
  whatsapp: WhatsAppPreviewMock,
};

/**
 * §3.1.4 Product Anatomy — 3 rows × 2 columns.
 * Left = label + description, right = styled mock UI preview.
 * Separated by --rule. No device frames, no rotation, no shadows.
 */
export function ProductSection() {
  const { t } = useLandingLocale();

  const products = [
    {
      key: "appointments",
      label: t("landing.editorial.product-section.appointmentsLabel"),
      description: t("landing.editorial.product-section.appointmentsDesc"),
    },
    {
      key: "patientRecord",
      label: t("landing.editorial.product-section.patientRecordLabel"),
      description: t("landing.editorial.product-section.patientRecordDesc"),
    },
    {
      key: "whatsapp",
      label: t("landing.editorial.product-section.whatsappLabel"),
      description: t("landing.editorial.product-section.whatsappDesc"),
    },
  ];

  return (
    <section id="product" className="bg-[var(--bone)] py-[var(--space-9)]">
      <div className="mx-auto w-full max-w-[var(--container-max)] px-[var(--gutter-desktop)]">
        {products.map((product, i) => {
          const MockComponent = MOCK_COMPONENTS[product.key];
          return (
            <div key={product.key}>
              {i > 0 && <HairlineRule />}
              <div className="grid gap-8 md:grid-cols-2 md:items-center py-[var(--space-7)]">
                <div>
                  <h3 className="font-[var(--font-sans-landing)] text-[length:var(--text-h3)] leading-[var(--lh-h3)] tracking-[var(--ls-h3)] font-medium text-[var(--ink)]">
                    {product.label}
                  </h3>
                  <p className="mt-[var(--space-3)] font-[var(--font-sans-landing)] text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink-70)]">
                    {product.description}
                  </p>
                </div>

                {MockComponent ? <MockComponent /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
