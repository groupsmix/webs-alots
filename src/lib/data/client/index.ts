"use client";

/**
 * Client-side data layer — barrel re-export.
 *
 * This file re-exports every domain module so that existing imports
 * from "@/lib/data/client" continue to work without changes.
 */

// Core infrastructure
export { createClient, type ClinicUser, getCurrentUser, clearLookupCache } from "./_core";

export * from "./appointments";
export * from "./users";
export * from "./services";
export * from "./reviews";
export * from "./prescriptions";
export * from "./invoices";
export * from "./clinical";
export * from "./mutations";
export * from "./dental";
export * from "./pharmacy";
export * from "./clinic";
export * from "./analytics";
export * from "./booking";
export * from "./pharmacy-transactions";
export * from "./subscription";
export * from "./parapharmacy";
export * from "./radiology";
export * from "./medical-equipment";
export * from "./kpis";
export * from "./clinic-centers";
export * from "./para-medical";
export * from "./onboarding";
export * from "./timeline";
export * from "./family";
