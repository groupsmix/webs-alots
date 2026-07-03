import type { Preview } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import "../src/app/globals.css";

/** Supported locales — used both for toolbar items and as a validation allowlist. */
const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Applies the active theme + locale globals to the preview <html> element so
 * that dark mode (`.dark` class — see globals.css `@custom-variant dark`) and
 * RTL (`dir="rtl"` + `.rtl` class, as the app's locale-switcher does) can be
 * exercised from the Storybook toolbar and asserted in component tests.
 *
 * The locale is validated against SUPPORTED_LOCALES before being written to
 * the DOM — URL-injected globals (e.g. `?globals=locale:xyz`) cannot inject
 * arbitrary strings into HTML attributes.
 */
function applyGlobals(theme: string, locale: string) {
  if (typeof document === "undefined") return;
  // Validate locale against allowlist to prevent arbitrary DOM attribute injection.
  const safeLocale: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as SupportedLocale)
    : "fr";
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  const dir = safeLocale === "ar" ? "rtl" : "ltr";
  root.setAttribute("dir", dir);
  root.setAttribute("lang", safeLocale);
  root.classList.toggle("rtl", safeLocale === "ar");
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Enforce accessibility violations as test failures when stories run under
    // the Vitest addon (see vitest.storybook.config.ts). Previously "todo",
    // which only surfaced issues in the UI and never failed anything.
    a11y: {
      test: "error",
    },
    viewport: {
      options: {
        mobile: { name: "Mobile (375px)", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet (768px)", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop (1280px)", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
  initialGlobals: {
    theme: "light",
    locale: "fr",
  },
  globalTypes: {
    theme: {
      description: "Global theme for components",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Locale and text direction",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: [
          { value: "fr", title: "Français (LTR)" },
          { value: "en", title: "English (LTR)" },
          { value: "ar", title: "العربية (RTL)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const { theme, locale } = context.globals as { theme?: string; locale?: string };
      // useEffect defers DOM mutations to after the render phase — performing
      // direct DOM writes during render is a React anti-pattern that can cause
      // layout thrashing and hydration mismatches.
      useEffect(() => {
        applyGlobals(theme ?? "light", locale ?? "fr");
      }, [theme, locale]);
      return <Story />;
    },
  ],
};

export default preview;
