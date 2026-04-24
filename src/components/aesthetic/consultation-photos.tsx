"use client";

import { Camera, Plus, MapPin, StickyNote } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber, formatDisplayDate } from "@/lib/utils";

interface PhotoView {
  id: string;
  patientName: string;
  photoUrl: string;
  thumbnailUrl: string | null;
  bodyArea: string | null;
  notes: string | null;
  annotations: { x: number; y: number; text: string }[];
  takenAt: string;
}

interface ConsultationPhotosProps {
  photos: PhotoView[];
  editable?: boolean;
  onAddPhoto?: (photo: { bodyArea: string; notes: string }) => void;
}

export function ConsultationPhotos({ photos, editable = false, onAddPhoto }: ConsultationPhotosProps) {
  const [locale] = useLocale();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bodyArea: "", notes: "" });
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoView | null>(null);

  const handleAdd = () => {
    if (onAddPhoto) {
      onAddPhoto(form);
      setForm({ bodyArea: "", notes: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Consultation Photos
          <Badge variant="secondary" className="ml-1">{photos.length}</Badge>
        </h2>
        {editable && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Capture Photo
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New Consultation Photo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <Camera className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Click to upload or drag & drop photo</p>
              <p className="text-xs">Supports JPG, PNG up to 10MB</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Body Area</Label>
                <Input value={form.bodyArea} onChange={(e) => setForm({ ...form, bodyArea: e.target.value })} placeholder="Face, Nose, Body..." className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observations..." className="text-sm" rows={1} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Save Photo</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No consultation photos yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setSelectedPhoto(photo)}>
                <CardContent className="p-2">
                  <div className="relative aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {photo.thumbnailUrl || photo.photoUrl ? (
                      <Image src={photo.thumbnailUrl || photo.photoUrl} alt="Consultation" fill className="object-cover rounded-lg" />
                    ) : (
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    )}
                    {photo.annotations.length > 0 && (
                      <Badge variant="default" className="absolute top-2 right-2 text-[10px]">
                        {photo.annotations.length} notes
                      </Badge>
                    )}
                  </div>
                  <div className="px-1">
                    <p className="text-xs font-medium truncate">{photo.patientName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {photo.bodyArea && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {photo.bodyArea}</span>}
                      <span>{new Date(photo.takenAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Photo Detail Modal */}
          {selectedPhoto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedPhoto(null)}>
              <Card className="w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{selectedPhoto.patientName} — {selectedPhoto.bodyArea || "Consultation Photo"}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setSelectedPhoto(null)}>Close</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {selectedPhoto.photoUrl ? (
                      <Image src={selectedPhoto.photoUrl} alt="Consultation" fill className="object-contain" />
                    ) : (
                      <Camera className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  {selectedPhoto.notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <p className="text-muted-foreground">{selectedPhoto.notes}</p>
                    </div>
                  )}
                  {selectedPhoto.annotations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Annotations:</p>
                      <div className="space-y-1">
                        {selectedPhoto.annotations.map((ann, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            ({ann.x}, {ann.y}): {ann.text}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Taken: {formatDisplayDate(new Date(selectedPhoto.takenAt), typeof locale !== "undefined" ? locale : "fr", "datetime")}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
