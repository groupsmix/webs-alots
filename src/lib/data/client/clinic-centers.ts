"use client";

import { createClient } from "@/lib/supabase-client";
import type {
  Database,
  DialysisMachineStatus,
  DeliveryCondition,
  LabInvoiceStatus,
} from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";
import { ensureLookups, fetchRows, _activeUserMap } from "./_core";
import { fetchTodayAppointments } from "./appointments";

export interface DepartmentManagementView {
  id: string;
  name: string;
  nameAr: string | null;
  headDoctorName: string | null;
  floor: string | null;
  description: string | null;
  doctorCount: number;
  patientCount: number;
  isActive: boolean;
}

export interface DepartmentDashboardStatView {
  id: string;
  name: string;
  doctorCount: number;
  patientCount: number;
  totalBeds: number;
  occupiedBeds: number;
  todayAppointments: number;
  admissionsThisMonth: number;
  dischargesThisMonth: number;
}

export interface DepartmentOverviewView {
  departments: DepartmentManagementView[];
  stats: DepartmentDashboardStatView[];
}

export interface BedManagementBedView {
  id: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  patientName: string | null;
  admissionDate: string | null;
}

export interface BedManagementRoomView {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string | null;
  departmentName: string | null;
  totalBeds: number;
  beds: BedManagementBedView[];
}

export interface DialysisMachineView {
  id: string;
  machineName: string;
  machineModel: string | null;
  serialNumber: string | null;
  status: DialysisMachineStatus;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
  currentPatientName: string | null;
  notes: string | null;
}

export interface LabMaterialView {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitCost: number | null;
  supplier: string | null;
  expiryDate: string | null;
  lastRestocked: string | null;
}

export interface LabDeliveryView {
  id: string;
  orderType: string;
  deliveryDate: string;
  deliveredBy: string | null;
  receivedBy: string | null;
  condition: DeliveryCondition;
  dentistName: string | null;
  notes: string | null;
}

export interface LabInvoiceView {
  id: string;
  invoiceNumber: string;
  dentistName: string | null;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: LabInvoiceStatus;
  issuedDate: string;
  dueDate: string | null;
  paidDate: string | null;
}

interface DepartmentRow {
  id: string;
  clinic_id: string;
  name: string;
  name_ar: string | null;
  head_doctor_id: string | null;
  description: string | null;
  floor: string | null;
  is_active: boolean;
}

interface DoctorDepartmentRow {
  id: string;
  clinic_id: string;
  department_id: string;
  doctor_id: string;
  is_primary: boolean;
}

interface BedRow {
  id: string;
  clinic_id: string;
  room_id: string;
  department_id: string | null;
  bed_number: string;
  status: string;
  current_patient_id: string | null;
  patient_id: string | null;
  notes: string | null;
  updated_at: string | null;
}

interface RoomRow {
  id: string;
  clinic_id: string;
  department_id: string | null;
  room_number: string;
  room_type: string;
  floor: string | null;
  total_beds: number;
  is_active: boolean;
}

interface AdmissionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  bed_id: string;
  department_id: string | null;
  admission_date: string;
  discharge_date: string | null;
  status: string;
}

interface DialysisMachineRow {
  id: string;
  clinic_id: string;
  machine_name: string;
  machine_model: string | null;
  serial_number: string | null;
  status: string;
  last_maintenance: string | null;
  next_maintenance: string | null;
  notes: string | null;
}

interface DialysisSessionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  machine_id: string | null;
  session_date: string;
  status: string;
}

interface LabMaterialRow {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  min_threshold: number;
  unit_cost: number | null;
  supplier: string | null;
  expiry_date: string | null;
  last_restocked: string | null;
}

interface LabDeliveryRow {
  id: string;
  clinic_id: string;
  order_id: string;
  delivery_date: string;
  delivered_by: string | null;
  received_by: string | null;
  condition: string | null;
  notes: string | null;
}

interface LabInvoiceRow {
  id: string;
  clinic_id: string;
  invoice_number: string;
  dentist_id: string | null;
  dentist_name: string | null;
  items: Database["public"]["Tables"]["lab_invoices"]["Row"]["items"];
  subtotal: number;
  tax_amount: number | null;
  total: number;
  currency: string;
  status: string;
  issued_date: string;
  due_date: string | null;
  paid_date: string | null;
}

