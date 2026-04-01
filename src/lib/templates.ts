/**
 * Layout Template Definitions
 *
 * Each clinic (Pro tier+) can choose one of these predefined
 * homepage layouts. The template controls visual style — colors,
 * border-radius, typography weight, background mode, and layout
 * structure — while the actual content comes from the clinic's
 * branding / website config.
 */

export type TemplateId =
  | "modern"
  | "classic"
  | "elegant"
  | "bold"
  | "minimal"
  | "arabic";

/** Header layout variant */
export type HeaderVariant = "top-sticky" | "top-transparent" | "side-left" | "bottom-bar" | "floating" | "overlay";

/** Footer layout variant */
export type FooterVariant = "classic-3col" | "minimal" | "centered" | "hidden";

/** Navigation style variant */
export type NavStyle = "horizontal" | "vertical-side" | "hamburger-only" | "bottom-tabs" | "floating-dots";

/** Hero section layout variant */
export type HeroVariant = "split" | "centered" | "fullscreen-video" | "slider" | "parallax" | "none";

/** Product click behavior */
export type ProductClickBehavior = "modal" | "landing-page" | "side-panel" | "new-tab";

export interface TemplateDefinition {
  id: TemplateId;
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

export const templates: Record<TemplateId, TemplateDefinition> = {
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
};

export const templateList: TemplateDefinition[] = Object.values(templates);

export function getTemplate(id: string): TemplateDefinition {
  return templates[id as TemplateId] ?? templates.modern;
}
