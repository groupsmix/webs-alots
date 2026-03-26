"use client";

import { fetchRows, ensureLookups, _activeUserMap } from "./_core";

// Radiology — Orders
// ─────────────────────────────────────────────

export interface RadiologyOrderView {
  id: string;
  patientId: string;
  patientName: string;
  orderingDoctorName?: string;
  radiologistName?: string;
  orderNumber: string;
  modality: string;
  bodyPart?: string;
  clinicalIndication?: string;
  status: string;
  priority: string;
  scheduledAt?: string;
  performedAt?: string;
  reportedAt?: string;
  reportText?: string;
  findings?: string;
  impression?: string;
  pdfUrl?: string;
  images: RadiologyImageView[];
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyImageView {
  id: string;
  orderId: string;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  modality?: string;
  isDicom: boolean;
  dicomStudyUid?: string;
  thumbnailUrl?: string;
  description?: string;
  uploadedAt: string;
}

interface RadiologyOrderRaw {
  id: string;
  clinic_id: string;
  patient_id: string;
  ordering_doctor_id: string | null;
  radiologist_id: string | null;
  order_number: string;
  modality: string;
  body_part: string | null;
  clinical_indication: string | null;
  status: string;
  priority: string;
  scheduled_at: string | null;
  performed_at: string | null;
  reported_at: string | null;
  report_text: string | null;
  findings: string | null;
  impression: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

interface RadiologyImageRaw {
  id: string;
  order_id: string;
  clinic_id: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  content_type: string | null;
  modality: string | null;
  is_dicom: boolean;
  dicom_metadata: { study_uid?: string } | null;
  thumbnail_url: string | null;
  description: string | null;
  uploaded_at: string;
}

export async function fetchRadiologyOrders(clinicId: string): Promise<RadiologyOrderView[]> {
  await ensureLookups(clinicId);
  const rows = await fetchRows<RadiologyOrderRaw>("radiology_orders", {
    eq: [["clinic_id", clinicId]],
    order: ["created_at", { ascending: false }],
  });
  const orderIds = rows.map((r) => r.id);
  let images: RadiologyImageRaw[] = [];
  if (orderIds.length > 0) {
    images = await fetchRows<RadiologyImageRaw>("radiology_images", {
      eq: [["clinic_id", clinicId]],
      inFilter: ["order_id", orderIds],
    });
  }
  const imagesByOrder = new Map<string, RadiologyImageRaw[]>();
  for (const img of images) {
    const arr = imagesByOrder.get(img.order_id) ?? [];
    arr.push(img);
    imagesByOrder.set(img.order_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: _activeUserMap?.get(r.patient_id)?.name ?? "Patient",
    orderingDoctorName: r.ordering_doctor_id ? (_activeUserMap?.get(r.ordering_doctor_id)?.name ?? undefined) : undefined,
    radiologistName: r.radiologist_id ? (_activeUserMap?.get(r.radiologist_id)?.name ?? undefined) : undefined,
    orderNumber: r.order_number,
    modality: r.modality,
    bodyPart: r.body_part ?? undefined,
    clinicalIndication: r.clinical_indication ?? undefined,
    status: r.status,
    priority: r.priority ?? "normal",
    scheduledAt: r.scheduled_at ?? undefined,
    performedAt: r.performed_at ?? undefined,
    reportedAt: r.reported_at ?? undefined,
    reportText: r.report_text ?? undefined,
    findings: r.findings ?? undefined,
    impression: r.impression ?? undefined,
    pdfUrl: r.pdf_url ?? undefined,
    images: (imagesByOrder.get(r.id) ?? []).map((img) => ({
      id: img.id,
      orderId: img.order_id,
      fileUrl: img.file_url,
      fileName: img.file_name ?? undefined,
      fileSize: img.file_size ?? undefined,
      contentType: img.content_type ?? undefined,
      modality: img.modality ?? undefined,
      isDicom: img.is_dicom ?? false,
      dicomStudyUid: img.dicom_metadata?.study_uid ?? undefined,
      thumbnailUrl: img.thumbnail_url ?? undefined,
      description: img.description ?? undefined,
      uploadedAt: img.uploaded_at?.split("T")[0] ?? "",
    })),
    imageCount: (imagesByOrder.get(r.id) ?? []).length,
    createdAt: r.created_at?.split("T")[0] ?? "",
    updatedAt: r.updated_at?.split("T")[0] ?? "",
  }));
}

// ─────────────────────────────────────────────
// Radiology — Report Templates
// ─────────────────────────────────────────────

export interface RadiologyTemplateView {
  id: string;
  name: string;
  modality?: string;
  bodyPart?: string;
  templateText: string;
  fields: { key: string; label: string; type: string; options?: string[] }[];
  sections: { title: string; defaultContent: string }[];
  language: string;
  isDefault: boolean;
  isActive: boolean;
}

interface RadiologyTemplateRaw {
  id: string;
  clinic_id: string;
  name: string;
  modality: string | null;
  body_part: string | null;
  template_text: string;
  fields: { key: string; label: string; type: string; options?: string[] }[] | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export async function fetchRadiologyTemplates(clinicId: string): Promise<RadiologyTemplateView[]> {
  const rows = await fetchRows<RadiologyTemplateRaw>("radiology_report_templates", {
    eq: [["clinic_id", clinicId]],
    order: ["name", { ascending: true }],
  });
  return rows.map((r) => {
    // Parse template_text into sections (split by markdown-style headers)
    const sectionRegex = /^##\s+(.+)$/gm;
    const sections: { title: string; defaultContent: string }[] = [];
    const text = r.template_text ?? "";
    let lastIndex = 0;
    let lastTitle = "";
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(text)) !== null) {
      if (lastTitle) {
        sections.push({ title: lastTitle, defaultContent: text.slice(lastIndex, match.index).trim() });
      }
      lastTitle = match[1];
      lastIndex = match.index + match[0].length;
    }
    if (lastTitle) {
      sections.push({ title: lastTitle, defaultContent: text.slice(lastIndex).trim() });
    }
    if (sections.length === 0 && text) {
      sections.push({ title: "Report", defaultContent: text });
    }

    return {
      id: r.id,
      name: r.name,
      modality: r.modality ?? undefined,
      bodyPart: r.body_part ?? undefined,
      templateText: r.template_text,
      fields: r.fields ?? [],
      sections,
      language: "en",
      isDefault: r.is_default ?? false,
      isActive: r.is_active ?? true,
    };
  });
}

