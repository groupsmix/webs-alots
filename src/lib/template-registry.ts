import type { ComponentType, ReactNode } from "react";
import ArabicTemplate from "@/components/public/templates/arabic";
import BoldTemplate from "@/components/public/templates/bold";
import ClassicTemplate from "@/components/public/templates/classic";
import ElegantTemplate from "@/components/public/templates/elegant";
import MinimalTemplate from "@/components/public/templates/minimal";
import ModernTemplate from "@/components/public/templates/modern";
import PremiumTemplate from "@/components/public/templates/premium";
import type { PublicPageProps } from "@/components/public/templates/shared";
import type { ClinicBranding } from "@/lib/data/public";
import type { Locale } from "@/lib/i18n";
import type { TemplateDefinition, TemplateId } from "./templates";

export type { PublicPageProps };

/** Props passed to a template's custom Header component. */
export interface TemplateHeaderProps {
  logoUrl: string | null;
  clinicName: string;
  template: TemplateDefinition;
  navItems: { label: string; href: string }[];
  sectionVisibility?: Record<string, boolean>;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

/** Props passed to a template's custom Footer component. */
export interface TemplateFooterProps {
  clinicName: string;
  template: TemplateDefinition;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  locale?: Locale;
}

/** Props passed to a template's custom Layout component. */
export interface TemplateLayoutProps {
  children: ReactNode;
  branding: ClinicBranding;
  template: TemplateDefinition;
  locale: Locale;
}

/**
 * A self-contained template package.
 *
 * Each template can provide its own Page (required), optional custom Header/Footer,
 * and an optional Layout that takes full control over the public page shell.
 * If a Layout is provided, it is responsible for rendering the header/footer.
 */
export interface TemplatePackage {
  Page: ComponentType<PublicPageProps>;
  Header?: ComponentType<TemplateHeaderProps>;
  Footer?: ComponentType<TemplateFooterProps>;
  Layout?: ComponentType<TemplateLayoutProps>;
}

export const templatePackages: Record<string, TemplatePackage> = {
  modern: { Page: ModernTemplate },
  classic: { Page: ClassicTemplate },
  elegant: { Page: ElegantTemplate },
  minimal: { Page: MinimalTemplate },
  bold: { Page: BoldTemplate },
  arabic: { Page: ArabicTemplate },
  premium: { Page: PremiumTemplate },
};

/** Backwards-compatible page map derived from the registry. */
export const templatePages: Record<string, ComponentType<PublicPageProps>> = Object.fromEntries(
  Object.entries(templatePackages).map(([id, pkg]) => [id, pkg.Page]),
);

export function getTemplatePackage(id: string): TemplatePackage {
  return templatePackages[id] ?? templatePackages.modern;
}

export function getTemplatePage(id: string): ComponentType<PublicPageProps> {
  return getTemplatePackage(id).Page;
}

// Re-export TemplateId so consumers can keep importing from either registry.
export type { TemplateId };
