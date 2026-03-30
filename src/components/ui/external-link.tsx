import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

/**
 * Wrapper around `<a>` for external URLs.
 *
 * Automatically sets `target="_blank"` and `rel="noopener noreferrer"` so
 * every outbound link is safe and consistent (Issue 42).
 */
export function ExternalLink({
  href,
  children,
  className,
  ...props
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
}
