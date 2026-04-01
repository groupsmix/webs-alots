/**
 * Hero variant components — barrel export.
 *
 * Maps HeroVariant values to their corresponding React components.
 * Used by the clinic public layout to dynamically pick the right hero.
 */

import type { ComponentType } from "react";
import type { TemplateDefinition, HeroVariant } from "@/lib/templates";
import { HeroFullscreen } from "./hero-fullscreen";
import { HeroParallax } from "./hero-parallax";
import { HeroSlider } from "./hero-slider";
import { HeroSplit } from "./hero-split";

/** Props shared by all hero variants. */
export interface HeroProps {
  clinicName: string;
  description?: string;
  imageUrl?: string | null;
  template?: TemplateDefinition;
  /** Optional slides for the slider variant. */
  slides?: HeroSlide[];
}

/** Individual slide for the slider hero variant. */
export interface HeroSlide {
  imageUrl: string | null;
  title?: string;
  description?: string;
}

export { HeroSplit, HeroFullscreen, HeroSlider, HeroParallax };

/** Hero component map for dynamic selection. */
export const HERO_COMPONENTS: Record<HeroVariant, ComponentType<HeroProps> | null> = {
  "split": HeroSplit,
  "centered": HeroSplit, // uses split as centered fallback
  "fullscreen-video": HeroFullscreen,
  "slider": HeroSlider,
  "parallax": HeroParallax,
  "none": null,
};
