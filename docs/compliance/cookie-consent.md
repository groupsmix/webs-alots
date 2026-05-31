# Cookie consent v1 design (A64)

Status: implemented (this commit).
Owners: platform / compliance.
Spec sources: GDPR Art. 7, EDPB Guidelines 05/2020 + 03/2022 on consent,
French CNIL "Cookies and similar trackers" recommendation, UK ICO cookie
guidance, Moroccan Loi 09-08 (CNDP).

## Goal

A single source of truth for how the public landing pages (oltigo.com root
domain) collect, store, refresh, and honour cookie / tracker consent. The
banner is the only legitimate entry point. Tenant-scoped clinic apps
inherit the same envelope but do not own this surface; they read it through
`getStoredCookiePreferences`.

## Decisions

### 1. Categories

Three categories. Functional is always on (strictly necessary cookies are
out of scope of consent under ePrivacy Art. 5(3)).

| Category   | Default | Examples                                   |
| ---------- | ------- | ------------------------------------------ |
| Functional | on      | session, CSRF, language, theme             |
| Analytics  | off     | Plausible, Google Analytics 4 (per-clinic) |
| Marketing  | off     | Sentry Replay session recording            |

Reject-by-default is enforced both at the storage layer (`DEFAULT_PREFERENCES`)
and at the UI (no pre-ticked checkboxes).

### 2. Storage envelope

```ts
interface StoredConsent {
  v: number; // schema version (CONSENT_VERSION)
  t: number; // granted-at, epoch ms
  prefs: CookiePreferences;
}
```

Persisted as `localStorage["cookie-consent"]`. JSON, ASCII only, single key.

We chose localStorage over cookies because:

1. The consent payload is read by client components at hydration; cookies
   add a header round-trip cost for every static request.
2. Server-side audit logging happens via `/api/consent`, so we never need
   the consent on a server request to authorise anything.
3. Functional cookies (the only category that does set cookies) are
   strictly-necessary and out of consent scope, so the asymmetry between
   "stored in localStorage" and "applies to cookies" is acceptable.

### 3. Version + expiry

- `CONSENT_VERSION` starts at `1`. Bump on any of:
  - new category added
  - new processor added to an existing category
  - material wording change in the banner copy
- `CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000` (12 months). Upper bound
  from ICO and CNIL guidance for cookie consent freshness. After expiry the
  banner re-prompts with `DEFAULT_PREFERENCES` as the starting state so the
  user makes a fresh choice rather than confirming a stale one.

### 4. Status state machine

```
                            +---------------+
   getConsentStatus  -----> |    missing    | --- show banner ---> save ---+
                            +---------------+                              |
                            | stale-version | --- show banner ---> save ---+
                            +---------------+                              |
                            |    expired    | --- show banner ---> save ---+
                            +---------------+                              |
                            |     fresh     | --- apply prefs, no UI ------+
                            +---------------+
```

`getStoredCookiePreferences` returns `DEFAULT_PREFERENCES` for any non-fresh
status, so downstream gates (Plausible, GA, Sentry Replay) treat the user
as "no consent given" until they re-confirm.

### 5. Migration

The reader accepts three legacy shapes so existing browsers do not get
stuck in a re-prompt loop on the first deploy after v1:

1. `"accepted"` (raw string): migrated to `ALL_ACCEPTED` at current version.
2. `"declined"` (raw string): migrated to `DEFAULT_PREFERENCES` at current version.
3. Bare `CookiePreferences` object: returned as `v: 0` so the status is
   `stale-version` and the banner re-prompts. Defensive: we do not silently
   bump the version on a bare object because we cannot know which
   processor list the user was consenting to.

### 6. Re-open mechanism

Footer link "Cookie Settings" (`src/components/public/cookie-settings-link.tsx`)
dispatches a `cookie-consent:reopen` window event. The banner subscribes
and shows itself. The current prefs (if fresh) pre-populate the panel so
the user can withdraw analytics without re-checking marketing.

### 7. Cross-tab sync

When another tab persists a fresh consent, this tab's banner closes via
the `storage` event listener. Plausible, ConsentGatedAnalytics, and
ConsentGatedReplay already listen for both `storage` and the same-tab
`cookie-consent:changed` custom event.

### 8. Server-side audit

`POST /api/consent` logs every save to `consent_logs` (clinic-scoped row,
IP + user agent, granted boolean, optional user id). Fire-and-forget.
Failures never block the UI. This is the GDPR Art. 7(1) "demonstrable"
record; localStorage alone is not sufficient evidence.

### 9. Analytics gating

| Component             | Reads consent via                       | Behaviour when not consented                                      |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| PlausibleScript       | useSyncExternalStore on prefs.analytics | does not render the `<Script>`                                    |
| ConsentGatedAnalytics | useEffect + storage event               | renders AnalyticsScript with `consentGiven={false}`               |
| ConsentGatedReplay    | useEffect + custom event                | does not call `Sentry.addIntegration(replayIntegration())`        |
| applyAnalyticsConsent | direct call from saveAndClose           | removes any already-injected script tags + sets `ga-disable-<id>` |

Note: the cookie-consent component sets the GA opt-out flag using
`getGaMeasurementId()` from `src/lib/env.ts`. No direct `process.env`
access in any component as of A64.

### 10. Out of scope for v1

Deferred to a future iteration; not blocking ship:

- Per-region banner gating (currently always shown, which is correct under
  Loi 09-08 for our Moroccan user base; ePrivacy + Loi 09-08 both apply in
  our markets).
- Vendor-level granularity (right now Analytics is one toggle for both
  Plausible and GA; users cannot opt into Plausible while declining GA).
- Server-pushed re-prompt (when we bump the version, only users who load
  the site after deploy see the new prompt; we do not push to active
  sessions).
- A11y: keyboard escape to dismiss without choosing. Currently the only
  way to close is to make a choice, which matches "no inferred consent"
  but is hostile to keyboard users; revisit in A64.v2.

## File map

| File                                               | Role                         |
| -------------------------------------------------- | ---------------------------- |
| `src/components/cookie-consent.tsx`                | banner + storage layer       |
| `src/components/plausible-script.tsx`              | Plausible gate               |
| `src/components/consent-gated-analytics.tsx`       | GA / GTM gate                |
| `src/components/consent-gated-replay.tsx`          | Sentry Replay gate           |
| `src/components/public/cookie-settings-link.tsx`   | footer re-open               |
| `src/components/consent-summary-banner.tsx`        | post-consent summary         |
| `src/app/api/consent/route.ts`                     | server audit log             |
| `src/components/__tests__/cookie-consent.test.tsx` | unit tests for storage layer |

## Test coverage

`cookie-consent.test.tsx` covers:

- getConsentStatus: missing, unparseable, unknown shape, legacy v0a string
  migration (accepted + declined), legacy v0b bare-object stale-version,
  numeric version below current, expired, fresh, boundary at expiry, and
  malformed envelope with bad prefs shape.
- getStoredCookiePreferences: defaults vs fresh preferences across each
  status path.
- persistConsent: round-trip serialisation, overwrite of legacy values.
- CONSENT_MAX_AGE_MS: numeric constant matches 12 months.

The banner component itself is not unit tested in this PR; the existing
Playwright E2E suite exercises the click paths after the PR #908 pre-seed
fix. A future PR may add component-level tests with Testing Library.
