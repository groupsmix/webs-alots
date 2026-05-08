/**
 * AiDisclosureBanner — A62-F3 / EU AI Act Art.22 / Law 09-08
 *
 * Displayed on all screens that render AI-generated clinical content
 * (drug-check, prescription assist, patient summary, AI manager).
 *
 * Requirements:
 * - EU AI Act Art.13 (transparency): AI systems must inform users they are
 *   interacting with AI and the system's capabilities/limitations.
 * - EU AI Act Art.22 / GDPR Art.22: Automated decision-making must be
 *   disclosed and humans must have the right to override.
 * - Moroccan Law 09-08 Art.6: Data subjects must be informed of the purpose
 *   and nature of processing when AI is used to process their health data.
 *
 * Usage:
 *   <AiDisclosureBanner context="prescription" />
 *   <AiDisclosureBanner context="drug-check" compact />
 *   <AiDisclosureBanner context="patient-summary" />
 */

"use client";

import { useState } from "react";

export type AiDisclosureContext =
  | "prescription"
  | "drug-check"
  | "patient-summary"
  | "chat"
  | "general";

interface AiDisclosureBannerProps {
  /** Which AI feature is being used — determines the specific disclosure text. */
  context: AiDisclosureContext;
  /** Compact mode: single line without expandable details. Default: false. */
  compact?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

const CONTEXT_LABELS: Record<AiDisclosureContext, string> = {
  prescription: "Prescription Assistant",
  "drug-check": "Drug Interaction Checker",
  "patient-summary": "Patient Summary Generator",
  chat: "AI Chat",
  general: "AI Assistant",
};

const CONTEXT_CAVEATS: Record<AiDisclosureContext, string> = {
  prescription:
    "Generated prescriptions are drafts only. The prescribing physician must review, verify, and sign before any medication is dispensed.",
  "drug-check":
    "This interaction check is advisory. Clinical judgment must be applied. Always consult authoritative drug databases (Vidal, Thériaque) before prescribing.",
  "patient-summary":
    "AI summaries may omit or misrepresent clinical details. Review all source records before using this summary for clinical decisions.",
  chat:
    "AI responses are informational only and do not constitute medical advice. Consult your physician for medical decisions.",
  general:
    "AI outputs are decision-support tools. A qualified healthcare professional must review and approve all clinical decisions.",
};

/**
 * Renders a compliant AI transparency disclosure banner.
 * Must be shown whenever AI-generated clinical content is displayed.
 */
export function AiDisclosureBanner({
  context,
  compact = false,
  className = "",
}: AiDisclosureBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const label = CONTEXT_LABELS[context];
  const caveat = CONTEXT_CAVEATS[context];

  if (compact) {
    return (
      <div
        role="note"
        aria-label="AI-generated content disclosure"
        className={`ai-disclosure-compact ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          background: "rgba(234, 179, 8, 0.1)",
          border: "1px solid rgba(234, 179, 8, 0.3)",
          borderRadius: "4px",
          fontSize: "12px",
          color: "#92400e",
        }}
      >
        {/* Accessible icon — hidden from screen readers, visual only */}
        <span aria-hidden="true">🤖</span>
        <span>
          <strong>Généré par IA ({label})</strong> — {caveat}
        </span>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="AI-generated content disclosure"
      aria-expanded={expanded}
      className={`ai-disclosure-banner ${className}`}
      style={{
        padding: "12px 16px",
        background: "rgba(234, 179, 8, 0.08)",
        border: "1px solid rgba(234, 179, 8, 0.4)",
        borderRadius: "8px",
        fontSize: "13px",
        color: "#78350f",
        lineHeight: "1.5",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <span aria-hidden="true" style={{ fontSize: "16px", flexShrink: 0 }}>
          ⚠️
        </span>
        <div style={{ flex: 1 }}>
          <strong>Contenu généré par intelligence artificielle ({label})</strong>
          <p style={{ margin: "4px 0 0" }}>{caveat}</p>

          {/* Expandable regulatory disclosure */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              background: "none",
              border: "none",
              color: "#92400e",
              textDecoration: "underline",
              cursor: "pointer",
              padding: "4px 0 0",
              fontSize: "12px",
            }}
          >
            {expanded ? "Masquer les informations réglementaires ▲" : "Informations réglementaires ▼"}
          </button>

          {expanded && (
            <div
              style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(234, 179, 8, 0.3)",
                fontSize: "12px",
                color: "#92400e",
              }}
              role="region"
              aria-label="Regulatory information"
            >
              <p style={{ margin: "0 0 4px" }}>
                <strong>Base réglementaire :</strong> Loi 09-08 Art.6 (Maroc) · RGPD Art.22 (UE) · EU AI Act Art.13
              </p>
              <p style={{ margin: "0 0 4px" }}>
                Ce système utilise l&apos;intelligence artificielle pour <em>assister</em> (non remplacer) les
                professionnels de santé. Aucune décision clinique ne doit être prise uniquement sur la base de
                ces sorties sans supervision médicale qualifiée.
              </p>
              <p style={{ margin: "0" }}>
                Vous avez le droit de demander une révision humaine de toute décision automatisée vous concernant.
                Contactez votre médecin ou{" "}
                <a href="mailto:dpo@oltigo.com" style={{ color: "#92400e" }}>
                  dpo@oltigo.com
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
