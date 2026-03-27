import Script from "next/script";

/**
 * Inject Google Analytics (GA4) or Google Tag Manager per clinic.
 *
 * The tracking ID is stored in the clinic's branding/config in Supabase.
 * Pass `gaId` (starts with "G-") for GA4 or `gtmId` (starts with "GTM-") for GTM.
 */
export function AnalyticsScript({
  gaId,
  gtmId,
}: {
  gaId?: string | null;
  gtmId?: string | null;
}) {
  if (gtmId) {
    return (
      <Script
        id="gtm-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
        }}
      />
    );
  }

  if (gaId) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
        <Script
          id="ga4-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
          }}
        />
      </>
    );
  }

  return null;
}
