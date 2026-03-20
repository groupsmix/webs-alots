"use client";

import { useState } from "react";
import { Camera, Plus, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BeforeAfterPhotoView as BeforeAfterPhoto } from "@/lib/data/client";

interface BeforeAfterGalleryProps {
  photos: BeforeAfterPhoto[];
  editable?: boolean;
  onAddPhoto?: (photo: Omit<BeforeAfterPhoto, "id">) => void;
}

export function BeforeAfterGallery({ photos, editable = false, onAddPhoto }: BeforeAfterGalleryProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhoto, setNewPhoto] = useState({
    description: "",
    category: "",
    patientName: "",
  });

  const handleAdd = () => {
    if (newPhoto.description.trim() && onAddPhoto) {
      onAddPhoto({
        patientId: "p1",
        patientName: newPhoto.patientName || "Patient",
        treatmentPlanId: "",
        description: newPhoto.description,
        beforeDate: new Date().toISOString().split("T")[0],
        afterDate: null,
        category: newPhoto.category || "General",
      });
      setNewPhoto({ description: "", category: "", patientName: "" });
      setShowAddForm(false);
    }
  };

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Photo Record
          </Button>
        </div>
      )}

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New Before/After Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patient Name</Label>
                <Input
                  value={newPhoto.patientName}
                  onChange={(e) => setNewPhoto({ ...newPhoto, patientName: e.target.value })}
                  placeholder="Patient name"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input
                  value={newPhoto.category}
                  onChange={(e) => setNewPhoto({ ...newPhoto, category: e.target.value })}
                  placeholder="e.g., Whitening, Crown"
                  className="text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={newPhoto.description}
                onChange={(e) => setNewPhoto({ ...newPhoto, description: e.target.value })}
                placeholder="Treatment description"
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Upload Before Photo</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
              </div>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Upload After Photo</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>Save Record</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No before/after photos yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <Card key={photo.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-xs">{photo.category}</Badge>
                  <span className="text-xs text-muted-foreground">{photo.patientName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground mt-1">Before</p>
                    </div>
                  </div>
                  <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground mt-1">After</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm">{photo.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{photo.beforeDate}</span>
                  {photo.afterDate && (
                    <>
                      <span>&rarr;</span>
                      <span>{photo.afterDate}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
