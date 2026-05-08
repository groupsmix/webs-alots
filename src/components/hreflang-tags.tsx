/**
 * Hreflang meta tags for multilingual SEO.
 * Tells search engines about French and Arabic versions of pages.
 */
export function HreflangTags({ path = "" }: { path?: string }) {
  const baseUrl = "https://oltigo.com";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return (
    <>
      <link rel="alternate" hrefLang="fr" href={`${baseUrl}${cleanPath}`} />
      <link rel="alternate" hrefLang="ar" href={`${baseUrl}${cleanPath}?lang=ar`} />
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${cleanPath}`} />
    </>
  );
}