interface ProstheticOrderRow {
  id: string;
  clinic_id: string;
  order_type: string;
  dentist_id: string | null;
  dentist_name: string | null;
}

function byNumericOrText(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function parseInvoiceItems(
  value: Database["public"]["Tables"]["lab_invoices"]["Row"]["items"],
): LabInvoiceView["items"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      const quantity = Number(row.quantity ?? 0);
      const unitPrice = Number(row.unitPrice ?? row.unit_price ?? 0);
      return {
        description: typeof row.description === "string" ? row.description : "Item",
        quantity,
        unitPrice,
        total: Number(row.total ?? quantity * unitPrice),
      };
    })
    .filter((item) => item.description);
}

export async function fetchDepartmentOverview(clinicId: string): Promise<DepartmentOverviewView> {
  await ensureLookups(clinicId);

  const monthPrefix = getLocalDateStr().slice(0, 7);
  const [departments, doctorDepartments, beds, admissions, todayAppointments] = await Promise.all([
    fetchRows<DepartmentRow>("departments", {
      eq: [["clinic_id", clinicId]],
      order: ["name", { ascending: true }],
      tenantClinicId: clinicId,
    }),
    fetchRows<DoctorDepartmentRow>("doctor_departments", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<BedRow>("beds", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<AdmissionRow>("admissions", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchTodayAppointments(clinicId),
  ]);

  const departmentsView = departments.map((dept) => {
    const assignedDoctorIds = new Set(
      doctorDepartments.filter((row) => row.department_id === dept.id).map((row) => row.doctor_id),
    );
    if (dept.head_doctor_id) assignedDoctorIds.add(dept.head_doctor_id);

    const patientIds = new Set<string>();
    for (const admission of admissions) {
      if (admission.department_id === dept.id) patientIds.add(admission.patient_id);
    }
    for (const appointment of todayAppointments) {
      if (assignedDoctorIds.has(appointment.doctorId)) patientIds.add(appointment.patientId);
    }

    return {
      id: dept.id,
      name: dept.name,
      nameAr: dept.name_ar,
      headDoctorName: dept.head_doctor_id
        ? (_activeUserMap?.get(dept.head_doctor_id)?.name ?? null)
        : null,
      floor: dept.floor,
      description: dept.description,
      doctorCount: assignedDoctorIds.size,
      patientCount: patientIds.size,
      isActive: dept.is_active,
    } satisfies DepartmentManagementView;
  });

  const stats = departmentsView.map((dept) => {
    const deptDoctorIds = new Set(
      doctorDepartments.filter((row) => row.department_id === dept.id).map((row) => row.doctor_id),
    );
    const deptBeds = beds.filter((bed) => bed.department_id === dept.id);
    const deptAdmissions = admissions.filter((admission) => admission.department_id === dept.id);
    const patientIds = new Set<string>(deptAdmissions.map((admission) => admission.patient_id));
    const todayAppointmentsCount = todayAppointments.filter((appointment) => {
      if (!deptDoctorIds.has(appointment.doctorId)) return false;
      patientIds.add(appointment.patientId);
      return true;
    }).length;

    return {
      id: dept.id,
      name: dept.name,
      doctorCount: dept.doctorCount,
      patientCount: patientIds.size,
      totalBeds: deptBeds.length,
      occupiedBeds: deptBeds.filter((bed) => bed.status === "occupied").length,
      todayAppointments: todayAppointmentsCount,
      admissionsThisMonth: deptAdmissions.filter((admission) =>
        admission.admission_date.startsWith(monthPrefix),
      ).length,
      dischargesThisMonth: deptAdmissions.filter(
        (admission) => admission.discharge_date?.startsWith(monthPrefix) ?? false,
      ).length,
    } satisfies DepartmentDashboardStatView;
  });

  return { departments: departmentsView, stats };
}

export async function fetchBedManagementRooms(clinicId: string): Promise<BedManagementRoomView[]> {
  await ensureLookups(clinicId);
  const [rooms, beds, departments, admissions] = await Promise.all([
    fetchRows<RoomRow>("rooms", {
      eq: [
        ["clinic_id", clinicId],
        ["is_active", true],
      ],
      tenantClinicId: clinicId,
    }),
    fetchRows<BedRow>("beds", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<DepartmentRow>("departments", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<AdmissionRow>("admissions", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);

  const departmentMap = new Map(departments.map((department) => [department.id, department.name]));
  const activeAdmissionByBed = new Map<string, AdmissionRow>();
  for (const admission of [...admissions].sort((a, b) =>
    b.admission_date.localeCompare(a.admission_date),
  )) {
    if (activeAdmissionByBed.has(admission.bed_id)) continue;
    if (admission.status === "discharged") continue;
    activeAdmissionByBed.set(admission.bed_id, admission);
  }

  return [...rooms]
    .sort((a, b) => byNumericOrText(a.room_number, b.room_number))
    .map((room) => {
      const roomBeds = beds
        .filter((bed) => bed.room_id === room.id)
        .sort((a, b) => byNumericOrText(a.bed_number, b.bed_number))
        .map((bed) => {
          const activeAdmission = activeAdmissionByBed.get(bed.id);
          const patientId =
            bed.current_patient_id ?? bed.patient_id ?? activeAdmission?.patient_id ?? null;
          return {
            id: bed.id,
            bedNumber: bed.bed_number,
            status: (bed.status ?? "available") as BedManagementBedView["status"],
            patientName: patientId ? (_activeUserMap?.get(patientId)?.name ?? null) : null,
            admissionDate: activeAdmission?.admission_date?.split("T")[0] ?? null,
          } satisfies BedManagementBedView;
        });

      return {
        id: room.id,
        roomNumber: room.room_number,
        roomType: room.room_type,
        floor: room.floor,
        departmentName: room.department_id ? (departmentMap.get(room.department_id) ?? null) : null,
        totalBeds: room.total_beds,
        beds: roomBeds,
      } satisfies BedManagementRoomView;
    });
}

export async function fetchDialysisMachines(clinicId: string): Promise<DialysisMachineView[]> {
  await ensureLookups(clinicId);
  const today = getLocalDateStr();
  const [machines, sessions] = await Promise.all([
    fetchRows<DialysisMachineRow>("dialysis_machines", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<DialysisSessionRow>("dialysis_sessions", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);

  const relevantSessionByMachine = new Map<string, DialysisSessionRow>();
  for (const session of [...sessions].sort((a, b) =>
    b.session_date.localeCompare(a.session_date),
  )) {
    if (!session.machine_id || relevantSessionByMachine.has(session.machine_id)) continue;
    const isCurrent =
      session.session_date === today && ["scheduled", "in_progress"].includes(session.status);
    const isRecent = session.status === "in_progress";
    if (isCurrent || isRecent) relevantSessionByMachine.set(session.machine_id, session);
  }

  return [...machines]
    .sort((a, b) => a.machine_name.localeCompare(b.machine_name, undefined, { numeric: true }))
    .map((machine) => ({
      id: machine.id,
      machineName: machine.machine_name,
      machineModel: machine.machine_model,
      serialNumber: machine.serial_number,
      status: machine.status as DialysisMachineStatus,
      lastMaintenance: machine.last_maintenance,
      nextMaintenance: machine.next_maintenance,
      currentPatientName: relevantSessionByMachine.get(machine.id)?.patient_id
        ? (_activeUserMap?.get(relevantSessionByMachine.get(machine.id)!.patient_id)?.name ?? null)
        : null,
      notes: machine.notes,
    }));
}

export async function fetchLabMaterials(clinicId: string): Promise<LabMaterialView[]> {
  const rows = await fetchRows<LabMaterialRow>("lab_materials", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    minThreshold: row.min_threshold,
    unitCost: row.unit_cost,
    supplier: row.supplier,
    expiryDate: row.expiry_date,
    lastRestocked: row.last_restocked,
  }));
}

export async function fetchLabDeliveriesAndInvoices(clinicId: string): Promise<{
  deliveries: LabDeliveryView[];
  invoices: LabInvoiceView[];
}> {
  await ensureLookups(clinicId);
  const [deliveries, invoices, orders] = await Promise.all([
    fetchRows<LabDeliveryRow>("lab_deliveries", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<LabInvoiceRow>("lab_invoices", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
    fetchRows<ProstheticOrderRow>("prosthetic_orders", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);

  const orderMap = new Map(orders.map((order) => [order.id, order]));

  return {
    deliveries: [...deliveries]
      .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date))
      .map((delivery) => {
        const order = orderMap.get(delivery.order_id);
        return {
          id: delivery.id,
          orderType: order?.order_type ?? "prosthetic",
          deliveryDate: delivery.delivery_date,
          deliveredBy: delivery.delivered_by,
          receivedBy: delivery.received_by,
          condition: (delivery.condition ?? "good") as DeliveryCondition,
          dentistName:
            order?.dentist_name ??
            (order?.dentist_id ? (_activeUserMap?.get(order.dentist_id)?.name ?? null) : null),
          notes: delivery.notes,
        } satisfies LabDeliveryView;
      }),
    invoices: [...invoices]
      .sort((a, b) => b.issued_date.localeCompare(a.issued_date))
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        dentistName:
          invoice.dentist_name ??
          (invoice.dentist_id ? (_activeUserMap?.get(invoice.dentist_id)?.name ?? null) : null),
        items: parseInvoiceItems(invoice.items),
        subtotal: invoice.subtotal,
        taxAmount: invoice.tax_amount ?? 0,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status as LabInvoiceStatus,
        issuedDate: invoice.issued_date,
        dueDate: invoice.due_date,
        paidDate: invoice.paid_date,
      })),
  };
}

export async function fetchClinicSales(clinicId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, clinic_id, patient_id, patient_name, items, total, currency, payment_method, has_prescription, loyalty_points_earned, date, time, created_at",
    )
    .eq("clinic_id", clinicId)
    .order("date", { ascending: false });

  if (error) return [];
  return data ?? [];
}


// ============================================================
// CONSENT FORMS (photo_consent_forms)
// ============================================================

export interface ConsentFormView {
  id: string;
  patientId: string;
  patientName: string;
  consentType: "before_after" | "marketing" | "medical_record";
  signedAt: string;
  isActive: boolean;
  expiresAt: string | null;
}

interface ConsentFormRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  consent_type: string;
  signed_at: string;
  is_active: boolean;
  expires_at: string | null;
}

export async function fetchConsentForms(clinicId: string): Promise<ConsentFormView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ConsentFormRow>("photo_consent_forms", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: _activeUserMap?.get(row.patient_id)?.name ?? "Unknown Patient",
    consentType: row.consent_type as ConsentFormView["consentType"],
    signedAt: row.signed_at,
    isActive: row.is_active,
    expiresAt: row.expires_at,
  }));
}

export async function createConsentForm(
  clinicId: string,
  patientId: string,
  data: { consentType: string; consentText: string },
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("photo_consent_forms")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      consent_type: data.consentType,
      consent_text: data.consentText,
      is_active: true,
      signed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function revokeConsentForm(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("photo_consent_forms")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}


// ============================================================
// CONSULTATION PHOTOS (consultation_photos)
// ============================================================

export interface ConsultationPhotoView {
  id: string;
  patientId: string;
  patientName: string;
  photoUrl: string;
  thumbnailUrl: string | null;
  bodyArea: string | null;
  notes: string | null;
  annotations: { x: number; y: number; text: string }[];
  takenAt: string;
}

interface ConsultationPhotoRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  annotations: unknown;
  body_area: string | null;
  notes: string | null;
  taken_at: string | null;
  created_at: string | null;
}

export async function fetchConsultationPhotos(
  clinicId: string,
): Promise<ConsultationPhotoView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<ConsultationPhotoRow>("consultation_photos", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: _activeUserMap?.get(row.patient_id)?.name ?? "Unknown Patient",
    photoUrl: row.photo_url,
    thumbnailUrl: row.thumbnail_url,
    bodyArea: row.body_area,
    notes: row.notes,
    annotations: Array.isArray(row.annotations)
      ? (row.annotations as { x: number; y: number; text: string }[])
      : [],
    takenAt: row.taken_at ?? row.created_at ?? new Date().toISOString(),
  }));
}

