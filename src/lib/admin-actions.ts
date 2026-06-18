"use server";

/**
 * Clinic-Admin Supabase actions — the write layer for the `(admin)` dashboard.
 *
 * The read layer already lives in `src/lib/data/client/*` (RLS-enforced browser
 * client). This module is its missing write-side mirror: create / update /
 * deactivate / delete for the entities a clinic admin manages (staff, patients,
 * services), plus the Supabase Auth login-account creation that can only happen
 * server-side with the service-role key.
 *
 * SECURITY MODEL — every exported function:
 *   1. Calls `requireRole("clinic_admin", "super_admin")` to authenticate.
 *   2. Derives `clinic_id` from the authenticated profile. The browser never
 *      supplies a clinic id for writes, so a caller cannot reach another tenant.
 *   3. Adds an explicit `.eq("clinic_id", clinicId)` as defence-in-depth on top
 *      of the `admin_users_all` / `admin_services_all` RLS policies
 *      (migration 00002). The session client respects RLS, so a forged row id
 *      from another clinic simply matches zero rows.
 *
 * A `users` row with `role = 'patient'` is still a clinic user, so the
 * `updateClinicUser` / `setClinicUserActive` / `deleteClinicUser` helpers cover
 * doctors, receptionists AND patients — there is no separate patient path.
 */

import { requireRole } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { staffWelcomeEmail } from "@/lib/email-templates";
import { getSiteUrl, getSupabaseServiceRoleKey } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient, createScopedAdminClient } from "@/lib/supabase-server";
import type {
  DialysisMachineStatus,
  Json,
  LabInvoiceStatus,
  TablesInsert,
  TablesUpdate,
} from "@/lib/types/database";

// ─────────────────────────────────────────────
// Shared context + row shapes
// ─────────────────────────────────────────────

/** Staff roles a clinic admin may create directly from the dashboard. */
export type ClinicStaffRole = "doctor" | "receptionist";

