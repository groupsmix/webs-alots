import { BeforeAfterGallery } from "@/components/dental/before-after-gallery";
import { beforeAfterPhotos } from "@/lib/dental-demo-data";

export default function PatientBeforeAfterPage() {
  // Demo: show patient p1's photos
  const myPhotos = beforeAfterPhotos.filter((p) => p.patientId === "p1");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Before / After Photos</h1>
      <p className="text-sm text-muted-foreground">
        Visual progress of your dental treatments.
      </p>
      <BeforeAfterGallery photos={myPhotos} editable={false} />
    </div>
  );
}
