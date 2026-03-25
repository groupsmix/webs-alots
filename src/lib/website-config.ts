/**
 * Website Template Configuration
 *
 * Stores all editable content for the public-facing clinic website.
 * The Admin "Website Editor" reads/writes these values so clinics
 * can change colors, photos, and text without touching code.
 */

export interface WebsiteConfig {
  /** Hero section */
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    imageUrl?: string;
  };

  /** About the doctor / clinic */
  about: {
    doctorName: string;
    specialty: string;
    bio: string;
    photoUrl?: string;
    education: string;
    specialization: string;
    experience: string;
    languages: string;
    practiceDescription: string;
    practiceDetails: string;
  };

  /** How to book section */
  howToBook: {
    title: string;
    subtitle: string;
    steps: { title: string; description: string }[];
  };

  /** Location & hours */
  location: {
    title: string;
    subtitle: string;
    address: string;
    city: string;
    googleMapsEmbedUrl: string;
    workingHours: { day: string; hours: string }[];
  };

  /** Contact page */
  contact: {
    title: string;
    subtitle: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    whatsappMessage: string;
  };

  /** Reviews page */
  reviews: {
    title: string;
    subtitle: string;
  };

  /** Services page */
  services: {
    title: string;
    subtitle: string;
  };

  /** Theme overrides */
  theme: {
    primaryColor: string;
    accentColor: string;
    heroGradientFrom: string;
    heroGradientTo: string;
  };
}

export const defaultWebsiteConfig: WebsiteConfig = {
  hero: {
    title: "Votre Santé, Notre Priorité",
    subtitle:
      "Des soins de santé professionnels avec une touche personnelle. Prenez rendez-vous en ligne et bénéficiez de soins modernes et attentionnés.",
    ctaPrimary: "Prendre rendez-vous",
    ctaSecondary: "Nos Services",
    imageUrl: undefined,
  },

  about: {
    doctorName: "",
    specialty: "",
    bio: "",
    photoUrl: undefined,
    education: "",
    specialization: "",
    experience: "",
    languages: "",
    practiceDescription: "",
    practiceDetails: "",
  },

  howToBook: {
    title: "Comment Prendre Rendez-vous",
    subtitle:
      "Prendre rendez-vous est rapide et facile. Suivez ces étapes simples pour commencer.",
    steps: [
      {
        title: "Choisir un service",
        description:
          "Parcourez notre liste de services médicaux et sélectionnez celui qui correspond à vos besoins.",
      },
      {
        title: "Choisir une date et un horaire",
        description:
          "Sélectionnez parmi les créneaux disponibles qui conviennent à votre emploi du temps.",
      },
      {
        title: "Remplir vos informations",
        description:
          "Saisissez votre nom, numéro de téléphone et toute information médicale pertinente.",
      },
      {
        title: "Confirmer votre rendez-vous",
        description:
          "Vérifiez les détails de votre rendez-vous et confirmez. Vous recevrez une confirmation par WhatsApp ou SMS.",
      },
    ],
  },

  location: {
    title: "Localisation & Horaires",
    subtitle:
      "Rendez-nous visite dans notre cabinet. Nous serons ravis de vous accueillir.",
    address: "",
    city: "",
    googleMapsEmbedUrl: "",
    workingHours: [
      { day: "Lundi", hours: "09:00 - 17:00" },
      { day: "Mardi", hours: "09:00 - 17:00" },
      { day: "Mercredi", hours: "09:00 - 17:00" },
      { day: "Jeudi", hours: "09:00 - 17:00" },
      { day: "Vendredi", hours: "09:00 - 17:00" },
      { day: "Samedi", hours: "09:00 - 13:00" },
      { day: "Dimanche", hours: "Fermé" },
    ],
  },

  contact: {
    title: "Contactez-nous",
    subtitle:
      "Vous avez une question ou souhaitez nous contacter ? Nous sommes là pour vous aider. Utilisez l'un des moyens ci-dessous ou envoyez-nous un message.",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    whatsappMessage: "Bonjour, je souhaite prendre rendez-vous.",
  },

  reviews: {
    title: "Avis Patients",
    subtitle: "Découvrez ce que nos patients disent de leur expérience.",
  },

  services: {
    title: "Nos Services",
    subtitle:
      "Nous proposons une large gamme de services médicaux pour répondre à vos besoins de santé. Toutes les consultations comprennent un examen approfondi et des soins personnalisés.",
  },

  theme: {
    primaryColor: "#1E4DA1",
    accentColor: "#0F6E56",
    heroGradientFrom: "from-primary/5",
    heroGradientTo: "to-primary/10",
  },
};