export interface ClinicUserRow {
  id: string;
  auth_id: string | null;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClinicServiceRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
  currency: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Authenticate the caller as a clinic admin and resolve their clinic id +
 * session-scoped Supabase client. Throws if the user has no clinic context
 * (e.g. a super_admin with `clinic_id = null` hitting a clinic-only action).
 */
async function adminContext() {
  const profile = await requireRole("clinic_admin", "super_admin");
  if (!profile.clinic_id) {
    throw new Error("No clinic context for the current user");
  }
  const supabase = await createClient();
  return { profile, clinicId: profile.clinic_id, supabase };
}

// ─────────────────────────────────────────────
// Staff & patient (users) CRUD
// ─────────────────────────────────────────────

export interface CreateClinicUserInput {
  role: ClinicStaffRole;
  name: string;
  email?: string;
  phone?: string;
  /** Role-specific extras (e.g. doctor specialty, consultation_fee, languages). */
  metadata?: Record<string, unknown>;
}

/**
 * Create a staff user (doctor / receptionist) for the caller's clinic.
 *
 * When an email is supplied and `SUPABASE_SERVICE_ROLE_KEY` is configured a
 * real Supabase Auth account is provisioned (auto-confirmed, must change
 * password) and a recovery link is emailed so the staff member can set their
 * own password. If auth provisioning is unavailable the public.users row is
 * still created (without a login) so the dashboard never silently fails.
 */
export async function createClinicUser(input: CreateClinicUserInput): Promise<ClinicUserRow> {
  const { clinicId, supabase } = await adminContext();

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const role = input.role;

  let authId: string | null = null;

  // 1. Best-effort Supabase Auth account so the staff member can log in.
  if (email && getSupabaseServiceRoleKey()) {
    try {
      const admin = createScopedAdminClient("register_clinic", clinicId);
      const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 8);
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, role, clinic_id: clinicId, must_change_password: true },
      });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: listData } = await admin.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u: { email?: string | null; id: string }) => u.email === email,
          );
          if (existing) authId = existing.id;
        } else {
          logger.warn("Failed to create auth account for staff — creating without login", {
            context: "admin-actions",
            role,
            error: authError.message,
          });
        }
      } else if (authUser?.user) {
        authId = authUser.user.id;
      }
    } catch (err) {
      logger.warn("Auth account creation threw — creating staff without login", {
        context: "admin-actions",
        error: err,
      });
    }
  }

  // 2. The users.auth_id column is UNIQUE — never link an auth_id that another
  //    profile already owns, otherwise the insert fails with a duplicate key.
  if (authId) {
    const { data: existingRow } = await supabase
      .from("users") // nosemgrep: tenant-scoping — intentional cross-tenant auth_id uniqueness check; users.auth_id is a global Supabase Auth identity, not clinic-scoped
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    if (existingRow) {
      logger.warn("auth_id already linked to a users row — creating staff without auth link", {
        context: "admin-actions",
        authId,
      });
      authId = null;
    }
  }

  const insertPayload: Record<string, unknown> = {
    clinic_id: clinicId,
    role,
    name,
    email,
    phone,
    metadata: (input.metadata ?? {}) as Json,
    is_active: true,
    ...(authId ? { auth_id: authId } : {}),
  };

  const { data, error } = await supabase
    .from("users") // nosemgrep: tenant-scoping — clinic_id is inside insertPayload (derived from authenticated profile); INSERT has no .eq() chain by design
    .insert(insertPayload as TablesInsert<"users">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create ${role}: ${error.message}`);

  // 3. Best-effort welcome email with a password-setup link.
  if (email && authId) {
    try {
      const siteUrl = getSiteUrl() || "https://oltigo.com";
      const admin = createScopedAdminClient("register_clinic", clinicId);
      const { data: resetLink } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/login?reset=true` },
      });
      const loginUrl = resetLink?.properties?.action_link ?? `${siteUrl}/login`;
      const template = staffWelcomeEmail({
        staffName: name,
        clinicName: clinicId,
        email,
        loginUrl,
        role,
      });
      await sendEmail({ to: email, ...template });
    } catch (emailErr) {
      logger.warn("Failed to send staff welcome email", {
        context: "admin-actions",
        error: emailErr,
      });
    }
  }

  return data as unknown as ClinicUserRow;
}

export interface UpdateClinicUserInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  /** Shallow-merged into the existing metadata so untouched keys survive. */
  metadata?: Record<string, unknown>;
}

/** Update a clinic user (doctor / receptionist / patient) in the caller's clinic. */
export async function updateClinicUser(
  userId: string,
  patch: UpdateClinicUserInput,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.email !== undefined) update.email = patch.email?.toString().trim() || null;
  if (patch.phone !== undefined) update.phone = patch.phone?.toString().trim() || null;

  if (patch.metadata !== undefined) {
    const { data: existing } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", userId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const current = ((existing as { metadata?: Record<string, unknown> } | null)?.metadata ??
      {}) as Record<string, unknown>;
    update.metadata = { ...current, ...patch.metadata } as Json;
  }

  const { error } = await supabase
    .from("users")
    .update(update as TablesUpdate<"users">)
    .eq("id", userId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update user: ${error.message}`);
}

/**
 * Activate / deactivate (ban) a clinic user. For a medical records system this
 * is the safe alternative to deletion — the row and its history are preserved
 * while access is revoked.
 */
export async function setClinicUserActive(userId: string, isActive: boolean): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("users")
    .update({ is_active: isActive } as TablesUpdate<"users">)
    .eq("id", userId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to update user status: ${error.message}`);
}

