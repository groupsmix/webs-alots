import Script from "next/script";

/**
 * Sanitize a tracking ID to prevent script injection.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function sanitizeTrackingId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Inject Google Analytics (GA4) or Google Tag Manager per clinic.
 *
 * The tracking ID is stored in the clinic's branding/config in Supabase.
 * Pass `gaId` (starts with "G-") for GA4 or `gtmId` (starts with "GTM-") for GTM.
 *
 * A55.8: The `nonce` prop is required so inline scripts pass the strict CSP
 * (`script-src 'nonce-...' 'strict-dynamic'`). Without it, Next.js Script
 * does not auto-add the nonce in App Router and the inline script silently
 * fails under CSP enforcement.
 *
 * A60.3: The `consentGiven` prop gates script injection on user consent.
 * When false/undefined, no tracking scripts are loaded. This satisfies
 * Moroccan Law 09-08 and GDPR Art.7 consent requirements.
 */
export function AnalyticsScript({
  gaId,
  gtmId,
  nonce,
  consentGiven,
}: {
  gaId?: string | null;
  gtmId?: string | null;
  /** CSP nonce — required for inline scripts under strict CSP */
  nonce?: string;
  /** A60.3: Only inject tracking scripts after user consent */
  consentGiven?: boolean;
}) {
  // A60.3 / A85-1 fix: Only block on explicit opt-out (=== false), not falsy undefined.
  // This preserves functionality for existing callers that don't pass consentGiven.
  if (consentGiven === false) return null;

  if (gtmId) {
    return (
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${sanitizeTrackingId(gtmId)}');`,
        }}
      />
    );
  }

  if (gaId) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${sanitizeTrackingId(gaId)}`}
          strategy="afterInteractive"
          nonce={nonce}
        />
        <Script
          id="ga4-config"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${sanitizeTrackingId(gaId)}');`,
          }}
        />
      </>
    );
  }

  return null;
}
