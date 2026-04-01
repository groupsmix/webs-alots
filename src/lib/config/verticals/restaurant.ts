/**
 * Restaurant vertical definition.
 *
 * Covers restaurants, cafés, and food service businesses.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const restaurantVertical: VerticalDefinition = {
  id: "restaurant",
  nameEn: "Restaurant",
  nameFr: "Restaurant",
  nameAr: "مطعم",
  icon: "UtensilsCrossed",
  categories: [],
  defaultFeatures: [
    "appointments",
    "departments",
  ],
  defaultServices: [
    { name: "Réservation table 2 personnes", duration_minutes: 90, price: 0 },
    { name: "Réservation table 4 personnes", duration_minutes: 90, price: 0 },
    { name: "Réservation table 6+ personnes", duration_minutes: 120, price: 0 },
    { name: "Événement privé", duration_minutes: 180, price: 0 },
  ],
  terminology: {
    client: "guest",
    provider: "chef",
    appointment: "reservation",
    location: "restaurant",
  },
  templatePresets: [
    "restaurant-bold",
    "restaurant-elegant",
    "restaurant-modern",
  ],
  requiredDbTables: ["menus", "menu_items"],
};
