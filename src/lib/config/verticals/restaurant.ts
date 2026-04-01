/**
 * Restaurant vertical definition.
 *
 * Covers restaurants, cafés, catering, and food service businesses.
 * Requires new DB tables: menus, menu_items, restaurant_tables, orders.
 * Extends existing booking system for table reservations.
 */

import type { VerticalDefinition } from "@/lib/config/verticals";

export const restaurantVertical: VerticalDefinition = {
  id: "restaurant",
  nameEn: "Restaurant",
  nameFr: "Restaurant",
  nameAr: "مطعم",
  icon: "UtensilsCrossed",
  categories: ["restaurant"],
  defaultFeatures: [
    "appointments",
    "departments",
    "menu_management",
    "table_management",
    "qr_ordering",
    "reservations",
  ],
  defaultServices: [
    { name: "Réservation table 2 personnes", duration_minutes: 90, price: 0 },
    { name: "Réservation table 4 personnes", duration_minutes: 90, price: 0 },
    { name: "Réservation table 6+ personnes", duration_minutes: 120, price: 0 },
    { name: "Événement privé", duration_minutes: 180, price: 0 },
    { name: "Brunch", duration_minutes: 120, price: 0 },
    { name: "Dîner de groupe", duration_minutes: 150, price: 0 },
  ],
  terminology: {
    client: "client",
    provider: "chef",
    appointment: "réservation",
    location: "restaurant",
  },
  templatePresets: [
    "restaurant-bold",
    "restaurant-elegant",
    "restaurant-modern",
  ],
  requiredDbTables: ["menus", "menu_items", "restaurant_tables", "restaurant_orders"],
};
