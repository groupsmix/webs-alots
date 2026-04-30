/* eslint-disable i18next/no-literal-string */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "Oltigo Health accessibility conformance statement. WCAG 2.2 AA compliance status.",
  openGraph: {
    title: "Accessibility Statement",
    description:
      "Oltigo Health accessibility conformance statement.",
  },
};

/**
 * A201: Accessibility Conformance Statement
 *
 * Required by:
 * - European Accessibility Act (EAA) 2025 (if EU tenants are onboarded)
 * - WCAG 2.2 AA best practice
 * - Audit finding A201: "No conformance statement published"
 */
export default function AccessibilityPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-3xl prose prose-gray">
        <h1 className="text-3xl font-bold mb-8">
          Accessibility Statement
        </h1>

        <p className="text-muted-foreground mb-6">
          Last updated: April 2026
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            1. Our Commitment
          </h2>
          <p className="text-muted-foreground mb-4">
            Oltigo Health is committed to ensuring digital accessibility for
            people with disabilities. We are continually improving the user
            experience for everyone and applying the relevant accessibility
            standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            2. Conformance Status
          </h2>
          <p className="text-muted-foreground mb-4">
            We aim to conform to the{" "}
            <strong>Web Content Accessibility Guidelines (WCAG) 2.2 Level AA</strong>.
            Our current conformance status is <strong>partially conformant</strong>,
            meaning that some parts of the content do not yet fully conform to
            the accessibility standard.
          </p>
          <p className="text-muted-foreground mb-4">
            The following measures have been implemented:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>
              <strong>Colour contrast:</strong> All clinic branding colours are
              validated against WCAG AA contrast ratios before being saved. A
              dedicated contrast-checking utility enforces minimum 4.5:1 ratios
              for normal text.
            </li>
            <li>
              <strong>Keyboard navigation:</strong> A skip-link is present on
              all pages (WCAG 2.4.1). Interactive elements are reachable and
              operable via keyboard.
            </li>
            <li>
              <strong>Automated testing:</strong> We use{" "}
              <code>jest-axe</code> for automated accessibility testing on key
              components including login, booking, contact forms, breadcrumbs,
              and empty states.
            </li>
            <li>
              <strong>Semantic HTML:</strong> Pages use proper heading hierarchy,
              landmarks, ARIA attributes, and form labels.
            </li>
            <li>
              <strong>RTL support:</strong> Full right-to-left layout support
              for Arabic content.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            3. Known Limitations
          </h2>
          <p className="text-muted-foreground mb-4">
            Despite our best efforts, some areas may not yet be fully
            accessible:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>
              Some dynamic content loaded after initial page render may not be
              immediately announced to screen readers.
            </li>
            <li>
              WCAG 2.2-specific criteria (e.g., 2.4.11 Focus Not Obscured,
              2.5.7 Dragging Movements, 3.3.7 Redundant Entry, 3.3.8 Accessible
              Authentication) have not been fully verified through manual audit.
            </li>
            <li>
              Automated test coverage currently extends to 5 core components;
              additional routes and views are being added incrementally.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            4. Compatibility
          </h2>
          <p className="text-muted-foreground mb-4">
            Oltigo Health is designed to be compatible with the following
            assistive technologies:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Screen readers (VoiceOver, NVDA, JAWS)</li>
            <li>Screen magnification software</li>
            <li>Voice recognition software</li>
            <li>Keyboard-only navigation</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            The site is tested on the latest versions of Chrome, Firefox,
            Safari, and Edge, as well as mobile browsers on iOS and Android.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            5. Feedback
          </h2>
          <p className="text-muted-foreground mb-4">
            We welcome your feedback on the accessibility of Oltigo Health.
            If you encounter accessibility barriers or have suggestions for
            improvement, please contact us via our{" "}
            <a href="/contact" className="text-primary hover:underline">
              contact page
            </a>
            . We aim to respond to accessibility feedback within 5 business
            days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            6. Enforcement
          </h2>
          <p className="text-muted-foreground mb-4">
            This statement was prepared based on a self-assessment of the
            website. We are committed to scheduling a formal third-party
            accessibility audit and will update this statement with the results.
            This statement aligns with the requirements of the European
            Accessibility Act (EAA) Directive 2019/882.
          </p>
        </section>
      </div>
    </div>
  );
}
