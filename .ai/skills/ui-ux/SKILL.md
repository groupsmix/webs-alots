# UI/UX Design Intelligence for Oltigo Health

> Curated from [ui-ux-pro-max](https://github.com/nicholascpark/ui-ux-pro-max) (MIT License — attribution below).
> Adapted for Oltigo Health's healthcare SaaS dashboard context.

## Purpose

This skill provides design intelligence for AI coding agents building UI in this repo.
Before creating or modifying any UI component, consult the relevant knowledge packs
in `data/` and follow these reasoning rules.

## Reasoning Rules

### 1. Component Hierarchy

- Use existing shadcn/ui components from `src/components/ui/` before creating new ones
- Match the existing Tailwind 4 design tokens — defined CSS-first via the `@theme` block in `src/app/globals.css` (this project has no `tailwind.config.ts`)
- Dashboard pages follow the Card + Grid pattern from analytics pages

### 2. Healthcare SaaS Context

- Medical data must be visually prominent but never overwhelming
- Use color coding for urgency/severity (red=critical, orange=warning, green=ok, blue=info)
- Icons from `lucide-react` — the repo's standard icon library
- All interactive elements must have clear loading + error states

### 3. RTL / Arabic Support

- All layouts must work in RTL mode (Arabic locale)
- Use logical CSS properties (`margin-inline-start` not `margin-left`) when possible
- Text alignment: use `text-start`/`text-end` not `text-left`/`text-right`
- Test layouts with `dir="rtl"` before shipping Arabic-facing UI

### 4. Accessibility (WCAG 2.1 AA for Medical UIs)

- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text
- All interactive elements must be keyboard-navigable
- Medical alerts must use `role="alert"` and be announced by screen readers
- Form fields must have associated labels (not just placeholders)
- Error states must be conveyed in text, not just color

### 5. Chart / Data Visualization

- Reuse chart patterns from `src/components/analytics/analytics-dashboard.tsx`
- Use `recharts` (already in dependencies) for charts
- Provide text alternatives for chart data (summary cards above charts)
- Consistent axis formatting: dates in `fr-MA` locale, currency in MAD

### 6. Responsive Design

- Mobile-first: all dashboards must work on phone screens
- Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`
- Tables should use horizontal scroll on mobile, not shrink columns
- Cards stack vertically on mobile, grid on desktop

## Knowledge Packs

| Pack          | File                     | Description                                     |
| ------------- | ------------------------ | ----------------------------------------------- |
| Styles        | `data/styles.csv`        | Color tokens, spacing, shadows, borders         |
| Typography    | `data/typography.csv`    | Font families, sizes, weights, RTL/Arabic rules |
| Accessibility | `data/accessibility.csv` | WCAG rules for medical UI, ARIA patterns        |

## Attribution

UI/UX design intelligence pattern adapted from [ui-ux-pro-max](https://github.com/nicholascpark/ui-ux-pro-max) by Nicholas C. Park, licensed under MIT.