export async function createConsultationPhoto(
  clinicId: string,
  patientId: string,
  doctorId: string,
  data: { bodyArea: string; notes: string; photoUrl?: string },
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("consultation_photos")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      photo_url: data.photoUrl ?? "",
      body_area: data.bodyArea || null,
      notes: data.notes || null,
      annotations: [],
      taken_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}


// ============================================================
// DIALYSIS SESSIONS (dialysis_sessions)
// ============================================================

export interface DialysisSessionView {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string | null;
  machineName: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  status: import("@/lib/types/database").DialysisSessionStatus;
  isRecurring: boolean;
  recurrencePattern: import("@/lib/types/database").DialysisRecurrencePattern | null;
  accessType: string | null;
  preWeight: number | null;
  postWeight: number | null;
  preBpSystolic: number | null;
  preBpDiastolic: number | null;
  postBpSystolic: number | null;
  postBpDiastolic: number | null;
  prePulse: number | null;
  postPulse: number | null;
  preTemperature: number | null;
  postTemperature: number | null;
  ufGoal: number | null;
  ufActual: number | null;
  dialysateFlow: number | null;
  bloodFlow: number | null;
  complications: string | null;
  notes: string | null;
}

interface FullDialysisSessionRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  machine_id: string | null;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  access_type: string | null;
  pre_weight: number | null;
  post_weight: number | null;
  pre_bp_systolic: number | null;
  pre_bp_diastolic: number | null;
  post_bp_systolic: number | null;
  post_bp_diastolic: number | null;
  pre_pulse: number | null;
  post_pulse: number | null;
  pre_temperature: number | null;
  post_temperature: number | null;
  uf_goal: number | null;
  uf_actual: number | null;
  dialysate_flow: number | null;
  blood_flow: number | null;
  complications: string | null;
  notes: string | null;
}

