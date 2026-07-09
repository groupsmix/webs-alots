# ADR 0014: AI Kill Switch and Toggle Failure Posture

## Status

Accepted

## Date

2026-07-07

## Context

Oltigo has two distinct AI control surfaces:

1. A **global emergency stop** implemented in `src/lib/features.ts` via:
   - environment override: `AI_DISABLED=true`
   - KV-backed runtime flag: `FEATURE_FLAGS_KV["ai.enabled"]`

2. **Database-backed AI feature toggles** implemented in `src/lib/ai/feature-toggles.ts` via the
   global `ai_feature_toggles` table.

These controls do not share the same failure posture.

### Global kill switch behavior

`isAIEnabled()` currently behaves as follows:

- `AI_DISABLED=true` → AI is disabled immediately
- KV binding missing → AI stays enabled
- KV key missing / unset → AI stays enabled
- KV read error → AI stays enabled
- KV value explicitly `"false"` → AI is disabled

### AI feature toggle behavior

`loadFeatureToggles()` and `isAIFeatureEnabled()` currently behave as follows:

- toggle rows load successfully → known features obey admin state
- toggle load fails → empty toggle map, requests are not blocked
- unknown `feature_key` → allowed by design

The super-admin emergency stop UI already reflects this model: it treats the env var as the
authoritative fallback when feature-flag storage is unavailable.

## Decision

**Retain the current two-layer AI control model and document it explicitly.**

1. `AI_DISABLED=true` is the authoritative, incident-response-grade hard stop.
2. KV-backed `ai.enabled` is the normal runtime kill switch used for operator control.
3. Missing or degraded KV does **not** disable AI automatically; the runtime defaults to enabled
   for backwards compatibility.
4. Database-backed AI feature toggles are an opt-in gating layer, not a fail-closed allowlist.
5. Unknown AI feature keys remain allowed unless explicitly represented in `ai_feature_toggles`.

## Consequences

- **Positive:** Operators always retain a hard-stop path that does not depend on KV or dashboard
  availability.
- **Positive:** KV or DB-toggle outages do not brick AI traffic by accident during partial control-plane
  failures.
- **Negative:** A broken toggle backend does not automatically disable AI; operators must use the env
  override if they need a guaranteed stop during storage/control-plane incidents.
- **Negative:** The system trades strict fail-closed behavior for operational continuity and backwards
  compatibility.
- **Operational rule:** Incident runbooks and admin UI copy should treat the env override as the last-resort
  stop, not as a redundant implementation detail.

## References

- `src/lib/features.ts`
- `src/lib/ai/feature-toggles.ts`
- `src/lib/env-flags.ts`
- `src/app/(super-admin)/super-admin/settings/ai/emergency-stop.tsx`
- `docs/architecture/failure-semantics.md`
