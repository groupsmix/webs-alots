import { safeJsonLdStringify } from "@/lib/json-ld";

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

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(website) }}
    />
  );
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

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumb) }}
    />
  );
}