export async function fetchDialysisSessions(
  clinicId: string,
): Promise<DialysisSessionView[]> {
  await ensureLookups(clinicId);
  const [sessions, machines] = await Promise.all([
    fetchRows<FullDialysisSessionRow>("dialysis_sessions", {
      eq: [["clinic_id", clinicId]],
      order: ["created_at", { ascending: false }],
      tenantClinicId: clinicId,
    }),
    fetchRows<DialysisMachineRow>("dialysis_machines", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);
  const machineMap = new Map(machines.map((m) => [m.id, m.machine_name]));
  return sessions.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: _activeUserMap?.get(row.patient_id)?.name ?? "Unknown Patient",
    doctorName: row.doctor_id ? (_activeUserMap?.get(row.doctor_id)?.name ?? null) : null,
    machineName: row.machine_id ? (machineMap.get(row.machine_id) ?? null) : null,
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes ?? 240,
    status: row.status as DialysisSessionView["status"],
    isRecurring: row.is_recurring,
    recurrencePattern:
      row.recurrence_pattern as DialysisSessionView["recurrencePattern"],
    accessType: row.access_type,
    preWeight: row.pre_weight,
    postWeight: row.post_weight,
    preBpSystolic: row.pre_bp_systolic,
    preBpDiastolic: row.pre_bp_diastolic,
    postBpSystolic: row.post_bp_systolic,
    postBpDiastolic: row.post_bp_diastolic,
    prePulse: row.pre_pulse,
    postPulse: row.post_pulse,
    preTemperature: row.pre_temperature,
    postTemperature: row.post_temperature,
    ufGoal: row.uf_goal,
    ufActual: row.uf_actual,
    dialysateFlow: row.dialysate_flow,
    bloodFlow: row.blood_flow,
    complications: row.complications,
    notes: row.notes,
  }));
}

