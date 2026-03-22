"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProgressPhoto } from "@/lib/types/para-medical";

interface ProgressPhotoGalleryProps {
  photos: ProgressPhoto[];
}

export function ProgressPhotoGallery({ photos }: ProgressPhotoGalleryProps) {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const patients = Array.from(new Set(photos.map((p) => p.patient_name)));
  const filteredPhotos = selectedPatient
    ? photos.filter((p) => p.patient_name === selectedPatient)
    : photos;

  const sortedPhotos = [...filteredPhotos].sort(
    (a, b) => new Date(b.photo_date).getTime() - new Date(a.photo_date).getTime()
  );

  // Group by date for comparison
  const dateGroups = sortedPhotos.reduce<Record<string, ProgressPhoto[]>>((acc, photo) => {
    if (!acc[photo.photo_date]) acc[photo.photo_date] = [];
    acc[photo.photo_date].push(photo);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Patient filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !selectedPatient ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
          }`}
          onClick={() => setSelectedPatient(null)}
        >
          All Patients
        </button>
        {patients.map((name) => (
          <button
            key={name}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedPatient === name ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
            }`}
            onClick={() => setSelectedPatient(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Photo timeline */}
      {Object.keys(dateGroups).length === 0 ? (
        <div className="text-center py-12">
          <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No progress photos yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(dateGroups).map(([date, datePhotos]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{date}</h3>
                <Badge variant="outline" className="text-[10px]">{datePhotos.length} photo(s)</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {datePhotos.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden">
                    <div className="relative aspect-square bg-muted flex items-center justify-center">
                      {photo.photo_url ? (
                        <Image
                          src={photo.photo_url}
                          alt={photo.notes || "Progress photo"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium truncate">{photo.patient_name}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{photo.category}</Badge>
                      {photo.notes && (
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{photo.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date comparison helper */}
      {selectedPatient && sortedPhotos.length >= 2 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Progress Comparison
              <ChevronRight className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Earliest: {sortedPhotos[sortedPhotos.length - 1].photo_date}</p>
                <div className="relative aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {sortedPhotos[sortedPhotos.length - 1].photo_url ? (
                    <Image src={sortedPhotos[sortedPhotos.length - 1].photo_url} alt="Before" fill className="object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Latest: {sortedPhotos[0].photo_date}</p>
                <div className="relative aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {sortedPhotos[0].photo_url ? (
                    <Image src={sortedPhotos[0].photo_url} alt="After" fill className="object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
