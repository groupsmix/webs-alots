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
 */
export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  const host =
    process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "https://plausible.io";

  return (
    <Script
      id="plausible-analytics"
      strategy="afterInteractive"
      data-domain={domain}
      src={`${host}/js/script.js`}
    />
  );
}
