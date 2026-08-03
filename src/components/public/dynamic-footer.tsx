"use client";

import { FOOTER_COMPONENTS } from "@/components/public/footers";
import type { TemplateDefinition, FooterVariant } from "@/lib/templates";

interface DynamicFooterProps {
  clinicName: string;
  footerVariant: FooterVariant;
  template: TemplateDefinition;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/**
 * Client component that dynamically selects the right footer variant
 * based on the clinic's template configuration.
 *
 * If the footerVariant is "hidden", renders nothing.
 */
export function DynamicFooter({
  clinicName,
  footerVariant,
  template,
  phone,
  email,
  address,
}: DynamicFooterProps) {
  const FooterComponent = FOOTER_COMPONENTS[footerVariant];

  if (!FooterComponent) return null;

  return (
    <FooterComponent
      clinicName={clinicName}
      template={template}
      phone={phone}
      email={email}
      address={address}
    />
  );
}
