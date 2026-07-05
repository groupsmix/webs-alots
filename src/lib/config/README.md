# `src/lib/config`

Clinic-domain configuration: types, defaults, and presentation constants that
describe _what a clinic/system is and how it's priced/displayed_ — as opposed
to app-wide config (see `src/config/README.md`).

| File                  | Purpose                                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinic-types.ts`     | `ClinicType` definitions and per-type metadata.                                                                                                                                                                                                                       |
| `default-services.ts` | Default service catalogs seeded per clinic type.                                                                                                                                                                                                                      |
| `verticals.ts`        | `VerticalId` union and vertical definitions.                                                                                                                                                                                                                          |
| `pricing.ts`          | Presentation-only constants for the super-admin pricing UI: `systemTypeLabels`, `tierColors`, and the canonical `SystemType` type (`"doctor" \| "dentist" \| "pharmacy"`). Re-exports `SubscriptionPlan` from `@/lib/subscription-billing` rather than redefining it. |

## Single source of truth for shared domain types

- `SubscriptionPlan` (`free`/`starter`/`professional`/`enterprise`) — defined once in `@/lib/subscription-billing`. Every other module (`@/lib/config/pricing`, `@/lib/super-admin-actions`, `@/lib/types/database`) imports or re-exports that definition instead of redeclaring it.
- `SystemType` (`doctor`/`dentist`/`pharmacy`) — defined once in `@/lib/config/pricing`. `@/lib/super-admin-actions` re-exports it rather than redeclaring it.

If you need either type elsewhere, import it from these canonical locations — do not add a third local declaration.

## Ownership boundary vs `src/config`

- `src/lib/config` — clinic-domain config (this directory).
- `src/config` — app-level config (AI agents, specialist dashboard registry). See `src/config/README.md`.
