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
    title: "Your Health, Our Priority",
    subtitle:
      "Professional healthcare services with a personal touch. Book your appointment online and experience modern, compassionate care.",
    ctaPrimary: "Book an Appointment",
    ctaSecondary: "Our Services",
    imageUrl: undefined,
  },

  about: {
    doctorName: "Dr. Ahmed Benali",
    specialty: "General Medicine",
    bio: "Dedicated to providing exceptional healthcare with a patient-centered approach. Combining modern medical practices with compassionate care for every patient.",
    photoUrl: undefined,
    education: "Doctor of Medicine \u2014 University of Casablanca",
    specialization: "Board Certified in General & Internal Medicine",
    experience: "15+ years of clinical practice",
    languages: "Arabic, French, English",
    practiceDescription:
      "Our clinic is equipped with modern medical technology and provides a comfortable, welcoming environment for all patients. We believe in preventive medicine and thorough diagnosis to ensure the best outcomes.",
    practiceDetails:
      "Whether you need a routine check-up, specialized consultation, or ongoing care management, our team is here to support your health journey. We accept most major insurance providers including CNSS and CNOPS.",
  },

  howToBook: {
    title: "How to Book an Appointment",
    subtitle:
      "Booking your appointment is quick and easy. Follow these simple steps to get started.",
    steps: [
      {
        title: "Choose a Service",
        description:
          "Browse our list of medical services and select the one that matches your needs.",
      },
      {
        title: "Pick a Date & Time",
        description:
          "Select from available time slots that work best for your schedule.",
      },
      {
        title: "Fill in Your Details",
        description:
          "Enter your name, phone number, and any relevant medical information.",
      },
      {
        title: "Confirm Your Booking",
        description:
          "Review your appointment details and confirm. You will receive a confirmation via WhatsApp or SMS.",
      },
    ],
  },

  location: {
    title: "Location & Hours",
    subtitle:
      "Visit us at our conveniently located clinic. We look forward to welcoming you.",
    address: "123 Bd Mohammed V, Casablanca",
    city: "Casablanca, Morocco",
    googleMapsEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.846!2d-7.6192!3d33.5731!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzPCsDM0JzIzLjIiTiA3wrAzNycwOS4xIlc!5e0!3m2!1sen!2sma!4v1",
    workingHours: [
      { day: "Monday", hours: "09:00 - 17:00" },
      { day: "Tuesday", hours: "09:00 - 17:00" },
      { day: "Wednesday", hours: "09:00 - 17:00" },
      { day: "Thursday", hours: "09:00 - 17:00" },
      { day: "Friday", hours: "09:00 - 17:00" },
      { day: "Saturday", hours: "09:00 - 13:00" },
      { day: "Sunday", hours: "Closed" },
    ],
  },

  contact: {
    title: "Contact Us",
    subtitle:
      "Have a question or need to reach us? We're here to help. Use any of the methods below or send us a message.",
    phone: "+212 6 12 34 56 78",
    whatsapp: "+212 6 12 34 56 78",
    email: "contact@clinic.ma",
    address: "123 Bd Mohammed V, Casablanca",
    whatsappMessage: "Hello, I would like to book an appointment.",
  },

  reviews: {
    title: "Patient Reviews",
    subtitle: "See what our patients have to say about their experience.",
  },

  services: {
    title: "Our Services",
    subtitle:
      "We offer a wide range of medical services to meet your healthcare needs. All consultations include a thorough examination and personalized care.",
  },

  theme: {
    primaryColor: "#1E4DA1",
    accentColor: "#0F6E56",
    heroGradientFrom: "from-primary/5",
    heroGradientTo: "to-primary/10",
  },
};
