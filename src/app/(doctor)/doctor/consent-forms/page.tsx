"use client";

import { useState, useEffect } from "react";
import { ConsentFormManager } from "@/components/aesthetic/consent-form-manager";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  fetchConsentForms,
  fetchPatients,
  createConsentForm,
  revokeConsentForm,
  type ConsentFormView,
  type PatientView,
} from "@/lib/data/client";
import { logger } from "@/lib/logger";

export default function DoctorConsentFormsPage() {
  const { addToast } = useToast();
  const [consents, setConsents] = useState<ConsentFormView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) { setLoading(false); return; }
      setClinicId(user.clinic_id);
      const [forms, pats] = await Promise.all([
        fetchConsentForms(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setConsents(forms);
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

  async function handleAdd(consent: { patientName: string; consentType: string; consentText: string }) {
    if (!clinicId) return;
    const patient = patients.find(
      (p) => p.name.toLowerCase() === consent.patientName.toLowerCase().trim(),
    );
    if (!patient) {
      addToast("Patient not found. Enter the exact patient name as registered.", "error");
      return;
    }
    try {
      const { id } = await createConsentForm(clinicId, patient.id, {
        consentType: consent.consentType,
        consentText: consent.consentText,
      });
      setConsents((prev) => [
        {
          id,
          patientId: patient.id,
          patientName: patient.name,
          consentType: consent.consentType as ConsentFormView["consentType"],
          signedAt: new Date().toISOString(),
          isActive: true,
          expiresAt: null,
        },
        ...prev,
      ]);
      addToast("Consent form created", "success");
    } catch (err) {
      logger.warn("Failed to create consent form", { context: "doctor/consent-forms", error: err });
      addToast("Failed to create consent form. Please try again.", "error");
    }
  }

  async function handleRevoke(id: string) {
    const previous = consents;
    setConsents((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: false } : c)));
    try {
      await revokeConsentForm(id);
      addToast("Consent revoked", "success");
    } catch (err) {
      logger.warn("Failed to revoke consent form", { context: "doctor/consent-forms", error: err });
      setConsents(previous);
      addToast("Failed to revoke consent. Please try again.", "error");
    }
  }

  if (loading) return <PageLoader message="Loading consent forms..." />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Failed to load consent forms.</p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Doctor", href: "/doctor/dashboard" }, { label: "Consent Forms" }]}
      />
      <h1 className="text-2xl font-bold">Photo Consent Forms</h1>
      {patients.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          <Label className="mr-1">Tip:</Label>
          When adding a new consent, type the patient name exactly as it appears in the system (
          {patients.length} patients available).
        </p>
      )}
      <ConsentFormManager
        consents={consents}
        editable
        onAdd={handleAdd}
        onRevoke={handleRevoke}
      />
    </div>
  );
}