export async function createDialysisSession(
  clinicId: string,
  patientId: string,
  data: {
    sessionDate: string;
    startTime: string;
    durationMinutes: number;
    isRecurring: boolean;
    recurrencePattern: string | null;
  },
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("dialysis_sessions")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      session_date: data.sessionDate,
      start_time: data.startTime,
      duration_minutes: data.durationMinutes,
      status: "scheduled",
      is_recurring: data.isRecurring,
      recurrence_pattern: data.recurrencePattern ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function updateDialysisSessionStatus(
  sessionId: string,
  status: import("@/lib/types/database").DialysisSessionStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("dialysis_sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function updateDialysisSessionVitals(
  sessionId: string,
  vitals: {
    preWeight?: number | null;
    postWeight?: number | null;
    preBpSystolic?: number | null;
    preBpDiastolic?: number | null;
    postBpSystolic?: number | null;
    postBpDiastolic?: number | null;
    prePulse?: number | null;
    postPulse?: number | null;
    preTemperature?: number | null;
    postTemperature?: number | null;
    ufGoal?: number | null;
    ufActual?: number | null;
    dialysateFlow?: number | null;
    bloodFlow?: number | null;
    complications?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("dialysis_sessions")
    .update({
      pre_weight: vitals.preWeight,
      post_weight: vitals.postWeight,
      pre_bp_systolic: vitals.preBpSystolic,
      pre_bp_diastolic: vitals.preBpDiastolic,
      post_bp_systolic: vitals.postBpSystolic,
      post_bp_diastolic: vitals.postBpDiastolic,
      pre_pulse: vitals.prePulse,
      post_pulse: vitals.postPulse,
      pre_temperature: vitals.preTemperature,
      post_temperature: vitals.postTemperature,
      uf_goal: vitals.ufGoal,
      uf_actual: vitals.ufActual,
      dialysate_flow: vitals.dialysateFlow,
      blood_flow: vitals.bloodFlow,
      complications: vitals.complications,
      notes: vitals.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) throw error;
}


// ============================================================
// IVF CYCLES (ivf_cycles)
// ============================================================

export interface IVFCycleView {
  id: string;
  patientId: string;
  patientName: string;
  partnerName: string | null;
  doctorName: string | null;
  cycleNumber: number;
  cycleType: import("@/lib/types/database").IVFCycleType;
  status: import("@/lib/types/database").IVFCycleStatus;
  startDate: string | null;
  retrievalDate: string | null;
  transferDate: string | null;
  eggsRetrieved: number | null;
  eggsFertilized: number | null;
  embryosTransferred: number | null;
  embryosFrozen: number | null;
  outcome: import("@/lib/types/database").IVFOutcome | null;
  betaHcgValue: number | null;
  notes: string | null;
}

interface IVFCycleRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  partner_id: string | null;
  cycle_number: number;
  cycle_type: string;
  status: string;
  start_date: string | null;
  retrieval_date: string | null;
  transfer_date: string | null;
  eggs_retrieved: number | null;
  eggs_fertilized: number | null;
  embryos_transferred: number | null;
  embryos_frozen: number | null;
  outcome: string | null;
  beta_hcg_value: number | null;
  notes: string | null;
}

export async function fetchIVFCycles(clinicId: string): Promise<IVFCycleView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<IVFCycleRow>("ivf_cycles", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: _activeUserMap?.get(row.patient_id)?.name ?? "Unknown Patient",
    partnerName: row.partner_id ? (_activeUserMap?.get(row.partner_id)?.name ?? null) : null,
    doctorName: row.doctor_id ? (_activeUserMap?.get(row.doctor_id)?.name ?? null) : null,
    cycleNumber: row.cycle_number,
    cycleType: row.cycle_type as IVFCycleView["cycleType"],
    status: row.status as IVFCycleView["status"],
    startDate: row.start_date,
    retrievalDate: row.retrieval_date,
    transferDate: row.transfer_date,
    eggsRetrieved: row.eggs_retrieved,
    eggsFertilized: row.eggs_fertilized,
    embryosTransferred: row.embryos_transferred,
    embryosFrozen: row.embryos_frozen,
    outcome: (row.outcome ?? null) as IVFCycleView["outcome"],
    betaHcgValue: row.beta_hcg_value,
    notes: row.notes,
  }));
}

