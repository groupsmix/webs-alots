"use client";

import { createClient } from "@/lib/supabase-client";
import type {
  Database,
  DialysisMachineStatus,
  DeliveryCondition,
  LabInvoiceStatus,
} from "@/lib/types/database";
import { getLocalDateStr } from "@/lib/utils";
import { fetchTodayAppointments } from "./appointments";
import { ensureLookups, fetchRows, _activeUserMap } from "./_core";

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
      doctorDepartments
        .filter((row) => row.department_id === dept.id)
        .map((row) => row.doctor_id),
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
  for (const admission of [...admissions].sort((a, b) => b.admission_date.localeCompare(a.admission_date))) {
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
          const patientId = bed.current_patient_id ?? bed.patient_id ?? activeAdmission?.patient_id ?? null;
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
  for (const session of [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date))) {
    if (!session.machine_id || relevantSessionByMachine.has(session.machine_id)) continue;
    const isCurrent = session.session_date === today && ["scheduled", "in_progress"].includes(session.status);
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
    .select("id, clinic_id, patient_id, patient_name, items, total, currency, payment_method, has_prescription, loyalty_points_earned, date, time, created_at")
    .eq("clinic_id", clinicId)
    .order("date", { ascending: false });

  if (error) return [];
  return data ?? [];
}
