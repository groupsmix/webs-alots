/**
 * Template Presets — Pre-configured theme + content combinations.
 *
 * Each preset ties together a base template, color theme, hero text,
 * section visibility, and default services key so that a clinic admin
 * can pick "doctor-modern" and get an entire site configured instantly.
 *
 * Used by:
 * - POST /api/branding/apply-preset  (one-click apply)
 * - Admin templates page             (preset grid)
 * - Onboarding wizard step 4         (quick-start presets)
 */

import type { VerticalId } from "@/lib/config/verticals";
import type { SectionVisibility } from "@/lib/section-visibility";
import type { TemplateId } from "@/lib/templates";

export interface TemplatePreset {
  id: string;
  vertical: VerticalId;
  templateId: TemplateId;
  name: string;
  nameAr: string;
  description: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  hero: {
    title: string;
    titleAr: string;
    subtitle: string;
    subtitleAr: string;
  };
  sections: Partial<SectionVisibility>;
  defaultServices: string;
  preview: string;
}

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  "doctor-modern": {
    id: "doctor-modern",
    vertical: "healthcare",
    templateId: "modern",
    name: "Doctor Modern",
    nameAr: "طبيب عصري",
    description: "Clean, professional look with card-based layout for medical practices",
    theme: {
      primaryColor: "#1E4DA1",
      secondaryColor: "#0F6E56",
      accentColor: "#3B82F6",
    },
    hero: {
      title: "Votre Sant\u00e9, Notre Priorit\u00e9",
      titleAr: "\u0635\u062d\u062a\u0643 \u0623\u0648\u0644\u0648\u064a\u062a\u0646\u0627",
      subtitle:
        "Des soins de sant\u00e9 professionnels avec une touche personnelle. Prenez rendez-vous en ligne facilement.",
      subtitleAr:
        "\u0631\u0639\u0627\u064a\u0629 \u0635\u062d\u064a\u0629 \u0645\u0647\u0646\u064a\u0629 \u0628\u0644\u0645\u0633\u0629 \u0634\u062e\u0635\u064a\u0629. \u0627\u062d\u062c\u0632 \u0645\u0648\u0639\u062f\u0643 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a \u0628\u0633\u0647\u0648\u0644\u0629.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: true,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: true,
      faq: true,
    },
    defaultServices: "general_medicine",
    preview: "Professional medical design with blue tones, card layout, and online booking",
  },
  "doctor-elegant": {
    id: "doctor-elegant",
    vertical: "healthcare",
    templateId: "elegant",
    name: "Doctor Elegant",
    nameAr: "\u0637\u0628\u064a\u0628 \u0623\u0646\u064a\u0642",
    description: "Refined, luxury aesthetic for premium medical practices and specialists",
    theme: {
      primaryColor: "#1E3A5F",
      secondaryColor: "#2E7D6F",
      accentColor: "#4A90D9",
    },
    hero: {
      title: "L'Excellence M\u00e9dicale \u00e0 Votre Service",
      titleAr:
        "\u0627\u0644\u062a\u0645\u064a\u0632 \u0627\u0644\u0637\u0628\u064a \u0641\u064a \u062e\u062f\u0645\u062a\u0643",
      subtitle:
        "Une approche personnalis\u00e9e et des soins de qualit\u00e9 sup\u00e9rieure dans un cadre \u00e9l\u00e9gant.",
      subtitleAr:
        "\u0646\u0647\u062c \u0634\u062e\u0635\u064a \u0648\u0631\u0639\u0627\u064a\u0629 \u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u062c\u0648\u062f\u0629 \u0641\u064a \u0625\u0637\u0627\u0631 \u0623\u0646\u064a\u0642.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: true,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: true,
      faq: true,
    },
    defaultServices: "general_medicine",
    preview: "Sophisticated medical design with navy tones, parallax hero, and refined typography",
  },
  "doctor-bold": {
    id: "doctor-bold",
    vertical: "healthcare",
    templateId: "bold",
    name: "Doctor Bold",
    nameAr: "\u0637\u0628\u064a\u0628 \u062c\u0631\u064a\u0621",
    description: "Dark, impactful design for modern clinics that want to stand out",
    theme: {
      primaryColor: "#3B82F6",
      secondaryColor: "#10B981",
      accentColor: "#60A5FA",
    },
    hero: {
      title: "M\u00e9decine Moderne, R\u00e9sultats Exceptionnels",
      titleAr:
        "\u0637\u0628 \u062d\u062f\u064a\u062b\u060c \u0646\u062a\u0627\u0626\u062c \u0627\u0633\u062a\u062b\u0646\u0627\u0626\u064a\u0629",
      subtitle: "Technologies de pointe et expertise m\u00e9dicale pour des soins sans compromis.",
      subtitleAr:
        "\u062a\u0642\u0646\u064a\u0627\u062a \u0645\u062a\u0637\u0648\u0631\u0629 \u0648\u062e\u0628\u0631\u0629 \u0637\u0628\u064a\u0629 \u0644\u0631\u0639\u0627\u064a\u0629 \u0628\u0644\u0627 \u062a\u0646\u0627\u0632\u0644.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: false,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: true,
      faq: false,
    },
    defaultServices: "general_medicine",
    preview: "Dark-themed medical design with bold typography and vibrant blue accents",
  },
  "dentist-modern": {
    id: "dentist-modern",
    vertical: "healthcare",
    templateId: "modern",
    name: "Dentist Modern",
    nameAr: "\u0637\u0628\u064a\u0628 \u0623\u0633\u0646\u0627\u0646 \u0639\u0635\u0631\u064a",
    description: "Bright, welcoming design tailored for dental clinics",
    theme: {
      primaryColor: "#0891B2",
      secondaryColor: "#0D9488",
      accentColor: "#22D3EE",
    },
    hero: {
      title: "Un Sourire \u00c9clatant Commence Ici",
      titleAr:
        "\u0627\u0628\u062a\u0633\u0627\u0645\u0629 \u0645\u0634\u0631\u0642\u0629 \u062a\u0628\u062f\u0623 \u0645\u0646 \u0647\u0646\u0627",
      subtitle:
        "Des soins dentaires modernes dans un environnement chaleureux. Votre sourire m\u00e9rite le meilleur.",
      subtitleAr:
        "\u0631\u0639\u0627\u064a\u0629 \u0623\u0633\u0646\u0627\u0646 \u062d\u062f\u064a\u062b\u0629 \u0641\u064a \u0628\u064a\u0626\u0629 \u062f\u0627\u0641\u0626\u0629. \u0627\u0628\u062a\u0633\u0627\u0645\u062a\u0643 \u062a\u0633\u062a\u062d\u0642 \u0627\u0644\u0623\u0641\u0636\u0644.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: false,
      beforeAfter: true,
      location: true,
      booking: true,
      contactForm: true,
      insurance: true,
      faq: true,
    },
    defaultServices: "dental_clinic",
    preview: "Teal-themed dental design with warm imagery and before/after gallery",
  },
  "dentist-bold": {
    id: "dentist-bold",
    vertical: "healthcare",
    templateId: "bold",
    name: "Dentist Bold",
    nameAr: "\u0637\u0628\u064a\u0628 \u0623\u0633\u0646\u0627\u0646 \u062c\u0631\u064a\u0621",
    description: "High-impact dark design for modern dental practices",
    theme: {
      primaryColor: "#06B6D4",
      secondaryColor: "#14B8A6",
      accentColor: "#67E8F9",
    },
    hero: {
      title: "Dentisterie d'Avant-Garde",
      titleAr: "\u0637\u0628 \u0623\u0633\u0646\u0627\u0646 \u0645\u062a\u0642\u062f\u0645",
      subtitle:
        "Technologies dentaires de derni\u00e8re g\u00e9n\u00e9ration pour un sourire parfait.",
      subtitleAr:
        "\u062a\u0642\u0646\u064a\u0627\u062a \u0637\u0628 \u0627\u0644\u0623\u0633\u0646\u0627\u0646 \u0627\u0644\u0623\u062d\u062f\u062b \u0644\u0627\u0628\u062a\u0633\u0627\u0645\u0629 \u0645\u062b\u0627\u0644\u064a\u0629.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: false,
      beforeAfter: true,
      location: true,
      booking: true,
      contactForm: true,
      insurance: true,
      faq: false,
    },
    defaultServices: "dental_clinic",
    preview: "Dark-themed dental design with cyan accents and bold visual impact",
  },
};

/** Get all presets as an array */
export const presetList: TemplatePreset[] = Object.values(TEMPLATE_PRESETS);

/** Get a single preset by ID */
export function getPreset(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS[id];
}

/** Get all presets for a given vertical */
export function getPresetsByVertical(vertical: VerticalId): TemplatePreset[] {
  return presetList.filter((p) => p.vertical === vertical);
}
