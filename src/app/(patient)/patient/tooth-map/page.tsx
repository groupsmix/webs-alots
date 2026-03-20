import { OdontogramChart } from "@/components/dental/odontogram-chart";
import { patientOdontograms } from "@/lib/dental-demo-data";

export default function PatientToothMapPage() {
  // Demo: show patient p1's odontogram
  const myOdontogram = patientOdontograms.find((o) => o.patientId === "p1");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Tooth Map</h1>
      <p className="text-sm text-muted-foreground">
        Visual overview of your dental health. Click on any tooth for details.
      </p>
      {myOdontogram ? (
        <OdontogramChart entries={myOdontogram.entries} editable={false} />
      ) : (
        <p className="text-muted-foreground">No dental records found.</p>
      )}
    </div>
  );
}
