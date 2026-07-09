import { beforeEach, describe, expect, it, vi } from "vitest";

const rawClient = vi.fn();
const requireRole = vi.fn();
const createClient = vi.fn();

const createUserImpl = vi.fn();
const createServiceImpl = vi.fn();
const createTimeSlotsForDoctorImpl = vi.fn();
const fetchDashboardStatsImpl = vi.fn();
const fetchAnnouncementsImpl = vi.fn();
const createAnnouncementImpl = vi.fn();
const updateAnnouncementImpl = vi.fn();
const setAnnouncementActiveImpl = vi.fn();
const deleteAnnouncementImpl = vi.fn();
const fetchBillingRecordsImpl = vi.fn();
const fetchClientSubscriptionsImpl = vi.fn();
const fetchRevenueStatsImpl = vi.fn();

vi.mock("@/lib/auth", () => ({ requireRole: (...args: unknown[]) => requireRole(...args) }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));
vi.mock("@/lib/super-admin/base", () => ({
  rawClient: (...args: unknown[]) => rawClient(...args),
}));
vi.mock("@/lib/super-admin/staff-provisioning-actions", () => ({
  createUserImpl: (...args: unknown[]) => createUserImpl(...args),
}));
vi.mock("@/lib/super-admin/clinic-setup-actions", () => ({
  createServiceImpl: (...args: unknown[]) => createServiceImpl(...args),
  createTimeSlotsForDoctorImpl: (...args: unknown[]) => createTimeSlotsForDoctorImpl(...args),
}));
vi.mock("@/lib/super-admin/dashboard-actions", () => ({
  fetchDashboardStatsImpl: (...args: unknown[]) => fetchDashboardStatsImpl(...args),
  fetchAnnouncementsImpl: (...args: unknown[]) => fetchAnnouncementsImpl(...args),
  fetchActivityLogsImpl: vi.fn(),
  createAnnouncementImpl: (...args: unknown[]) => createAnnouncementImpl(...args),
  updateAnnouncementImpl: (...args: unknown[]) => updateAnnouncementImpl(...args),
  setAnnouncementActiveImpl: (...args: unknown[]) => setAnnouncementActiveImpl(...args),
  deleteAnnouncementImpl: (...args: unknown[]) => deleteAnnouncementImpl(...args),
}));
vi.mock("@/lib/super-admin/billing-actions", () => ({
  fetchBillingRecordsImpl: (...args: unknown[]) => fetchBillingRecordsImpl(...args),
  fetchClientSubscriptionsImpl: (...args: unknown[]) => fetchClientSubscriptionsImpl(...args),
  fetchRevenueStatsImpl: (...args: unknown[]) => fetchRevenueStatsImpl(...args),
  updateSubscriptionStatusImpl: vi.fn(),
}));
vi.mock("@/lib/super-admin/clinic-detail-actions", () => ({
  deleteClinicFeatureOverrideImpl: vi.fn(),
  fetchClinicActivityLogsImpl: vi.fn(),
  fetchClinicFeatureOverridesImpl: vi.fn(),
  fetchClinicPatientCountImpl: vi.fn(),
  fetchClinicStaffCountImpl: vi.fn(),
  upsertClinicFeatureOverrideImpl: vi.fn(),
}));
vi.mock("@/lib/super-admin/clinic-lifecycle-actions", () => ({
  activateClinicImpl: vi.fn(),
  createClinicImpl: vi.fn(),
  deleteClinicImpl: vi.fn(),
  fetchClinicAdminUserIdImpl: vi.fn(),
  fetchClinicByIdImpl: vi.fn(),
  fetchClinicsImpl: vi.fn(),
  updateClinicStatusImpl: vi.fn(),
}));
vi.mock("@/lib/super-admin/feature-actions", () => ({
  bulkSetFeatureTierImpl: vi.fn(),
  fetchFeatureDefinitionsImpl: vi.fn(),
  fetchFeatureTogglesImpl: vi.fn(),
  fetchPriceHistoryImpl: vi.fn(),
  fetchPricingTiersImpl: vi.fn(),
  updateFeatureDefinitionImpl: vi.fn(),
  updatePricingTierImpl: vi.fn(),
}));
vi.mock("@/lib/super-admin/promotions-actions", () => ({
  createPromotionImpl: vi.fn(),
  deletePromotionImpl: vi.fn(),
  fetchPromotionsImpl: vi.fn(),
  setPromotionEnabledImpl: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  rawClient.mockResolvedValue({ tag: "raw-client" });
  createClient.mockResolvedValue({ tag: "cookie-client" });
  requireRole.mockResolvedValue({ name: "Super Admin" });
});

describe("super-admin-actions facade", () => {
  it("createUser passes the resolved raw client through and returns the impl result", async () => {
    const resultRow = { id: "user-1", role: "doctor" };
    createUserImpl.mockResolvedValueOnce(resultRow);
    const { createUser } = await import("@/lib/super-admin-actions");

    const result = await createUser({
      clinic_id: "clinic-1",
      role: "doctor",
      name: "Dr Test",
      email: "doctor@example.com",
    });

    expect(createUserImpl).toHaveBeenCalledWith({ tag: "raw-client" }, expect.any(Object));
    expect(result).toEqual(resultRow);
  });

  it("createService passes the raw client through and returns the impl result", async () => {
    const resultRow = { id: "svc-1", clinic_id: "clinic-1", name: "Consultation" };
    createServiceImpl.mockResolvedValueOnce(resultRow);
    const { createService } = await import("@/lib/super-admin-actions");

    const result = await createService({
      clinic_id: "clinic-1",
      name: "Consultation",
      duration_minutes: 30,
      price: 200,
    });

    expect(createServiceImpl).toHaveBeenCalledWith({ tag: "raw-client" }, expect.any(Object));
    expect(result).toEqual(resultRow);
  });

  it("createTimeSlotsForDoctor passes doctor/clinic/slot arguments through cleanly", async () => {
    const slotRows = [{ id: "slot-1", doctor_id: "doctor-1" }];
    createTimeSlotsForDoctorImpl.mockResolvedValueOnce(slotRows);
    const { createTimeSlotsForDoctor } = await import("@/lib/super-admin-actions");

    const result = await createTimeSlotsForDoctor("doctor-1", "clinic-1", [
      { day_of_week: 1, start_time: "09:00", end_time: "12:00", max_capacity: 3 },
    ]);

    expect(createTimeSlotsForDoctorImpl).toHaveBeenCalledWith(
      { tag: "raw-client" },
      "doctor-1",
      "clinic-1",
      [{ day_of_week: 1, start_time: "09:00", end_time: "12:00", max_capacity: 3 }],
    );
    expect(result).toEqual(slotRows);
  });

  it("fetchDashboardStats returns the impl result without error", async () => {
    const stats = { totalClinics: 10, activeSubscriptions: 8 };
    fetchDashboardStatsImpl.mockResolvedValueOnce(stats);
    const { fetchDashboardStats } = await import("@/lib/super-admin-actions");

    const result = await fetchDashboardStats();

    expect(fetchDashboardStatsImpl).toHaveBeenCalledWith({ tag: "raw-client" });
    expect(result).toEqual(stats);
  });

  it("fetchBillingRecords passes the raw client through and returns the impl result", async () => {
    const rows = [{ id: "bill-1", amountDue: 500 }];
    fetchBillingRecordsImpl.mockResolvedValueOnce(rows);
    const { fetchBillingRecords } = await import("@/lib/super-admin-actions");

    const result = await fetchBillingRecords();

    expect(fetchBillingRecordsImpl).toHaveBeenCalledWith({ tag: "raw-client" });
    expect(result).toEqual(rows);
  });

  it("fetchRevenueStats passes the raw client through and returns the impl result", async () => {
    const stats = {
      mrr: 1000,
      arr: 12000,
      totalClinics: 5,
      activePaidClinics: 4,
      churnedThisMonth: 1,
      churnRate: 0.2,
      planBreakdown: { pro: 4 },
      revenueByMonth: [{ month: "2026-07", revenue: 1000 }],
    };
    fetchRevenueStatsImpl.mockResolvedValueOnce(stats);
    const { fetchRevenueStats } = await import("@/lib/super-admin-actions");

    const result = await fetchRevenueStats();

    expect(fetchRevenueStatsImpl).toHaveBeenCalledWith({ tag: "raw-client" });
    expect(result).toEqual(stats);
  });

  it("fetchClientSubscriptions passes the raw client through and returns the impl result", async () => {
    const rows = [
      {
        id: "sub-1",
        clinicId: "clinic-1",
        clinicName: "Clinic One",
        systemType: "doctor",
        SubscriptionPlan: "growth",
        tierName: "Growth",
        status: "active",
        currentPeriodStart: "2026-07-01",
        currentPeriodEnd: "2026-08-01",
        billingCycle: "monthly",
        amount: 499,
        lastPayment: null,
        daysUntilRenewal: 24,
      },
    ];
    fetchClientSubscriptionsImpl.mockResolvedValueOnce(rows);
    const { fetchClientSubscriptions } = await import("@/lib/super-admin-actions");

    const result = await fetchClientSubscriptions();

    expect(fetchClientSubscriptionsImpl).toHaveBeenCalledWith({ tag: "raw-client" });
    expect(result).toEqual(rows);
  });

  it("fetchAnnouncements passes the raw client through and returns the impl result", async () => {
    const rows = [{ id: "ann-1", title: "Maintenance" }];
    fetchAnnouncementsImpl.mockResolvedValueOnce(rows);
    const { fetchAnnouncements } = await import("@/lib/super-admin-actions");

    const result = await fetchAnnouncements();

    expect(fetchAnnouncementsImpl).toHaveBeenCalledWith({ tag: "raw-client" });
    expect(result).toEqual(rows);
  });

  it("createAnnouncement uses the cookie client and super-admin display name", async () => {
    const row = { id: "ann-2", title: "Launch" };
    createAnnouncementImpl.mockResolvedValueOnce(row);
    requireRole.mockResolvedValueOnce({ name: "Amina Admin" });
    const { createAnnouncement } = await import("@/lib/super-admin-actions");

    const result = await createAnnouncement({
      title: "Launch",
      message: "Soon",
      type: "info",
      target: "all",
      targetLabel: "All clinics",
    });

    expect(requireRole).toHaveBeenCalledWith("super_admin");
    expect(createAnnouncementImpl).toHaveBeenCalledWith({ tag: "cookie-client" }, "Amina Admin", {
      title: "Launch",
      message: "Soon",
      type: "info",
      target: "all",
      targetLabel: "All clinics",
    });
    expect(result).toEqual(row);
  });

  it("updateAnnouncement, setAnnouncementActive, and deleteAnnouncement pass through cleanly", async () => {
    const updated = { id: "ann-3", title: "Updated" };
    updateAnnouncementImpl.mockResolvedValueOnce(updated);
    setAnnouncementActiveImpl.mockResolvedValueOnce(undefined);
    deleteAnnouncementImpl.mockResolvedValueOnce(undefined);
    const { updateAnnouncement, setAnnouncementActive, deleteAnnouncement } =
      await import("@/lib/super-admin-actions");

    const updatedResult = await updateAnnouncement("ann-3", {
      title: "Updated",
      message: "Body",
      type: "warning",
      target: "all",
      targetLabel: "All clinics",
    });
    await expect(setAnnouncementActive("ann-3", true)).resolves.toBeUndefined();
    await expect(deleteAnnouncement("ann-3")).resolves.toBeUndefined();

    expect(updateAnnouncementImpl).toHaveBeenCalledWith({ tag: "raw-client" }, "ann-3", {
      title: "Updated",
      message: "Body",
      type: "warning",
      target: "all",
      targetLabel: "All clinics",
    });
    expect(setAnnouncementActiveImpl).toHaveBeenCalledWith({ tag: "raw-client" }, "ann-3", true);
    expect(deleteAnnouncementImpl).toHaveBeenCalledWith({ tag: "raw-client" }, "ann-3");
    expect(updatedResult).toEqual(updated);
  });
});
