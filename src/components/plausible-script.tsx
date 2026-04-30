import Script from "next/script";

/**
 * Plausible Analytics — platform-level analytics for the root domain.
 *
 * Unlike the per-clinic AnalyticsScript (GA/GTM), this tracks aggregate
 * metrics across the SaaS landing page (oltigo.com) such as visitor
 * counts, conversion funnels, and page views.
 *
 * Activated by setting NEXT_PUBLIC_PLAUSIBLE_DOMAIN in the environment.
 * Supports both Plausible Cloud and self-hosted instances.
 *
 * Privacy-first: no cookies, GDPR-compliant by default.
 *
 * A55.8: Accepts a `nonce` prop so the external script load is permitted
 * under the strict CSP (`script-src 'nonce-...' 'strict-dynamic'`).
 *
 * A60.1: No SRI hash is applied because Plausible updates its script
 * frequently and pinning a hash would break tracking silently. The CSP
 * `strict-dynamic` policy combined with the nonce provides equivalent
 * trust-chain integrity for the initial load.
 *
 * A60.3: `consentGiven` gates script loading on user consent. Plausible
 * itself is cookieless/GDPR-compliant, but clinic operators who additionally
 * enable GA/GTM are not — gating all analytics on the same consent flag
 * keeps the UX consistent and legally safe.
 */
export function PlausibleScript({
  nonce,
  consentGiven,
}: {
  /** CSP nonce for strict script-src policy */
  nonce?: string;
  /** A60.3: Only load after user consent (even though Plausible is cookieless) */
  consentGiven?: boolean;
} = {}) {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  // A60.3: Gate on consent when the prop is explicitly provided.
  // When consentGiven is undefined (not passed), load unconditionally
  // since Plausible is privacy-first and doesn't use cookies.
  if (consentGiven === false) return null;

  const host =
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";

  return (
    <Script
      id="plausible-analytics"
      strategy="afterInteractive"
      data-domain={domain}
      src={`${host}/js/script.js`}
      nonce={nonce}
    />
  );
}
