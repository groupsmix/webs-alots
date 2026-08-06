import type { ComponentType } from "react";
import ArabicTemplate from "@/components/public/templates/arabic";
import BoldTemplate from "@/components/public/templates/bold";
import ClassicTemplate from "@/components/public/templates/classic";
import ElegantTemplate from "@/components/public/templates/elegant";
import MinimalTemplate from "@/components/public/templates/minimal";
import ModernTemplate from "@/components/public/templates/modern";
import PremiumTemplate from "@/components/public/templates/premium";
import type { PublicPageProps } from "@/components/public/templates/shared";
import type { TemplateId } from "./templates";

export type { PublicPageProps };

export const templatePages: Record<TemplateId, ComponentType<PublicPageProps>> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  elegant: ElegantTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  arabic: ArabicTemplate,
  premium: PremiumTemplate,
};
