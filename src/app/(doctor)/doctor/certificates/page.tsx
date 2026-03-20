"use client";

import { useState, useEffect, useCallback } from "react";
import { CertificateGenerator } from "@/components/medical/certificate-generator";
import {
  getCurrentUser,
  fetchMedicalCertificates,
  fetchPatients,
  createMedicalCertificate,
  type MedicalCertificateView,
  type PatientView,
} from "@/lib/data/client";

export default function DoctorCertificatesPage() {
  const [certificates, setCertificates] = useState<MedicalCertificateView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const [certs, pts] = await Promise.all([
      fetchMedicalCertificates(user.clinic_id, user.id),
      fetchPatients(user.clinic_id),
    ]);
    setCertificates(certs);
    setPatients(pts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading certificates...</p>
      </div>
    );
  }

  const handleCreateCertificate = async (data: {
    patientId: string;
    type: MedicalCertificateView["type"];
    content: Record<string, unknown>;
  }) => {
    const user = await getCurrentUser();
    if (!user?.clinic_id) return;

    const newId = await createMedicalCertificate({
      clinic_id: user.clinic_id,
      patient_id: data.patientId,
      doctor_id: user.id,
      type: data.type,
      content: data.content,
    });

    if (newId) {
      const patient = patients.find((p) => p.id === data.patientId);
      const newCert: MedicalCertificateView = {
        id: newId,
        patientId: data.patientId,
        patientName: patient?.name ?? "Patient",
        doctorId: user.id,
        doctorName: user.name ?? "Doctor",
        type: data.type,
        content: data.content,
        issuedDate: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString().split("T")[0],
      };
      setCertificates((prev) => [newCert, ...prev]);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Medical Certificates</h1>
      <CertificateGenerator
        certificates={certificates}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        onCreateCertificate={handleCreateCertificate}
      />
    </div>
  );
}
