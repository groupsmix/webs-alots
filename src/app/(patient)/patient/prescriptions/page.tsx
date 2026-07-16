"use client";

import { Download, Pill, FileText, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { getCurrentUser, fetchPrescriptions, type PrescriptionView } from "@/lib/data/client";

const PRESCRIPTION_PDF_DISABLED_MESSAGE =
  "Prescription PDF downloads are temporarily unavailable in this deployment.";

export default function PatientPrescriptionsPage() {
  const [patientPrescriptions, setPatientPrescriptions] = useState<PrescriptionView[]>([]);
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
      const rxs = await fetchPrescriptions(user.clinic_id);
      if (controller.signal.aborted) return;
      setPatientPrescriptions(rxs.filter((rx) => rx.patientId === user.id));
      setLoading(false);
    }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => {
      controller.abort();
    };
  }, []);

  if (loading) {
    return <PageLoader message="Loading prescriptions..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">
          Failed to load data. Please try refreshing the page.
        </p>
        {error.message && <p className="text-sm text-muted-foreground mt-2">{error.message}</p>}
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Prescriptions" }]}
      />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patientPrescriptions.length} prescription{patientPrescriptions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {PRESCRIPTION_PDF_DISABLED_MESSAGE}
      </div>

      {patientPrescriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No prescriptions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {patientPrescriptions.map((rx) => (
            <Card key={rx.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Pill className="h-4 w-4 text-primary" />
                    </div>
                    Prescription #{rx.id.toUpperCase()}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {rx.date}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground ms-10">By {rx.doctorName}</p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-3 mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-start font-medium pb-2">Medication</th>
                        <th className="text-start font-medium pb-2">Dosage</th>
                        <th className="text-start font-medium pb-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rx.medications.map((med) => (
                        <tr
                          key={`${rx.id}-${med.name}-${med.dosage}-${med.duration}`}
                          className="border-t"
                        >
                          <td className="py-2 font-medium">{med.name}</td>
                          <td className="py-2 text-muted-foreground">{med.dosage}</td>
                          <td className="py-2 text-muted-foreground">{med.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rx.notes && (
                  <div className="rounded-lg bg-muted/50 p-3 mb-3 flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{rx.notes}</p>
                  </div>
                )}
                <Button variant="outline" size="sm" disabled>
                  <Download className="h-4 w-4 me-1" />
                  PDF unavailable
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
