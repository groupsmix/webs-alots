/**
 * Footer variant components — barrel export.
 *
 * Maps FooterVariant values to their corresponding React components.
 * Used by the clinic public layout to dynamically pick the right footer.
 */

import type { ComponentType } from "react";
import type { TemplateDefinition, FooterVariant } from "@/lib/templates";
import { FooterCentered } from "./footer-centered";
import { FooterClassic } from "./footer-classic";
import { FooterMinimal } from "./footer-minimal";

/** Props shared by all footer variants. */
export interface FooterProps {
  clinicName: string;
  template?: TemplateDefinition;
}

export { FooterClassic, FooterMinimal, FooterCentered };

/** Footer component map for dynamic selection. */
export const FOOTER_COMPONENTS: Record<FooterVariant, ComponentType<FooterProps> | null> = {
  "classic-3col": FooterClassic,
  "minimal": FooterMinimal,
  "centered": FooterCentered,
  "hidden": null,
};
