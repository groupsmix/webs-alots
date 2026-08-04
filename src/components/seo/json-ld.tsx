import { safeJsonLdStringify } from "@/lib/json-ld";

interface JsonLdScriptProps {
  data: unknown;
  nonce?: string;
}

export function JsonLdScript({ data, nonce }: JsonLdScriptProps) {
  // SAFETY: safeJsonLdStringify escapes "<" to prevent </script> injection.
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  const scriptProps: React.JSX.IntrinsicElements["script"] = {
    type: "application/ld+json",
    nonce,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: safeJsonLdStringify(data) },
  };

  return <script {...scriptProps} />;
}

interface WebSiteJsonLdProps {
  url: string;
  name: string;
  searchUrl?: string;
  nonce?: string;
}

export function WebSiteJsonLd({ url, name, searchUrl, nonce }: WebSiteJsonLdProps) {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(searchUrl
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: searchUrl,
            },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };

  return <JsonLdScript data={website} nonce={nonce} />;
}

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
  nonce?: string;
}

export function BreadcrumbJsonLd({ items, nonce }: BreadcrumbJsonLdProps) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLdScript data={breadcrumb} nonce={nonce} />;
}