export async function createIVFCycle(
  clinicId: string,
  patientId: string,
  data: {
    cycleType: import("@/lib/types/database").IVFCycleType;
    startDate: string;
  },
): Promise<{ id: string }> {
  const supabase = createClient();
  // Count existing cycles for this patient to assign cycle_number
  const { count } = await supabase
    .from("ivf_cycles")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);
  const { data: row, error } = await supabase
    .from("ivf_cycles")
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      cycle_number: (count ?? 0) + 1,
      cycle_type: data.cycleType,
      status: "planned",
      start_date: data.startDate || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function updateIVFCycleStatus(
  cycleId: string,
  status: import("@/lib/types/database").IVFCycleStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("ivf_cycles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", cycleId);
  if (error) throw error;
}

export async function updateIVFCycleOutcome(
  cycleId: string,
  outcome: import("@/lib/types/database").IVFOutcome,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("ivf_cycles")
    .update({
      outcome,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cycleId);
  if (error) throw error;
}


// ============================================================
// IVF PROTOCOLS (ivf_protocols)
// ============================================================

export interface IVFProtocolView {
  id: string;
  name: string;
  description: string | null;
  protocolType: import("@/lib/types/database").IVFProtocolType;
  medications: { name: string; dosage: string; startDay: number; endDay: number }[];
  steps: { day: number; description: string }[];
  durationDays: number | null;
}

interface IVFProtocolRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  protocol_type: string;
  medications: unknown;
  steps: unknown;
  duration_days: number | null;
}

