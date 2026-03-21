"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Pill, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCurrentUser,
  fetchPrescriptions,
  type PrescriptionView,
} from "@/lib/data/client";

export default function PatientPrescriptionsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [patientPrescriptions, setPatientPrescriptions] = useState<PrescriptionView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
    const user = await getCurrentUser();
    if (!user?.clinic_id) { setLoading(false); return; }
    const rxs = await fetchPrescriptions(user.clinic_id);
    setPatientPrescriptions(rxs.filter(rx => rx.patientId === user.id));
    setLoading(false);
  }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading prescriptions...</p>
      </div>
    );
  }

  const handleDownload = (rxId: string) => {
    setDownloading(rxId);
    setTimeout(() => {
      setDownloading(null);
    }, 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">{patientPrescriptions.length} prescription{patientPrescriptions.length !== 1 ? "s" : ""}</p>
        </div>
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
                <p className="text-sm text-muted-foreground ml-10">By {rx.doctorName}</p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-3 mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left font-medium pb-2">Medication</th>
                        <th className="text-left font-medium pb-2">Dosage</th>
                        <th className="text-left font-medium pb-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rx.medications.map((med, i) => (
                        <tr key={i} className="border-t">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(rx.id)}
                  disabled={downloading === rx.id}
                >
                  <Download className={`h-4 w-4 mr-1 ${downloading === rx.id ? "animate-bounce" : ""}`} />
                  {downloading === rx.id ? "Downloading..." : "Download PDF"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