/** Hard-delete a clinic user. Prefer {@link setClinicUserActive} for staff/patients. */
export async function deleteClinicUser(userId: string): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to delete user: ${error.message}`);
}

// ─────────────────────────────────────────────
// Service CRUD
// ─────────────────────────────────────────────

export interface CreateClinicServiceInput {
  name: string;
  description?: string;
  duration_minutes: number;
  price?: number;
  currency?: string;
  category?: string;
  is_active?: boolean;
}

export async function createClinicService(
  input: CreateClinicServiceInput,
): Promise<ClinicServiceRow> {
  const { clinicId, supabase } = await adminContext();

  const name = input.name.trim();
  if (!name) throw new Error("Service name is required");

  const insertPayload: Record<string, unknown> = {
    clinic_id: clinicId,
    name,
    description: input.description?.trim() || null,
    duration_minutes: input.duration_minutes,
    price: input.price ?? null,
    currency: input.currency ?? "MAD",
    category: input.category?.trim() || null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("services") // nosemgrep: tenant-scoping — clinic_id is inside insertPayload (derived from authenticated profile); INSERT has no .eq() chain by design
    .insert(insertPayload as TablesInsert<"services">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create service: ${error.message}`);
  return data as unknown as ClinicServiceRow;
}

export interface UpdateClinicServiceInput {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price?: number;
  currency?: string;
  category?: string;
  is_active?: boolean;
}

export async function updateClinicService(
  serviceId: string,
  patch: UpdateClinicServiceInput,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description.trim() || null;
  if (patch.duration_minutes !== undefined) update.duration_minutes = patch.duration_minutes;
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.category !== undefined) update.category = patch.category.trim() || null;
  if (patch.is_active !== undefined) update.is_active = patch.is_active;

  const { error } = await supabase
    .from("services")
    .update(update as TablesUpdate<"services">)
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update service: ${error.message}`);
}

export async function setClinicServiceActive(serviceId: string, isActive: boolean): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive } as TablesUpdate<"services">)
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to update service status: ${error.message}`);
}

export async function deleteClinicService(serviceId: string): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("clinic_id", clinicId);
  if (error) throw new Error(`Failed to delete service: ${error.message}`);
}

// ─────────────────────────────────────────────
// Clinic center / specialist admin CRUD
// ─────────────────────────────────────────────

export interface CreateClinicDepartmentInput {
  name: string;
  nameAr?: string;
  floor?: string;
  description?: string;
}

export async function createClinicDepartment(input: CreateClinicDepartmentInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("departments")
    .insert({
      clinic_id: clinicId,
      name: input.name.trim(),
      name_ar: input.nameAr?.trim() || null,
      floor: input.floor?.trim() || null,
      description: input.description?.trim() || null,
      is_active: true,
    } as TablesInsert<"departments">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create department: ${error.message}`);
  return data;
}

export async function setClinicDepartmentActive(
  departmentId: string,
  isActive: boolean,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("departments")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"departments">)
    .eq("id", departmentId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update department status: ${error.message}`);
}

export interface CreateClinicRoomInput {
  roomNumber: string;
  roomType: string;
  floor?: string;
  totalBeds: number;
}

export async function createClinicRoom(input: CreateClinicRoomInput) {
  const { clinicId, supabase } = await adminContext();
  const totalBeds = Math.max(1, Math.floor(input.totalBeds || 1));

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      clinic_id: clinicId,
      room_number: input.roomNumber.trim(),
      room_type: input.roomType,
      floor: input.floor?.trim() || null,
      total_beds: totalBeds,
      is_active: true,
    } as TablesInsert<"rooms">)
    .select()
    .single();

  if (roomError) throw new Error(`Failed to create room: ${roomError.message}`);

  const bedRows = Array.from({ length: totalBeds }, (_, index) => ({
    clinic_id: clinicId,
    room_id: room.id,
    department_id: room.department_id ?? null,
    bed_number: String(index + 1),
    status: "available",
  })) as TablesInsert<"beds">[];

  const { error: bedError } = await supabase.from("beds").insert(bedRows);
  if (bedError) throw new Error(`Failed to create room beds: ${bedError.message}`);

  return room;
}

