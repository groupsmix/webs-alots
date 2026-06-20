"use client";

import { useState, useEffect } from "react";
import { ConsultationPhotos } from "@/components/aesthetic/consultation-photos";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchConsultationPhotos,
  fetchPatients,
  createConsultationPhoto,
  type ConsultationPhotoView,
  type PatientView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorConsultationPhotosPage() {
  const { addToast } = useToast();
  const [photos, setPhotos] = useState<ConsultationPhotoView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) {
        setLoading(false);
        return;
      }
      setClinicId(user.clinic_id);
      setDoctorId(user.id);
      const [ph, pats] = await Promise.all([
        fetchConsultationPhotos(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setPhotos(ph);
      setPatients(pats);
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, []);

  async function handleAddPhoto(data: { bodyArea: string; notes: string }) {
    if (!clinicId || !doctorId) return;
    if (!selectedPatientId) {
      addToast("Select a patient before saving the photo.", "error");
      return;
    }
    const patient = patients.find((p) => p.id === selectedPatientId);
    try {
      const { id } = await createConsultationPhoto(clinicId, selectedPatientId, doctorId, {
        bodyArea: data.bodyArea,
        notes: data.notes,
        photoUrl: "",
      });
      setPhotos((prev) => [
        {
          id,
          patientId: selectedPatientId,
          patientName: patient?.name ?? "Unknown Patient",
          photoUrl: "",
          thumbnailUrl: null,
          bodyArea: data.bodyArea || null,
          notes: data.notes || null,
          annotations: [],
          takenAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      addToast("Photo record saved", "success");
    } catch (err) {
      logger.warn("Failed to save consultation photo", {
        context: "doctor/consultation-photos",
        error: err,
      });
      addToast("Failed to save photo record. Please try again.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading consultation photos..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load consultation photos.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Photos" }]} />
      <h1 className="text-2xl font-bold">Consultation Photos</h1>

      {patients.length > 0 && (
        <div className="flex items-center gap-3 max-w-xs">
          <Label className="shrink-0 text-sm">Patient for new photo:</Label>
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select patient…" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ConsultationPhotos
        photos={photos}
        editable={!!selectedPatientId}
        onAddPhoto={handleAddPhoto}
      />
    </div>
  );
}
