import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

/**
 * Applies the active theme + locale globals to the preview <html> element so
 * that dark mode (`.dark` class — see globals.css `@custom-variant dark`) and
 * RTL (`dir="rtl"` + `.rtl` class, as the app's locale-switcher does) can be
 * exercised from the Storybook toolbar and asserted in component tests.
 */
function applyGlobals(theme: string, locale: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  const dir = locale === "ar" ? "rtl" : "ltr";
  root.setAttribute("dir", dir);
  root.setAttribute("lang", locale);
  root.classList.toggle("rtl", locale === "ar");
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
      applyGlobals(theme ?? "light", locale ?? "fr");
      return <Story />;
    },
  ],
};

export default preview;