export interface CreateClinicDialysisMachineInput {
  machineName: string;
  machineModel?: string;
  serialNumber?: string;
}

export async function createClinicDialysisMachine(input: CreateClinicDialysisMachineInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("dialysis_machines")
    .insert({
      clinic_id: clinicId,
      machine_name: input.machineName.trim(),
      machine_model: input.machineModel?.trim() || null,
      serial_number: input.serialNumber?.trim() || null,
      status: "available",
    } as TablesInsert<"dialysis_machines">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create dialysis machine: ${error.message}`);
  return data;
}

export async function updateClinicDialysisMachineStatus(
  machineId: string,
  status: DialysisMachineStatus,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const patch: TablesUpdate<"dialysis_machines"> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "available") patch.last_maintenance = new Date().toISOString();

  const { error } = await supabase
    .from("dialysis_machines")
    .update(patch)
    .eq("id", machineId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update machine status: ${error.message}`);
}

export interface CreateClinicLabMaterialInput {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitCost?: number;
  supplier?: string;
}

export async function createClinicLabMaterial(input: CreateClinicLabMaterialInput) {
  const { clinicId, supabase } = await adminContext();
  const { data, error } = await supabase
    .from("lab_materials")
    .insert({
      clinic_id: clinicId,
      name: input.name.trim(),
      category: input.category.trim(),
      quantity: input.quantity,
      unit: input.unit.trim() || "pcs",
      min_threshold: input.minThreshold,
      unit_cost: input.unitCost ?? null,
      supplier: input.supplier?.trim() || null,
      last_restocked: new Date().toISOString(),
    } as TablesInsert<"lab_materials">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create lab material: ${error.message}`);
  return data;
}

export async function restockClinicLabMaterial(
  materialId: string,
  quantity: number,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { data: current, error: fetchError } = await supabase
    .from("lab_materials")
    .select("quantity")
    .eq("id", materialId)
    .eq("clinic_id", clinicId)
    .single();

  if (fetchError) throw new Error(`Failed to load lab material: ${fetchError.message}`);

  const { error } = await supabase
    .from("lab_materials")
    .update({
      quantity: (current?.quantity ?? 0) + quantity,
      last_restocked: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"lab_materials">)
    .eq("id", materialId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to restock lab material: ${error.message}`);
}

export interface CreateClinicLabInvoiceInput {
  invoiceNumber: string;
  dentistName?: string;
  dueDate?: string;
  notes?: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

export async function createClinicLabInvoice(input: CreateClinicLabInvoiceInput) {
  const { clinicId, supabase } = await adminContext();
  const subtotal = input.items.reduce((sum, item) => sum + item.total, 0);
  const { data, error } = await supabase
    .from("lab_invoices")
    .insert({
      clinic_id: clinicId,
      invoice_number: input.invoiceNumber.trim(),
      dentist_name: input.dentistName?.trim() || null,
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
      items: input.items as Json,
      subtotal,
      tax_amount: 0,
      total: subtotal,
      currency: "MAD",
      status: "draft",
      issued_date: new Date().toISOString().split("T")[0],
    } as TablesInsert<"lab_invoices">)
    .select()
    .single();

  if (error) throw new Error(`Failed to create lab invoice: ${error.message}`);
  return data;
}

export async function updateClinicLabInvoiceStatus(
  invoiceId: string,
  status: LabInvoiceStatus,
): Promise<void> {
  const { clinicId, supabase } = await adminContext();
  const { error } = await supabase
    .from("lab_invoices")
    .update({
      status,
      paid_date: status === "paid" ? new Date().toISOString().split("T")[0] : null,
      updated_at: new Date().toISOString(),
    } as TablesUpdate<"lab_invoices">)
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);

  if (error) throw new Error(`Failed to update lab invoice status: ${error.message}`);
}
