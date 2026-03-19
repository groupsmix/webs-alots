/**
 * Theme Configuration
 *
 * Customize the look and feel per clinic.
 */

export interface ThemeConfig {
  /** Primary brand color (hex) */
  primaryColor: string;

  /** Secondary accent color (hex) */
  secondaryColor: string;

  /** Path to the clinic logo (relative to /public) */
  logoPath: string;

  /** Favicon path */
  faviconPath: string;

  /** Font family for headings */
  headingFont: string;

  /** Font family for body text */
  bodyFont: string;

  /** Hero section background image path */
  heroImagePath?: string;
}

export const themeConfig: ThemeConfig = {
  primaryColor: "#1E4DA1",
  secondaryColor: "#0F6E56",
  logoPath: "/logo.svg",
  faviconPath: "/favicon.ico",
  headingFont: "Geist",
  bodyFont: "Geist",
  heroImagePath: undefined,
};
