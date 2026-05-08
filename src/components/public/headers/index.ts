/**
 * Header variant components — barrel export.
 *
 * Maps HeaderVariant values to their corresponding React components.
 * Used by the clinic public layout to dynamically pick the right header.
 */

import type { ComponentType } from "react";
import type { TemplateDefinition, HeaderVariant } from "@/lib/templates";
import { HeaderBottomBar } from "./header-bottom-bar";
import { HeaderFloating } from "./header-floating";
import { HeaderTopSticky } from "./header-top-sticky";
import { HeaderTransparent } from "./header-transparent";

/** Props shared by all header variants. */
export interface HeaderProps {
  logoUrl: string | null;
  clinicName: string;
  navItems: NavItem[];
  template?: TemplateDefinition;
}

/** Navigation item for header/footer navigation. */
export interface NavItem {
  label: string;
  href: string;
}

export { HeaderTopSticky, HeaderTransparent, HeaderBottomBar, HeaderFloating };

/** Header component map for dynamic selection. */
export const HEADER_COMPONENTS: Record<HeaderVariant, ComponentType<HeaderProps>> = {
  "top-sticky": HeaderTopSticky,
  "top-transparent": HeaderTransparent,
  "side-left": HeaderTopSticky, // fallback to sticky
  "bottom-bar": HeaderBottomBar,
  "floating": HeaderFloating,
  "overlay": HeaderTransparent, // similar to transparent
};