export async function fetchIVFProtocols(clinicId: string): Promise<IVFProtocolView[]> {
  const rows = await fetchRows<IVFProtocolRow>("ivf_protocols", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    protocolType: row.protocol_type as IVFProtocolView["protocolType"],
    medications: Array.isArray(row.medications)
      ? (row.medications as IVFProtocolView["medications"])
      : [],
    steps: Array.isArray(row.steps) ? (row.steps as IVFProtocolView["steps"]) : [],
    durationDays: row.duration_days,
  }));
}

export async function createIVFProtocol(
  clinicId: string,
  data: {
    name: string;
    protocolType: import("@/lib/types/database").IVFProtocolType;
    description: string;
    durationDays: number;
  },
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("ivf_protocols")
    .insert({
      clinic_id: clinicId,
      name: data.name,
      protocol_type: data.protocolType,
      description: data.description || null,
      duration_days: data.durationDays || null,
      medications: [],
      steps: [],
      is_template: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function deleteIVFProtocol(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("ivf_protocols").delete().eq("id", id);
  if (error) throw error;
}


// ============================================================
// TREATMENT PACKAGES (treatment_packages + patient_packages)
// ============================================================

export interface TreatmentPackageView {
  id: string;
  name: string;
  description: string | null;
  totalSessions: number;
  price: number;
  discountPercent: number;
  isActive: boolean;
  subscriberCount: number;
}

export interface PatientPackageView {
  id: string;
  patientName: string;
  packageName: string;
  sessionsUsed: number;
  sessionsTotal: number;
  startDate: string;
  expiryDate: string | null;
  status: "active" | "completed" | "expired" | "cancelled";
}

interface TreatmentPackageRow {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  total_sessions: number;
  price: number;
  discount_percent: number | null;
  is_active: boolean;
}

interface PatientPackageRow {
  id: string;
  clinic_id: string;
  patient_id: string;
  package_id: string;
  sessions_used: number;
  sessions_total: number;
  start_date: string;
  expiry_date: string | null;
  status: string;
}

export async function fetchTreatmentPackages(clinicId: string): Promise<{
  packages: TreatmentPackageView[];
  patientPackages: PatientPackageView[];
}> {
  await ensureLookups(clinicId);
  const [pkgs, patPkgs] = await Promise.all([
    fetchRows<TreatmentPackageRow>("treatment_packages", {
      eq: [["clinic_id", clinicId]],
      order: ["name", { ascending: true }],
      tenantClinicId: clinicId,
    }),
    fetchRows<PatientPackageRow>("patient_packages", {
      eq: [["clinic_id", clinicId]],
      tenantClinicId: clinicId,
    }),
  ]);

  const subscriberCounts = new Map<string, number>();
  for (const pp of patPkgs) {
    subscriberCounts.set(pp.package_id, (subscriberCounts.get(pp.package_id) ?? 0) + 1);
  }

  const packageNameMap = new Map(pkgs.map((p) => [p.id, p.name]));

  return {
    packages: pkgs.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      totalSessions: pkg.total_sessions,
      price: Number(pkg.price),
      discountPercent: Number(pkg.discount_percent ?? 0),
      isActive: pkg.is_active,
      subscriberCount: subscriberCounts.get(pkg.id) ?? 0,
    })),
    patientPackages: patPkgs
      .filter((pp) => pp.status === "active")
      .map((pp) => ({
        id: pp.id,
        patientName: _activeUserMap?.get(pp.patient_id)?.name ?? "Unknown Patient",
        packageName: packageNameMap.get(pp.package_id) ?? "Unknown Package",
        sessionsUsed: pp.sessions_used,
        sessionsTotal: pp.sessions_total,
        startDate: pp.start_date,
        expiryDate: pp.expiry_date,
        status: pp.status as PatientPackageView["status"],
      })),
  };
}

