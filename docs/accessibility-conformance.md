# Accessibility Conformance Statement (A201)

**Product:** Oltigo Health — Multi-tenant Healthcare SaaS
**Date:** 2026-05-28
**Standard:** WCAG 2.2 Level AA (target)
**Current gate:** WCAG 2.1 AA (automated, via axe-core in CI)

---

## Conformance Status

Oltigo Health **partially conforms** to WCAG 2.2 Level AA. "Partially conforms"
means that some aspects of the content do not yet fully conform to the standard.

### Automated Testing

An automated WCAG gate runs in CI on every pull request using
[axe-core](https://github.com/dequelabs/axe-core) via Playwright:

- **File:** `e2e/accessibility.spec.ts`
- **Tags tested:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`
- **Pages scanned:** Public landing page, booking flow, login page
- **Known exclusions:** `color-contrast` (decorative brand elements),
  `aria-prohibited-attr` (upstream shadcn/radix, tracked)

### Manual Testing

Manual accessibility review is planned on a semi-annual cadence covering:

- Keyboard-only navigation
- Screen reader compatibility (NVDA, VoiceOver)
- Zoom/reflow at 200%/400%
- Focus management in modals and dialogs
- RTL layout (Arabic locale)

## European Accessibility Act (EAA) 2025 Roadmap

The EAA (Directive 2019/882) applies from June 2025 to digital services
serving EU consumers. Oltigo's current Morocco-only deployment has limited
EAA exposure, but the following roadmap prepares for EU expansion:

| Phase                                      | Target Date    | Scope                           |
| ------------------------------------------ | -------------- | ------------------------------- |
| 1. Bump axe to WCAG 2.2 AA                 | 2026-Q2 (done) | CI gate updated                 |
| 2. Manual audit (keyboard + screen reader) | 2026-Q3        | Core patient flows              |
| 3. Conformance report (VPAT/EN 301 549)    | 2026-Q4        | Publish on /accessibility       |
| 4. Complaints channel                      | 2026-Q3        | Email: accessibility@oltigo.com |

## Complaints and Feedback

To report an accessibility issue or request content in an alternative format:

- **Email:** accessibility@oltigo.com
- **Response SLA:** 5 business days for acknowledgement, 30 days for resolution
- **Escalation:** If unresolved, contact the Moroccan CNDP (Commission Nationale
  de contrôle de la protection des Données à caractère Personnel)

## Limitations

| Component                | Limitation                                         | Alternative                   | Timeline |
| ------------------------ | -------------------------------------------------- | ----------------------------- | -------- |
| PDF prescription exports | May not be fully tagged for screen readers         | Plain-text fallback available | 2026-Q4  |
| Dental odontogram (SVG)  | Complex interactive SVG not screen-reader friendly | Tabular data view planned     | 2027-Q1  |
| WhatsApp notifications   | Third-party accessibility depends on Meta          | SMS fallback available        | N/A      |
