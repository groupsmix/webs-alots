import { Plus, Download, Pill } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prescriptions } from "@/lib/demo-data";

export default function DoctorPrescriptionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          New Prescription
        </Button>
      </div>

      <div className="space-y-4">
        {prescriptions.map((rx) => (
          <Card key={rx.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  {rx.patientName}
                </CardTitle>
                <Badge variant="outline">{rx.date}</Badge>
              </div>
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
              {rx.notes && <p className="text-xs text-muted-foreground mb-3">Notes: {rx.notes}</p>}
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
