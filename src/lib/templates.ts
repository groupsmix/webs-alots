import {
  mergeSectionVisibility,
  type SectionKey,
  type SectionVisibility,
} from "@/lib/section-visibility";

/**
 * Layout Template Definitions
 *
 * Each clinic (Pro tier+) can choose one of these predefined
 * homepage layouts. The template controls visual style — colors,
 * border-radius, typography weight, background mode, and layout
 * structure — while the actual content comes from the clinic's
 * branding / website config.
 */

/**
 * Template identifiers are free-form strings.
 *
 * Existing built-in templates use kebab-case IDs (modern, classic, …),
 * but the system no longer constrains the list. New templates can be
 * registered in `src/lib/template-registry.ts` and added here as metadata.
 */
export type TemplateId = string;

/** Header layout variant */
export type HeaderVariant =
  | "top-sticky"
  | "top-transparent"
  | "side-left"
  | "bottom-bar"
  | "floating"
  | "overlay"
  | "premium";

/** Footer layout variant */
export type FooterVariant = "classic-3col" | "minimal" | "centered" | "hidden" | "premium";

/** Navigation style variant */
type NavStyle = "horizontal" | "vertical-side" | "hamburger-only" | "bottom-tabs" | "floating-dots";

/** Hero section layout variant */
type HeroVariant =
  | "split"
  | "centered"
  | "fullscreen-video"
  | "slider"
  | "parallax"
  | "none"
  | "premium";

/** Product click behavior */
export type ProductClickBehavior = "modal" | "landing-page" | "side-panel" | "new-tab";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  /** Tailwind classes applied to the page wrapper */
  wrapperClass: string;
  /** Hero section style variant */
  heroStyle: "split" | "centered" | "fullwidth" | "overlay";
  /** Card style variant */
  cardStyle: "shadow" | "bordered" | "flat" | "elevated";
  /** Overall border radius theme */
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "full";
  /** Background mode */
  bgMode: "light" | "dark" | "gradient";
  /** Whether the layout is RTL */
  rtl: boolean;
  /** Preview thumbnail description (for admin picker) */
  preview: string;

  // ── Structural template fields ──

  /** Header component variant */
  headerVariant: HeaderVariant;
  /** Footer component variant */
  footerVariant: FooterVariant;
  /** Navigation style */
  navStyle: NavStyle;
  /** Hero component variant */
  heroVariant: HeroVariant;
  /** Order of sections on the public page */
  sectionOrder: string[];
  /** What happens when a product/service is clicked */
  productClickBehavior: ProductClickBehavior;
}

