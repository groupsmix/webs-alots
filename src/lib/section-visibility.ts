/**
 * Section Visibility Configuration
 *
 * Controls which sections appear on the public clinic website.
 * Clinic admins (Pro tier+) can toggle sections ON/OFF from
 * the admin settings. The order stays fixed per template.
 */

export interface SectionVisibility {
  hero: boolean;
  services: boolean;
  doctors: boolean;
  reviews: boolean;
  blog: boolean;
  beforeAfter: boolean;
  location: boolean;
  booking: boolean;
  contactForm: boolean;
  insurance: boolean;
  faq: boolean;
}

export type SectionKey = keyof SectionVisibility;

export const defaultSectionVisibility: SectionVisibility = {
  hero: true,
  services: true,
  doctors: true,
  reviews: true,
  blog: true,
  beforeAfter: true,
  location: true,
  booking: true,
  contactForm: true,
  insurance: true,
  faq: true,
};

export interface SectionMeta {
  key: SectionKey;
  label: string;
  description: string;
  alwaysOn?: boolean;
}

export const sectionDefinitions: SectionMeta[] = [
  {
    key: "hero",
    label: "Hero Banner",
    description: "Main banner at the top of your homepage",
    alwaysOn: true,
  },
  {
    key: "services",
    label: "Services List",
    description: "Display your available medical services",
  },
  {
    key: "doctors",
    label: "Doctor / Team Profiles",
    description: "Show your doctors and staff members",
  },
  {
    key: "reviews",
    label: "Patient Reviews",
    description: "Display patient testimonials and ratings",
  },
  {
    key: "blog",
    label: "Blog / Articles",
    description: "Show recent blog posts and health articles",
  },
  {
    key: "beforeAfter",
    label: "Before / After Gallery",
    description: "Showcase treatment results with before & after photos",
  },
  {
    key: "location",
    label: "Location / Map",
    description: "Show your clinic location on Google Maps",
  },
  {
    key: "booking",
    label: "Booking Widget",
    description: "Quick booking call-to-action section",
  },
  {
    key: "contactForm",
    label: "Contact Form",
    description: "Allow visitors to send you a message",
  },
  {
    key: "insurance",
    label: "Insurance Accepted",
    description: "List accepted insurance providers",
  },
  {
    key: "faq",
    label: "FAQ Section",
    description: "Frequently asked questions and answers",
  },
];

/**
 * Merge partial visibility data (from DB) with defaults,
 * ensuring all keys exist.
 */
export function mergeSectionVisibility(
  partial: Partial<SectionVisibility> | null | undefined,
): SectionVisibility {
  return {
    ...defaultSectionVisibility,
    ...(partial ?? {}),
  };
}
