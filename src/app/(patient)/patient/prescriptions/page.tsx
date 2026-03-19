import { Download, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prescriptions } from "@/lib/demo-data";

const patientPrescriptions = prescriptions.filter((p) => p.patientId === "p1");

export default function PatientPrescriptionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Prescriptions</h1>

      <div className="space-y-4">
        {patientPrescriptions.map((rx) => (
          <Card key={rx.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  Prescription #{rx.id.toUpperCase()}
                </CardTitle>
                <Badge variant="outline">{rx.date}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">By {rx.doctorName}</p>
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
                        <td className="py-2">{med.name}</td>
                        <td className="py-2 text-muted-foreground">{med.dosage}</td>
                        <td className="py-2 text-muted-foreground">{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
