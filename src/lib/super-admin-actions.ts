"use server";

/**
 * Public super-admin server action façade.
 *
 * The concrete implementations live under `src/lib/super-admin/*-actions.ts`.
 * This file preserves the stable import surface used across the app.
 */

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { rawClient } from "@/lib/super-admin/base";
import {
  fetchBillingRecordsImpl,
  fetchClientSubscriptionsImpl,
  fetchRevenueStatsImpl,
  updateSubscriptionStatusImpl,
} from "@/lib/super-admin/billing-actions";
import {
  deleteClinicFeatureOverrideImpl,
  fetchClinicActivityLogsImpl,
  fetchClinicFeatureOverridesImpl,
  fetchClinicPatientCountImpl,
  fetchClinicStaffCountImpl,
  upsertClinicFeatureOverrideImpl,
} from "@/lib/super-admin/clinic-detail-actions";
import {
  activateClinicImpl,
  createClinicImpl,
  deleteClinicImpl,
  fetchClinicAdminUserIdImpl,
  fetchClinicByIdImpl,
  fetchClinicsImpl,
  updateClinicStatusImpl,
} from "@/lib/super-admin/clinic-lifecycle-actions";
import {
  createServiceImpl,
  createTimeSlotsForDoctorImpl,
} from "@/lib/super-admin/clinic-setup-actions";
import {
  createAnnouncementImpl,
  deleteAnnouncementImpl,
  fetchActivityLogsImpl,
  fetchAnnouncementsImpl,
  fetchDashboardStatsImpl,
  setAnnouncementActiveImpl,
  type DashboardStats,
  updateAnnouncementImpl,
} from "@/lib/super-admin/dashboard-actions";
import {
  bulkSetFeatureTierImpl,
  fetchFeatureDefinitionsImpl,
  fetchFeatureTogglesImpl,
  fetchPriceHistoryImpl,
  fetchPricingTiersImpl,
  updateFeatureDefinitionImpl,
  updatePricingTierImpl,
} from "@/lib/super-admin/feature-actions";
import { type UntypedClient } from "@/lib/super-admin/helpers";
import type {
  ClinicFeatureOverride,
  ClinicRow,
  CreateClinicInput,
  CreateServiceInput,
  CreateUserInput,
  CreateUserResult,
  ServiceRow,
  TimeSlotRow,
} from "@/lib/super-admin/models";
import {
  createPromotionImpl,
  deletePromotionImpl,
  fetchPromotionsImpl,
  setPromotionEnabledImpl,
} from "@/lib/super-admin/promotions-actions";
import { createUserImpl } from "@/lib/super-admin/staff-provisioning-actions";
import type {
  ActivityLog,
  Announcement,
  AnnouncementInput,
  BillingRecord,
  ClientSubscription,
  FeatureDefinition,
  FeatureToggleRow,
  PriceHistoryEntry,
  PricingTierRow,
  PromotionRow,
  RevenueStats,
} from "@/lib/super-admin/types";

export type {
  ActivityLog,
  Announcement,
  AnnouncementInput,
  BillingRecord,
  ClientSubscription,
  FeatureDefinition,
  FeatureToggleRow,
  PricingTierRow,
  PromotionRow,
  RevenueStats,
} from "@/lib/super-admin/types";
export type { DashboardStats } from "@/lib/super-admin/dashboard-actions";
export type {
  ClinicFeatureOverride,
  CreateClinicInput,
  CreateServiceInput,
  CreateUserAccess,
  CreateUserInput,
  CreateUserResult,
} from "@/lib/super-admin/models";

async function rawUntypedClient(): Promise<UntypedClient> {
  return (await rawClient()) as unknown as UntypedClient;
}

// ---------- Clinic ----------

export async function createClinic(input: CreateClinicInput): Promise<ClinicRow> {
  return createClinicImpl(await rawClient(), input);
}

export async function activateClinic(clinicId: string): Promise<void> {
  return activateClinicImpl(await rawClient(), clinicId);
}

export async function fetchClinics(): Promise<ClinicRow[]> {
  return fetchClinicsImpl(await rawClient());
}

export async function fetchClinicById(clinicId: string): Promise<ClinicRow | null> {
  return fetchClinicByIdImpl(await rawClient(), clinicId);
}

export async function fetchClinicAdminUserId(clinicId: string): Promise<string | null> {
  return fetchClinicAdminUserIdImpl(await rawClient(), clinicId);
}

export async function fetchClinicFeatureOverrides(
  clinicId: string,
): Promise<ClinicFeatureOverride[]> {
  return fetchClinicFeatureOverridesImpl(await rawClient(), clinicId);
}

export async function upsertClinicFeatureOverride(
  clinicId: string,
  featureId: string,
  enabled: boolean,
): Promise<void> {
  return upsertClinicFeatureOverrideImpl(await rawClient(), clinicId, featureId, enabled);
}

export async function deleteClinicFeatureOverride(
  clinicId: string,
  featureId: string,
): Promise<void> {
  return deleteClinicFeatureOverrideImpl(await rawClient(), clinicId, featureId);
}

export async function fetchClinicStaffCount(clinicId: string): Promise<number> {
  return fetchClinicStaffCountImpl(await rawClient(), clinicId);
}

