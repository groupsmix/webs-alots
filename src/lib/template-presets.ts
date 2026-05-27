/**
 * Template Presets — Pre-configured theme + content combinations.
 *
 * Each preset ties together a base template, color theme, hero text,
 * section visibility, and default services key so that a clinic admin
 * can pick "beauty-elegant" and get an entire site configured instantly.
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
  // ── Healthcare Presets ──────────────────────────────────────────────

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
      subtitle: "Des soins de sant\u00e9 professionnels avec une touche personnelle. Prenez rendez-vous en ligne facilement.",
      subtitleAr: "\u0631\u0639\u0627\u064a\u0629 \u0635\u062d\u064a\u0629 \u0645\u0647\u0646\u064a\u0629 \u0628\u0644\u0645\u0633\u0629 \u0634\u062e\u0635\u064a\u0629. \u0627\u062d\u062c\u0632 \u0645\u0648\u0639\u062f\u0643 \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a \u0628\u0633\u0647\u0648\u0644\u0629.",
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
      titleAr: "\u0627\u0644\u062a\u0645\u064a\u0632 \u0627\u0644\u0637\u0628\u064a \u0641\u064a \u062e\u062f\u0645\u062a\u0643",
      subtitle: "Une approche personnalis\u00e9e et des soins de qualit\u00e9 sup\u00e9rieure dans un cadre \u00e9l\u00e9gant.",
      subtitleAr: "\u0646\u0647\u062c \u0634\u062e\u0635\u064a \u0648\u0631\u0639\u0627\u064a\u0629 \u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u062c\u0648\u062f\u0629 \u0641\u064a \u0625\u0637\u0627\u0631 \u0623\u0646\u064a\u0642.",
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
      titleAr: "\u0637\u0628 \u062d\u062f\u064a\u062b\u060c \u0646\u062a\u0627\u0626\u062c \u0627\u0633\u062a\u062b\u0646\u0627\u0626\u064a\u0629",
      subtitle: "Technologies de pointe et expertise m\u00e9dicale pour des soins sans compromis.",
      subtitleAr: "\u062a\u0642\u0646\u064a\u0627\u062a \u0645\u062a\u0637\u0648\u0631\u0629 \u0648\u062e\u0628\u0631\u0629 \u0637\u0628\u064a\u0629 \u0644\u0631\u0639\u0627\u064a\u0629 \u0628\u0644\u0627 \u062a\u0646\u0627\u0632\u0644.",
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
      titleAr: "\u0627\u0628\u062a\u0633\u0627\u0645\u0629 \u0645\u0634\u0631\u0642\u0629 \u062a\u0628\u062f\u0623 \u0645\u0646 \u0647\u0646\u0627",
      subtitle: "Des soins dentaires modernes dans un environnement chaleureux. Votre sourire m\u00e9rite le meilleur.",
      subtitleAr: "\u0631\u0639\u0627\u064a\u0629 \u0623\u0633\u0646\u0627\u0646 \u062d\u062f\u064a\u062b\u0629 \u0641\u064a \u0628\u064a\u0626\u0629 \u062f\u0627\u0641\u0626\u0629. \u0627\u0628\u062a\u0633\u0627\u0645\u062a\u0643 \u062a\u0633\u062a\u062d\u0642 \u0627\u0644\u0623\u0641\u0636\u0644.",
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
      subtitle: "Technologies dentaires de derni\u00e8re g\u00e9n\u00e9ration pour un sourire parfait.",
      subtitleAr: "\u062a\u0642\u0646\u064a\u0627\u062a \u0637\u0628 \u0627\u0644\u0623\u0633\u0646\u0627\u0646 \u0627\u0644\u0623\u062d\u062f\u062b \u0644\u0627\u0628\u062a\u0633\u0627\u0645\u0629 \u0645\u062b\u0627\u0644\u064a\u0629.",
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

  // ── Beauty Presets ──────────────────────────────────────────────────

  "beauty-elegant": {
    id: "beauty-elegant",
    vertical: "beauty",
    templateId: "elegant",
    name: "Beauty Elegant",
    nameAr: "\u062c\u0645\u0627\u0644 \u0623\u0646\u064a\u0642",
    description: "Luxurious, refined design for spas and aesthetic clinics",
    theme: {
      primaryColor: "#BE185D",
      secondaryColor: "#9D174D",
      accentColor: "#F472B6",
    },
    hero: {
      title: "R\u00e9v\u00e9lez Votre Beaut\u00e9 Naturelle",
      titleAr: "\u0623\u0638\u0647\u0631\u064a \u062c\u0645\u0627\u0644\u0643 \u0627\u0644\u0637\u0628\u064a\u0639\u064a",
      subtitle: "Des soins esth\u00e9tiques haut de gamme dans un cadre luxueux. Offrez-vous le meilleur.",
      subtitleAr: "\u0639\u0646\u0627\u064a\u0629 \u062a\u062c\u0645\u064a\u0644\u064a\u0629 \u0631\u0627\u0642\u064a\u0629 \u0641\u064a \u0625\u0637\u0627\u0631 \u0641\u0627\u062e\u0631. \u0627\u0645\u0646\u062d\u064a \u0646\u0641\u0633\u0643 \u0627\u0644\u0623\u0641\u0636\u0644.",
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
      insurance: false,
      faq: true,
    },
    defaultServices: "aesthetic_clinic",
    preview: "Rose-gold beauty design with parallax hero and before/after gallery",
  },

  "beauty-modern": {
    id: "beauty-modern",
    vertical: "beauty",
    templateId: "modern",
    name: "Beauty Modern",
    nameAr: "\u062c\u0645\u0627\u0644 \u0639\u0635\u0631\u064a",
    description: "Fresh, contemporary design for beauty salons and wellness centers",
    theme: {
      primaryColor: "#D946EF",
      secondaryColor: "#A855F7",
      accentColor: "#E879F9",
    },
    hero: {
      title: "Votre Espace Bien-\u00catre",
      titleAr: "\u0645\u0633\u0627\u062d\u062a\u0643 \u0644\u0644\u0639\u0646\u0627\u064a\u0629",
      subtitle: "Soins personnalis\u00e9s et produits de qualit\u00e9 pour sublimer votre beaut\u00e9 au quotidien.",
      subtitleAr: "\u0639\u0646\u0627\u064a\u0629 \u0634\u062e\u0635\u064a\u0629 \u0648\u0645\u0646\u062a\u062c\u0627\u062a \u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u062c\u0648\u062f\u0629 \u0644\u062a\u0639\u0632\u064a\u0632 \u062c\u0645\u0627\u0644\u0643 \u064a\u0648\u0645\u064a\u0627\u064b.",
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
      insurance: false,
      faq: false,
    },
    defaultServices: "aesthetic_clinic",
    preview: "Purple-pink modern design with card layout for beauty salons",
  },

  "beauty-bold": {
    id: "beauty-bold",
    vertical: "beauty",
    templateId: "bold",
    name: "Beauty Bold",
    nameAr: "\u062c\u0645\u0627\u0644 \u062c\u0631\u064a\u0621",
    description: "Dramatic dark design for high-end beauty and cosmetic brands",
    theme: {
      primaryColor: "#EC4899",
      secondaryColor: "#DB2777",
      accentColor: "#F9A8D4",
    },
    hero: {
      title: "Beaut\u00e9 Sans Limites",
      titleAr: "\u062c\u0645\u0627\u0644 \u0628\u0644\u0627 \u062d\u062f\u0648\u062f",
      subtitle: "Transformez-vous avec nos traitements esth\u00e9tiques exclusifs et personnalis\u00e9s.",
      subtitleAr: "\u063a\u064a\u0631\u064a \u0625\u0637\u0644\u0627\u0644\u062a\u0643 \u0645\u0639 \u0639\u0644\u0627\u062c\u0627\u062a\u0646\u0627 \u0627\u0644\u062a\u062c\u0645\u064a\u0644\u064a\u0629 \u0627\u0644\u062d\u0635\u0631\u064a\u0629.",
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
      insurance: false,
      faq: false,
    },
    defaultServices: "aesthetic_clinic",
    preview: "Dark-themed beauty design with hot-pink accents and dramatic typography",
  },

  // ── Restaurant Presets ──────────────────────────────────────────────

  "restaurant-bold": {
    id: "restaurant-bold",
    vertical: "restaurant",
    templateId: "bold",
    name: "Restaurant Bold",
    nameAr: "\u0645\u0637\u0639\u0645 \u062c\u0631\u064a\u0621",
    description: "Dark, appetizing design for upscale restaurants and fine dining",
    theme: {
      primaryColor: "#DC2626",
      secondaryColor: "#B91C1C",
      accentColor: "#F87171",
    },
    hero: {
      title: "Une Exp\u00e9rience Culinaire Unique",
      titleAr: "\u062a\u062c\u0631\u0628\u0629 \u0637\u0647\u064a \u0641\u0631\u064a\u062f\u0629",
      subtitle: "D\u00e9couvrez des saveurs authentiques dans un cadre exceptionnel. R\u00e9servez votre table.",
      subtitleAr: "\u0627\u0643\u062a\u0634\u0641 \u0646\u0643\u0647\u0627\u062a \u0623\u0635\u064a\u0644\u0629 \u0641\u064a \u0625\u0637\u0627\u0631 \u0627\u0633\u062a\u062b\u0646\u0627\u0626\u064a. \u0627\u062d\u062c\u0632 \u0637\u0627\u0648\u0644\u062a\u0643.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: false,
      reviews: true,
      blog: false,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: false,
      faq: false,
    },
    defaultServices: "restaurant",
    preview: "Dark restaurant design with red accents, fullscreen hero, and reservation CTA",
  },

  "restaurant-elegant": {
    id: "restaurant-elegant",
    vertical: "restaurant",
    templateId: "elegant",
    name: "Restaurant Elegant",
    nameAr: "\u0645\u0637\u0639\u0645 \u0623\u0646\u064a\u0642",
    description: "Sophisticated design for fine dining and gourmet restaurants",
    theme: {
      primaryColor: "#92400E",
      secondaryColor: "#78350F",
      accentColor: "#D97706",
    },
    hero: {
      title: "L'Art de la Gastronomie",
      titleAr: "\u0641\u0646 \u0627\u0644\u0637\u0647\u064a",
      subtitle: "Cuisine raffin\u00e9e pr\u00e9par\u00e9e avec passion. Une invitation au voyage des sens.",
      subtitleAr: "\u0645\u0637\u0628\u062e \u0631\u0627\u0642\u064d \u0645\u064f\u0639\u062f\u064c \u0628\u0634\u063a\u0641. \u062f\u0639\u0648\u0629 \u0644\u0631\u062d\u0644\u0629 \u062d\u0633\u064a\u0629.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: false,
      reviews: true,
      blog: false,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: false,
      faq: false,
    },
    defaultServices: "restaurant",
    preview: "Warm amber-toned elegant design for fine dining with parallax imagery",
  },

  "restaurant-modern": {
    id: "restaurant-modern",
    vertical: "restaurant",
    templateId: "modern",
    name: "Restaurant Modern",
    nameAr: "\u0645\u0637\u0639\u0645 \u0639\u0635\u0631\u064a",
    description: "Clean, contemporary design for casual dining and cafes",
    theme: {
      primaryColor: "#EA580C",
      secondaryColor: "#C2410C",
      accentColor: "#FB923C",
    },
    hero: {
      title: "Saveurs Fraiches, Ambiance Moderne",
      titleAr: "\u0646\u0643\u0647\u0627\u062a \u0637\u0627\u0632\u062c\u0629\u060c \u0623\u062c\u0648\u0627\u0621 \u0639\u0635\u0631\u064a\u0629",
      subtitle: "Des plats pr\u00e9par\u00e9s avec des ingr\u00e9dients frais dans une ambiance conviviale.",
      subtitleAr: "\u0623\u0637\u0628\u0627\u0642 \u0645\u062d\u0636\u0631\u0629 \u0628\u0645\u0643\u0648\u0646\u0627\u062a \u0637\u0627\u0632\u062c\u0629 \u0641\u064a \u0623\u062c\u0648\u0627\u0621 \u0648\u062f\u064a\u0629.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: false,
      reviews: true,
      blog: true,
      beforeAfter: false,
      location: true,
      booking: true,
      contactForm: true,
      insurance: false,
      faq: true,
    },
    defaultServices: "restaurant",
    preview: "Orange-toned modern design for casual restaurants with card-based menu",
  },

  // ── Fitness Presets ─────────────────────────────────────────────────

  "fitness-bold": {
    id: "fitness-bold",
    vertical: "fitness",
    templateId: "bold",
    name: "Fitness Bold",
    nameAr: "\u0644\u064a\u0627\u0642\u0629 \u062c\u0631\u064a\u0626\u0629",
    description: "High-energy dark design for gyms and training centers",
    theme: {
      primaryColor: "#EAB308",
      secondaryColor: "#CA8A04",
      accentColor: "#FDE047",
    },
    hero: {
      title: "D\u00e9passez Vos Limites",
      titleAr: "\u062a\u062c\u0627\u0648\u0632 \u062d\u062f\u0648\u062f\u0643",
      subtitle: "Entra\u00eenements personnalis\u00e9s et coaching professionnel pour atteindre vos objectifs.",
      subtitleAr: "\u062a\u062f\u0631\u064a\u0628\u0627\u062a \u0634\u062e\u0635\u064a\u0629 \u0648\u062a\u062f\u0631\u064a\u0628 \u0645\u0647\u0646\u064a \u0644\u062a\u062d\u0642\u064a\u0642 \u0623\u0647\u062f\u0627\u0641\u0643.",
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
      insurance: false,
      faq: false,
    },
    defaultServices: "physiotherapy",
    preview: "Dark gym design with yellow accents, video hero, and bold motivation",
  },

  "fitness-modern": {
    id: "fitness-modern",
    vertical: "fitness",
    templateId: "modern",
    name: "Fitness Modern",
    nameAr: "\u0644\u064a\u0627\u0642\u0629 \u0639\u0635\u0631\u064a\u0629",
    description: "Clean, energetic design for yoga studios and wellness fitness",
    theme: {
      primaryColor: "#059669",
      secondaryColor: "#047857",
      accentColor: "#34D399",
    },
    hero: {
      title: "Votre Parcours Bien-\u00catre",
      titleAr: "\u0631\u062d\u0644\u0629 \u0639\u0627\u0641\u064a\u062a\u0643",
      subtitle: "Programmes adapt\u00e9s \u00e0 tous les niveaux. Rejoignez notre communaut\u00e9 fitness.",
      subtitleAr: "\u0628\u0631\u0627\u0645\u062c \u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0633\u062a\u0648\u064a\u0627\u062a. \u0627\u0646\u0636\u0645 \u0625\u0644\u0649 \u0645\u062c\u062a\u0645\u0639\u0646\u0627.",
    },
    sections: {
      hero: true,
      services: true,
      doctors: true,
      reviews: true,
      blog: true,
      beforeAfter: true,
      location: true,
      booking: true,
      contactForm: true,
      insurance: false,
      faq: true,
    },
    defaultServices: "physiotherapy",
    preview: "Green-toned modern fitness design with clean layout and progress tracking",
  },

  // ── Veterinary Presets ──────────────────────────────────────────────

  "vet-modern": {
    id: "vet-modern",
    vertical: "veterinary",
    templateId: "modern",
    name: "Vet Modern",
    nameAr: "\u0628\u064a\u0637\u0631\u064a \u0639\u0635\u0631\u064a",
    description: "Friendly, professional design for veterinary clinics",
    theme: {
      primaryColor: "#4F46E5",
      secondaryColor: "#4338CA",
      accentColor: "#818CF8",
    },
    hero: {
      title: "Des Soins Attentionn\u00e9s pour Vos Compagnons",
      titleAr: "\u0631\u0639\u0627\u064a\u0629 \u062d\u0646\u0648\u0646\u0629 \u0644\u0631\u0641\u0627\u0642\u0643",
      subtitle: "M\u00e9decine v\u00e9t\u00e9rinaire moderne et bienveillante. Votre animal m\u00e9rite le meilleur.",
      subtitleAr: "\u0637\u0628 \u0628\u064a\u0637\u0631\u064a \u062d\u062f\u064a\u062b \u0648\u0631\u062d\u064a\u0645. \u062d\u064a\u0648\u0627\u0646\u0643 \u064a\u0633\u062a\u062d\u0642 \u0627\u0644\u0623\u0641\u0636\u0644.",
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
      insurance: false,
      faq: true,
    },
    defaultServices: "general_medicine",
    preview: "Indigo-toned vet design with friendly imagery and online pet appointments",
  },

  "vet-classic": {
    id: "vet-classic",
    vertical: "veterinary",
    templateId: "classic",
    name: "Vet Classic",
    nameAr: "\u0628\u064a\u0637\u0631\u064a \u0643\u0644\u0627\u0633\u064a\u0643\u064a",
    description: "Traditional, trustworthy design for established veterinary practices",
    theme: {
      primaryColor: "#15803D",
      secondaryColor: "#166534",
      accentColor: "#4ADE80",
    },
    hero: {
      title: "La Sant\u00e9 de Vos Animaux, Notre Mission",
      titleAr: "\u0635\u062d\u0629 \u062d\u064a\u0648\u0627\u0646\u0627\u062a\u0643\u060c \u0645\u0647\u0645\u062a\u0646\u0627",
      subtitle: "Une \u00e9quipe d\u00e9vou\u00e9e au bien-\u00eatre animal depuis des ann\u00e9es. Consultations et urgences.",
      subtitleAr: "\u0641\u0631\u064a\u0642 \u0645\u062a\u0641\u0627\u0646\u064d \u0644\u0631\u0639\u0627\u064a\u0629 \u0627\u0644\u062d\u064a\u0648\u0627\u0646\u0627\u062a \u0645\u0646\u0630 \u0633\u0646\u0648\u0627\u062a. \u0627\u0633\u062a\u0634\u0627\u0631\u0627\u062a \u0648\u0637\u0648\u0627\u0631\u0626.",
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
      insurance: false,
      faq: true,
    },
    defaultServices: "general_medicine",
    preview: "Green-toned classic vet design with structured layout and trust indicators",
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

/** Get preset IDs for a given vertical (matches vertical.templatePresets arrays) */
export function getPresetIdsForVertical(vertical: VerticalId): string[] {
  return getPresetsByVertical(vertical).map((p) => p.id);
}