const templates: Record<string, TemplateDefinition> = {
  modern: {
    id: "modern",
    name: "Modern",
    description: "Big hero image, cards layout, clean white",
    wrapperClass: "bg-white text-gray-900",
    heroStyle: "split",
    cardStyle: "shadow",
    borderRadius: "lg",
    bgMode: "light",
    rtl: false,
    preview: "Clean, contemporary design with card-based layout and large hero imagery",
    headerVariant: "top-sticky",
    footerVariant: "classic-3col",
    navStyle: "horizontal",
    heroVariant: "split",
    sectionOrder: ["hero", "services", "doctors", "reviews", "about", "location", "contact"],
    productClickBehavior: "modal",
  },
  classic: {
    id: "classic",
    name: "Classic",
    description: "Traditional medical look, blue tones, structured",
    wrapperClass: "bg-blue-50/30 text-gray-900",
    heroStyle: "centered",
    cardStyle: "bordered",
    borderRadius: "md",
    bgMode: "light",
    rtl: false,
    preview: "Professional medical design with structured layout and blue accents",
    headerVariant: "top-sticky",
    footerVariant: "classic-3col",
    navStyle: "horizontal",
    heroVariant: "centered",
    sectionOrder: ["hero", "services", "doctors", "about", "reviews", "location", "contact"],
    productClickBehavior: "modal",
  },
  elegant: {
    id: "elegant",
    name: "Elegant",
    description: "Soft colors, rounded corners, luxury feel",
    wrapperClass: "bg-rose-50/20 text-gray-800",
    heroStyle: "centered",
    cardStyle: "elevated",
    borderRadius: "xl",
    bgMode: "light",
    rtl: false,
    preview: "Refined, luxury aesthetic perfect for dental and aesthetic clinics",
    headerVariant: "top-transparent",
    footerVariant: "centered",
    navStyle: "horizontal",
    heroVariant: "parallax",
    sectionOrder: ["hero", "about", "services", "reviews", "doctors", "location", "contact"],
    productClickBehavior: "side-panel",
  },
  bold: {
    id: "bold",
    name: "Bold",
    description: "Dark background, strong colors, big text",
    wrapperClass: "bg-gray-950 text-white",
    heroStyle: "fullwidth",
    cardStyle: "flat",
    borderRadius: "lg",
    bgMode: "dark",
    rtl: false,
    preview: "Eye-catching dark theme with bold typography and vibrant accents",
    headerVariant: "floating",
    footerVariant: "minimal",
    navStyle: "horizontal",
    heroVariant: "fullscreen-video",
    sectionOrder: ["hero", "services", "about", "reviews", "doctors", "contact", "location"],
    productClickBehavior: "landing-page",
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Very simple, lots of whitespace, fast loading",
    wrapperClass: "bg-white text-gray-900",
    heroStyle: "centered",
    cardStyle: "flat",
    borderRadius: "sm",
    bgMode: "light",
    rtl: false,
    preview: "Ultra-clean design with maximum whitespace and minimal decoration",
    headerVariant: "top-sticky",
    footerVariant: "minimal",
    navStyle: "horizontal",
    heroVariant: "centered",
    sectionOrder: ["hero", "services", "about", "contact"],
    productClickBehavior: "modal",
  },
  arabic: {
    id: "arabic",
    name: "Arabic-first",
    description: "RTL layout, Arabic typography optimized",
    wrapperClass: "bg-white text-gray-900",
    heroStyle: "split",
    cardStyle: "shadow",
    borderRadius: "lg",
    bgMode: "light",
    rtl: true,
    preview: "Right-to-left layout optimized for Arabic typography and reading flow",
    headerVariant: "top-sticky",
    footerVariant: "classic-3col",
    navStyle: "horizontal",
    heroVariant: "split",
    sectionOrder: ["hero", "services", "doctors", "reviews", "about", "location", "contact"],
    productClickBehavior: "modal",
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "High-end, calming healthcare design with soft gradients and generous whitespace",
    wrapperClass: "bg-[#F8FAFC] text-slate-900",
    heroStyle: "split",
    cardStyle: "elevated",
    borderRadius: "xl",
    bgMode: "light",
    rtl: false,
    preview: "Premium medical landing page with hero stats, floating cards, and trust signals",
    headerVariant: "premium",
    footerVariant: "premium",
    navStyle: "horizontal",
    heroVariant: "premium",
    sectionOrder: [
      "hero",
      "services",
      "why",
      "doctors",
      "reviews",
      "location",
      "contactForm",
      "faq",
    ],
    productClickBehavior: "modal",
  },
};

export const templateList: TemplateDefinition[] = Object.values(templates);

export function getTemplate(id: string): TemplateDefinition {
  return templates[id] ?? templates.modern;
}

/**
 * Map loose template section names (legacy or admin-facing) onto the canonical
 * `SectionKey` vocabulary used by the renderers.
 */
const SECTION_ALIASES: Record<string, SectionKey> = {
  contact: "contactForm",
  contactform: "contactForm",
  team: "doctors",
  testimonials: "reviews",
};

/** Sections appended in stable order when a template does not list them. */
export const DEFAULT_SECTION_TAIL: SectionKey[] = [
  "services",
  "doctors",
  "reviews",
  "blog",
  "location",
  "booking",
  "contactForm",
  "insurance",
  "faq",
];

/**
 * Resolve a template's `sectionOrder` into an ordered list of renderable keys.
 *
 * - `hero` is always rendered first when visible.
 * - Unknown/legacy names are mapped via `SECTION_ALIASES` or dropped.
 * - Any visible section missing from the template order is appended in a
 *   stable default order so content never disappears.
 */
export function resolveSectionOrder(
  templateOrder: string[],
  renderable: SectionKey[],
): SectionKey[] {
  const allow = new Set(renderable);
  const ordered: SectionKey[] = [];
  const seen = new Set<SectionKey>();

  const push = (key: SectionKey) => {
    if (allow.has(key) && !seen.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  };

  push("hero");
  for (const raw of templateOrder) {
    const key = (SECTION_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()) as SectionKey;
    push(key);
  }
  for (const key of DEFAULT_SECTION_TAIL) push(key);
  return ordered;
}

/**
 * Build the visible sections set from template defaults and clinic overrides.
 *
 * The `hero` section is always considered visible because it is handled first.
 */
export function resolveSections(partial?: Partial<SectionVisibility> | null): SectionVisibility {
  return mergeSectionVisibility(partial);
}