export async function fetchClinicPatientCount(clinicId: string): Promise<number> {
  return fetchClinicPatientCountImpl(await rawClient(), clinicId);
}

export async function fetchClinicActivityLogs(clinicId: string): Promise<ActivityLog[]> {
  return fetchClinicActivityLogsImpl(await rawClient(), clinicId);
}

export async function updateClinicStatus(
  clinicId: string,
  status: "active" | "inactive" | "suspended",
): Promise<void> {
  return updateClinicStatusImpl(await rawClient(), clinicId, status);
}

export async function deleteClinic(
  clinicId: string,
  options: { force?: boolean } = {},
): Promise<{ deleted: true; patientCount: number }> {
  return deleteClinicImpl(clinicId, options);
}

// ---------- Promotions ----------

export async function fetchPromotions(): Promise<PromotionRow[]> {
  return fetchPromotionsImpl(await rawUntypedClient());
}

export async function createPromotion(input: {
  name: string;
  discount: number;
  tiers: string[];
  startDate: string;
  endDate: string;
}): Promise<PromotionRow> {
  return createPromotionImpl(await rawUntypedClient(), input);
}

export async function setPromotionEnabled(id: string, enabled: boolean): Promise<void> {
  return setPromotionEnabledImpl(await rawUntypedClient(), id, enabled);
}

export async function deletePromotion(id: string): Promise<void> {
  return deletePromotionImpl(await rawUntypedClient(), id);
}

// ---------- Billing ----------
export async function updateSubscriptionStatus(
  clinicId: string,
  action: "activate" | "suspend" | "cancel",
): Promise<void> {
  return updateSubscriptionStatusImpl(await rawClient(), clinicId, action);
}

// ---------- Provisioning ----------

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  return createUserImpl(await rawClient(), input);
}

// ---------- Services ----------

export async function createService(input: CreateServiceInput): Promise<ServiceRow> {
  return createServiceImpl(await rawClient(), input);
}

// ---------- Time Slots ----------

export async function createTimeSlotsForDoctor(
  doctorId: string,
  clinicId: string,
  slots: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    max_capacity?: number;
    buffer_minutes?: number;
  }[],
): Promise<TimeSlotRow[]> {
  return createTimeSlotsForDoctorImpl(await rawClient(), doctorId, clinicId, slots);
}

// ---------- Dashboard ----------

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return fetchDashboardStatsImpl(await rawClient());
}

// ---------- Billing Records ----------

export async function fetchBillingRecords(): Promise<BillingRecord[]> {
  return fetchBillingRecordsImpl(await rawClient());
}

// ---------- Announcements ----------

export async function fetchAnnouncements(): Promise<Announcement[]> {
  return fetchAnnouncementsImpl(await rawClient());
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const profile = await requireRole("super_admin");
  return createAnnouncementImpl(await createClient(), profile.name || "Super Admin", input);
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<Announcement> {
  return updateAnnouncementImpl(await rawClient(), id, input);
}

export async function setAnnouncementActive(id: string, active: boolean): Promise<void> {
  return setAnnouncementActiveImpl(await rawClient(), id, active);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  return deleteAnnouncementImpl(await rawClient(), id);
}

// ---------- Activity ----------

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  return fetchActivityLogsImpl(await rawClient());
}

// ---------- Feature Catalog ----------

export async function fetchFeatureDefinitions(): Promise<FeatureDefinition[]> {
  return fetchFeatureDefinitionsImpl(await rawClient());
}

export async function updateFeatureDefinition(
  featureId: string,
  updates: { globalEnabled?: boolean; availableTiers?: string[] },
): Promise<void> {
  return updateFeatureDefinitionImpl(await rawClient(), featureId, updates);
}

export async function bulkSetFeatureTier(tier: string, enabled: boolean): Promise<void> {
  return bulkSetFeatureTierImpl(await rawClient(), tier, enabled);
}

// ---------- Pricing ----------

export async function fetchPricingTiers(): Promise<PricingTierRow[]> {
  return fetchPricingTiersImpl(await rawClient());
}

export async function updatePricingTier(
  tierId: string,
  updates: {
    name?: string;
    pricing?: Record<string, { monthly: number; yearly: number }>;
    features?: { key: string; label: string; included: boolean; limit?: string }[];
  },
): Promise<void> {
  return updatePricingTierImpl(await rawClient(), tierId, updates);
}

export async function fetchPriceHistory(): Promise<PriceHistoryEntry[]> {
  return fetchPriceHistoryImpl(await rawClient());
}

// ---------- Feature Toggles ----------

export async function fetchFeatureToggles(): Promise<FeatureToggleRow[]> {
  return fetchFeatureTogglesImpl(await rawClient());
}

// ---------- Canonical Types ----------

export type { SystemType } from "@/lib/config/pricing";

// ---------- Revenue ----------

export async function fetchRevenueStats(): Promise<RevenueStats> {
  return fetchRevenueStatsImpl(await rawClient());
}

export async function fetchClientSubscriptions(): Promise<ClientSubscription[]> {
  return fetchClientSubscriptionsImpl(await rawClient());
}
