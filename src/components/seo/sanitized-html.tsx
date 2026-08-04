import { sanitizeHtml } from "@/lib/sanitize-html";

interface SanitizedHtmlProps {
  html: string;
  className?: string;
}

export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  const props: React.JSX.IntrinsicElements["div"] = {
    className,
    // SAFETY: sanitizeHtml removes dangerous tags/attrs before rendering (S5-06).
    // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
    dangerouslySetInnerHTML: { __html: sanitizeHtml(html) },
  };

  return <div {...props} />;
}
