"use client";

import { useState, useEffect } from "react";
import { CertificateGenerator } from "@/components/medical/certificate-generator";
import { useTenant } from "@/components/tenant-provider";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageLoader } from "@/components/ui/page-loader";
import {
  getCurrentUser,
  fetchMedicalCertificates,
  fetchPatients,
  createMedicalCertificate,
  type MedicalCertificateView,
  type PatientView,
} from "@/lib/data/client";

export default function DoctorCertificatesPage() {
  const tenant = useTenant();
  const [certificates, setCertificates] = useState<MedicalCertificateView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [certs, pts] = await Promise.all([
      fetchMedicalCertificates(user.clinic_id, user.id),
      fetchPatients(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setCertificates(certs);
    setPatients(pts);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading certificates..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load data. Please try refreshing the page.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
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
      <Breadcrumb items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Certificates" }]} />
      <h1 className="text-2xl font-bold">Medical Certificates</h1>
      <CertificateGenerator
        certificates={certificates}
        patients={patients.map((p) => ({ id: p.id, name: p.name }))}
        clinic={{ name: tenant?.clinicName ?? "", address: "", phone: "" }}
        onCreateCertificate={handleCreateCertificate}
      />
    </div>
  );
}
