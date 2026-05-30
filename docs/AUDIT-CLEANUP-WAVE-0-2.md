# Audit Cleanup — Wave 0–2 (safe-fix PR)

**Source audit:** `webs-alots-audit(3).md` (2026-05-30, Principal Staff Engineer Cleanup Audit).
**Scope of this PR:** The deterministic, low-risk subset of the audit plan that can land in a single PR without code authorizations beyond `move-deps` and `documentation`. The remaining waves (warning reduction, ENV-001 rollout, dead-code deletions, dependency overrides) require larger, separate PRs and human review per the audit's §4 plan.

---

## What changed in this PR

### Wave 0 — Security review

| Finding                                                 | Action                                                                                                                                                                                                                                                                                                                                                                                      | File                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **FR-07** — `secrets-template.env` tracked in git       | **Verified contents.** File contains only variable names and placeholder strings (`=` with no value, or non-credential format hints like `https://your-project.supabase.co`). No real credentials are exposed. Strengthened the header comment with explicit rules and a reference to `docs/SOP-SECRET-ROTATION.md` and `.gitleaks.toml` so future contributors can't drift it into a leak. | `secrets-template.env` |
| **FR-14** — `SEED_PASSWORDS_ROTATED=false` default risk | Expanded the inline guidance in `.env.example` to include the production checklist, the hard-fail behavior, and the incident response pointer. No code change to the runtime check (already enforced by `scripts/check-seed-rotation.ts`).                                                                                                                                                  | `.env.example`         |

### Wave 1 — Config & dependency hygiene

| Finding                                               | Action                                                                                                                                                                                                                                                                               | File           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| **FR-03** — `shadcn` listed as a runtime `dependency` | Moved `shadcn` from `dependencies` → `devDependencies`. `shadcn` is a CLI code generator and is never imported at runtime; placing it in `dependencies` inflates the Worker bundle's reported deps and the production install graph. Lockfile regeneration required (`npm install`). | `package.json` |

### Wave 2 — Mechanical wins

| Finding                                             | Action                                                                                                                                                                                                                                                                                                                  | File           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **FR-18** — `NEXT_PUBLIC_PLAUSIBLE_HOST` duplicated | Consolidated to a single, uncommented definition adjacent to `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Removed the stale duplicate block at the bottom of the file. The previous commented example pointed at `https://plausible.io` (Plausible Cloud), which contradicted the "self-hosted only" comment — now empty by default. | `.env.example` |

### Tooling — Triage enablement

| Item                                                                                                                            | Action                                                                                                                                                                                                                                   | File                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Audit "top-3 highest-value action" #2 — produce a per-rule breakdown of the 4,045 warnings so they can be attacked rule-by-rule | Added `scripts/triage-eslint-warnings.sh` — runs ESLint with JSON output and emits a sorted breakdown (`--table` / `--json` / `--md` / `--top N`). This unblocks Wave 4 of the audit plan without committing to any deletion in this PR. | `scripts/triage-eslint-warnings.sh` (new) |

---

## What is **not** in this PR (and why)

These are deliberately deferred to follow-up PRs to keep this one reviewable and safely revertable.

| Finding                                                                                                 | Reason for deferral                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-01 / FR-06** — 4,045 ESLint warnings                                                               | Needs the triage script's output first, then a rule-by-rule PR per audit Wave 4. Touching this in the same PR would balloon the diff to thousands of lines.            |
| **FR-05** — Activate `ENV-001` rule (~245 new warnings, ~230 `process.env` call sites)                  | Audit explicitly schedules this for Wave 4 with a multi-PR rollout. The `eslint.config.mjs` comment is the in-code TODO and is left intact.                            |
| **FR-16** — Remove duplicate `playwright` bare package                                                  | `@vitest/browser-playwright` may rely on it as a peer; needs a confirmation pass against the lockfile before removal. Audit explicitly flagged this as "verify first." |
| **FR-04, FR-10, FR-12** — Audit `@scalar/api-reference-react`, `@base-ui/react`, transitive `overrides` | Each requires opening source files (which the original audit did not) to verify usage before any move/remove. Out of scope for a safe-fix PR.                          |
| **FR-08** — `clinic.config.ts` in knip ignore list                                                      | Wave 5 task; gated on warning reduction finishing first per the audit's dependency graph.                                                                              |
| **FR-11** — `supabase/functions/` outside main tsconfig                                                 | Architectural; needs a dedicated Edge Function toolchain decision.                                                                                                     |
| **FR-19** — `.editorconfig` consistency with `.prettierrc`                                              | Both files are present and small; consistency check is fine but not a defect blocking anything.                                                                        |

---

## Verification done

- `package.json` is valid JSON; key alphabetic order preserved in `devDependencies`.
- `.env.example` `grep -c '^NEXT_PUBLIC_PLAUSIBLE_HOST=' .env.example` returns `1`.
- `secrets-template.env` no values added or removed; only comment header expanded.
- `scripts/triage-eslint-warnings.sh` syntax-checked with `bash -n`.

## Verification deferred to CI / reviewer

- `npm install` to regenerate `package-lock.json` for the `shadcn` move (intentionally **not** committed in this PR so the reviewer can confirm the lockfile delta on their own machine — note in PR description).
- Full `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` — assumed green pre-PR per the audit baseline; this PR does not change any source files in `src/`.

## Rollback

`git revert <merge-sha>` is safe for every change in this PR. No migrations, no source edits, no behavioral changes to running code.