export async function createTreatmentPackage(
  clinicId: string,
  data: {
    name: string;
    description: string;
    totalSessions: number;
    price: number;
    discountPercent: number;
  },
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("treatment_packages")
    .insert({
      clinic_id: clinicId,
      name: data.name,
      description: data.description || null,
      total_sessions: data.totalSessions,
      price: data.price,
      discount_percent: data.discountPercent,
      is_active: true,
      services: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function recordPatientPackageSession(patientPackageId: string): Promise<void> {
  const supabase = createClient();
  // Use RPC or a raw increment — safe with Supabase's update + select pattern
  const { data: current, error: fetchErr } = await supabase
    .from("patient_packages")
    .select("sessions_used, sessions_total")
    .eq("id", patientPackageId)
    .single();
  if (fetchErr) throw fetchErr;
  const row = current as { sessions_used: number; sessions_total: number };
  const newUsed = row.sessions_used + 1;
  const newStatus = newUsed >= row.sessions_total ? "completed" : "active";
  const { error } = await supabase
    .from("patient_packages")
    .update({
      sessions_used: newUsed,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientPackageId);
  if (error) throw error;
}


// ============================================================
// PROSTHETIC ORDERS (prosthetic_orders)
// ============================================================

export interface ProstheticOrderView {
  id: string;
  dentistName: string | null;
  dentistClinic: string | null;
  patientName: string | null;
  orderType: import("@/lib/types/database").ProstheticOrderType;
  material: string | null;
  shade: string | null;
  toothNumbers: number[];
  description: string | null;
  specialInstructions: string | null;
  status: import("@/lib/types/database").ProstheticOrderStatus;
  priority: import("@/lib/types/database").ProstheticPriority;
  receivedDate: string;
  dueDate: string | null;
  completedDate: string | null;
  deliveredDate: string | null;
  price: number | null;
  isPaid: boolean;
}

interface FullProstheticOrderRow {
  id: string;
  clinic_id: string;
  dentist_id: string | null;
  dentist_name: string | null;
  dentist_clinic: string | null;
  patient_name: string | null;
  order_type: string;
  material: string | null;
  shade: string | null;
  tooth_numbers: number[] | null;
  description: string | null;
  special_instructions: string | null;
  status: string;
  priority: string;
  received_date: string;
  due_date: string | null;
  completed_date: string | null;
  delivered_date: string | null;
  price: number | null;
  is_paid: boolean;
}

export async function fetchProstheticOrders(
  clinicId: string,
): Promise<ProstheticOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<FullProstheticOrderRow>("prosthetic_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
    tenantClinicId: clinicId,
  });
  return rows.map((row) => ({
    id: row.id,
    dentistName:
      row.dentist_name ??
      (row.dentist_id ? (_activeUserMap?.get(row.dentist_id)?.name ?? null) : null),
    dentistClinic: row.dentist_clinic,
    patientName: row.patient_name,
    orderType: row.order_type as ProstheticOrderView["orderType"],
    material: row.material,
    shade: row.shade,
    toothNumbers: row.tooth_numbers ?? [],
    description: row.description,
    specialInstructions: row.special_instructions,
    status: row.status as ProstheticOrderView["status"],
    priority: row.priority as ProstheticOrderView["priority"],
    receivedDate: row.received_date,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    deliveredDate: row.delivered_date,
    price: row.price,
    isPaid: row.is_paid,
  }));
}

export async function createProstheticOrder(
  clinicId: string,
  data: {
    dentistName: string;
    patientName: string;
    orderType: import("@/lib/types/database").ProstheticOrderType;
    material: string;
    shade: string;
    toothNumbers: string;
    dueDate: string;
    price: string;
    priority: import("@/lib/types/database").ProstheticPriority;
    specialInstructions: string;
  },
): Promise<{ id: string }> {
  const supabase = createClient();
  const teeth = data.toothNumbers
    .split(/[,\s]+/)
    .map((t) => parseInt(t.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const { data: row, error } = await supabase
    .from("prosthetic_orders")
    .insert({
      clinic_id: clinicId,
      dentist_name: data.dentistName || null,
      patient_name: data.patientName || null,
      order_type: data.orderType,
      material: data.material || null,
      shade: data.shade || null,
      tooth_numbers: teeth.length > 0 ? teeth : null,
      special_instructions: data.specialInstructions || null,
      status: "received",
      priority: data.priority,
      received_date: getLocalDateStr(),
      due_date: data.dueDate || null,
      price: data.price ? Number(data.price) : null,
      is_paid: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

export async function updateProstheticOrderStatus(
  orderId: string,
  status: import("@/lib/types/database").ProstheticOrderStatus,
): Promise<void> {
  const supabase = createClient();
  const extra: Record<string, string | null> = {};
  if (status === "delivered") extra.delivered_date = getLocalDateStr();
  if (status === "ready") extra.completed_date = getLocalDateStr();
  const { error } = await supabase
    .from("prosthetic_orders")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", orderId);
  if (error) throw error;
}
