# ADR 0010 — CSP `style-src 'unsafe-inline'` Sunset Plan

- **Status:** Proposed
- **Date:** 2026-05-28
- **Context:** ETAP 1 audit finding L6-L-14

## Context

`src/lib/middleware/security-headers.ts:140` sets `style-src 'self' 'unsafe-inline'`.
The `unsafe-inline` directive weakens CSP by allowing any inline style attribute
or `<style>` block. The project uses Tailwind CSS (utility-first, no inline
styles in authored code), but third-party libraries (shadcn/ui, Radix
primitives) inject inline `style` attributes at runtime for positioning (portals,
popovers, dropdown menus, tooltips).

## Decision

Remove `'unsafe-inline'` from `style-src` once all runtime-injected inline
styles are replaced with Tailwind classes or nonce-tagged `<style>` blocks.

## Plan

1. Inventory all Radix/shadcn components that inject `style` attributes
   (Popover, Tooltip, DropdownMenu, Dialog, Sheet, Select, Command).
2. For each, either:
   - Replace with a CSS-variable approach (no inline style), or
   - Propagate the CSP nonce to `<style>` blocks via `StyleSheet` provider.
3. Add an E2E test that verifies `style-src` does **not** contain
   `'unsafe-inline'` once the migration is complete.
4. Deploy behind a `Reporting-Only` CSP header first, monitor for breakage
   for 7 days, then switch to enforcement.

## Consequences

- Blocks XSS vectors that rely on CSS injection (style attribute exfiltration).
- Requires a coordinated upgrade of shadcn/Radix components.
- Not a launch blocker — current posture is the industry default.
