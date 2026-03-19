import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { appointments } from "@/lib/demo-data";

const patientId = "p1";
const completedVisits = appointments.filter((a) => a.patientId === patientId && a.status === "completed");

const mockHistory = [
  { date: "2026-03-19", doctor: "Dr. Ahmed Benali", diagnosis: "Upper respiratory infection", notes: "Prescribed antibiotics. Follow-up in 7 days.", vitals: "BP: 120/80, Temp: 37.8°C" },
  { date: "2026-02-15", doctor: "Dr. Ahmed Benali", diagnosis: "Annual check-up", notes: "All vitals normal. Blood work ordered.", vitals: "BP: 118/76, Temp: 36.6°C" },
  { date: "2025-12-10", doctor: "Dr. Youssef El Amrani", diagnosis: "Mild hypertension", notes: "Started on lifestyle modifications. Re-check in 3 months.", vitals: "BP: 140/90, Temp: 36.5°C" },
];

export default function MedicalHistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Medical History</h1>
      <p className="text-muted-foreground mb-6">
        {completedVisits.length} completed visits on record.
      </p>

      <div className="space-y-4">
        {mockHistory.map((visit, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{visit.diagnosis}</CardTitle>
                <Badge variant="outline">{visit.date}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Doctor:</span> {visit.doctor}</p>
                <p><span className="text-muted-foreground">Vitals:</span> {visit.vitals}</p>
                <p><span className="text-muted-foreground">Notes:</span> {visit.notes}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
