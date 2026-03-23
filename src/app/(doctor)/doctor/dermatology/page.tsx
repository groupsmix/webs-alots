"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Camera, Plus, MapPin, Calendar, Tag, Eye,
  AlertTriangle, CheckCircle, Search, Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getCurrentUser } from "@/lib/data/client";
import {
  fetchSkinPhotos, createSkinPhoto,
  fetchSkinConditions, createSkinCondition, updateSkinCondition,
  type SkinPhotoView, type SkinConditionView,
} from "@/lib/data/specialists";
import { PageLoader } from "@/components/ui/page-loader";

const BODY_REGIONS = [
  "Face", "Scalp", "Neck", "Chest", "Back", "Abdomen",
  "Left Arm", "Right Arm", "Left Hand", "Right Hand",
  "Left Leg", "Right Leg", "Left Foot", "Right Foot",
];

const SEVERITY_COLORS: Record<string, string> = {
  mild: "text-yellow-600 bg-yellow-50",
  moderate: "text-orange-600 bg-orange-50",
  severe: "text-red-600 bg-red-50",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  active: "warning",
  monitoring: "default",
  resolved: "success",
};

export default function DermatologyPage() {
  const [photos, setPhotos] = useState<SkinPhotoView[]>([]);
  const [conditions, setConditions] = useState<SkinConditionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [photoForm, setPhotoForm] = useState({
    bodyRegion: "", description: "", tags: "",
  });
  const [conditionForm, setConditionForm] = useState({
    conditionName: "", bodyRegion: "", severity: "mild",
    notes: "", treatmentName: "", treatmentNotes: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
    const user = await getCurrentUser();
      if (controller.signal.aborted) return;
    if (!user?.clinic_id) { setLoading(false); return; }
    const [p, c] = await Promise.all([
      fetchSkinPhotos(user.clinic_id),
      fetchSkinConditions(user.clinic_id),
    ]);
      if (controller.signal.aborted) return;
    setPhotos(p);
    setConditions(c);
    setLoading(false);
  }
    load().catch((err) => {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    });
    return () => { controller.abort(); };
  }, []);

  if (loading) {
    return <PageLoader message="Loading dermatology records..." />;
  }

  const handleAddPhoto = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !photoForm.bodyRegion) return;
    const newId = await createSkinPhoto({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      body_region: photoForm.bodyRegion, description: photoForm.description,
      tags: photoForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (newId) {
      setPhotos((prev) => [{
        id: newId, patientId: user.id, patientName: "", doctorId: user.id,
        bodyRegion: photoForm.bodyRegion, description: photoForm.description,
        imageUrl: "", photoDate: new Date().toISOString().split("T")[0],
        tags: photoForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }, ...prev]);
    }
    setPhotoForm({ bodyRegion: "", description: "", tags: "" });
    setShowPhotoForm(false);
  };

  const handleAddCondition = async () => {
    const user = await getCurrentUser();
    if (!user?.clinic_id || !conditionForm.conditionName) return;
    const treatments = conditionForm.treatmentName ? [{
      name: conditionForm.treatmentName,
      startDate: new Date().toISOString().split("T")[0],
      notes: conditionForm.treatmentNotes,
    }] : [];
    const newId = await createSkinCondition({
      clinic_id: user.clinic_id, patient_id: user.id, doctor_id: user.id,
      condition_name: conditionForm.conditionName,
      body_region: conditionForm.bodyRegion,
      severity: conditionForm.severity,
      notes: conditionForm.notes, treatments,
    });
    if (newId) {
      setConditions((prev) => [{
        id: newId, patientId: user.id, patientName: "", conditionName: conditionForm.conditionName,
        bodyRegion: conditionForm.bodyRegion, severity: conditionForm.severity,
        status: "active", diagnosisDate: new Date().toISOString().split("T")[0],
        notes: conditionForm.notes, treatments,
      }, ...prev]);
    }
    setConditionForm({ conditionName: "", bodyRegion: "", severity: "mild", notes: "", treatmentName: "", treatmentNotes: "" });
    setShowConditionForm(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const ok = await updateSkinCondition(id, { status });
    if (ok) {
      setConditions((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    }
  };

  const filteredPhotos = searchQuery.trim()
    ? photos.filter((p) =>
        p.bodyRegion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : photos;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dermatology</h1>

      <Tabs defaultValue="photos">
        <TabsList className="mb-4">
          <TabsTrigger value="photos">Skin Photos</TabsTrigger>
          <TabsTrigger value="conditions">Conditions & Treatment</TabsTrigger>
          <TabsTrigger value="comparison">Before / After</TabsTrigger>
        </TabsList>

        {/* SKIN PHOTOS TAB */}
        <TabsContent value="photos">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by body region, description, or tag..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setShowPhotoForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Photo
            </Button>
          </div>

          {filteredPhotos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No skin photos documented yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPhotos.map((photo) => (
                <Card key={photo.id}>
                  <CardContent className="p-4">
                    <div className="relative aspect-square rounded-lg bg-muted flex items-center justify-center mb-3">
                      {photo.imageUrl ? (
                        <Image src={photo.imageUrl} alt={photo.description} fill className="rounded-lg object-cover" />
                      ) : (
                        <div className="text-center">
                          <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-1">No image</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{photo.bodyRegion}</span>
                    </div>
                    {photo.description && (
                      <p className="text-sm text-muted-foreground mb-2">{photo.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {photo.photoDate}
                      </div>
                      {photo.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          <Tag className="h-2 w-2 mr-1" />{tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONDITIONS & TREATMENT TAB */}
        <TabsContent value="conditions">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowConditionForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Condition
            </Button>
          </div>

          {conditions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Eye className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No skin conditions recorded.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {conditions.map((cond) => (
                <Card key={cond.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{cond.conditionName}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={SEVERITY_COLORS[cond.severity] ?? ""}>
                          {cond.severity}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[cond.status] ?? "default"}>
                          {cond.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{cond.bodyRegion}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>Diagnosed: {cond.diagnosisDate}</span>
                      </div>
                    </div>
                    {cond.notes && (
                      <p className="text-sm text-muted-foreground mb-3">{cond.notes}</p>
                    )}
                    {cond.treatments.length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-3 mb-3">
                        <p className="text-xs font-medium mb-2">Treatments:</p>
                        {cond.treatments.map((t, i) => (
                          <div key={i} className="text-sm flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="font-medium">{t.name}</span>
                            <span className="text-muted-foreground">from {t.startDate}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {cond.status === "active" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(cond.id, "monitoring")}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Monitor
                          </Button>
                          <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleStatusChange(cond.id, "resolved")}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolved
                          </Button>
                        </>
                      )}
                      {cond.status === "monitoring" && (
                        <Button variant="outline" size="sm" className="text-green-600" onClick={() => handleStatusChange(cond.id, "resolved")}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Resolved
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* BEFORE/AFTER COMPARISON TAB */}
        <TabsContent value="comparison">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Before / After Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {photos.length < 2 ? (
                <div className="py-8 text-center">
                  <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Add at least 2 photos of the same body region to compare.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {BODY_REGIONS.filter((region) =>
                    photos.filter((p) => p.bodyRegion === region).length >= 2
                  ).map((region) => {
                    const regionPhotos = photos
                      .filter((p) => p.bodyRegion === region)
                      .sort((a, b) => a.photoDate.localeCompare(b.photoDate));
                    const first = regionPhotos[0];
                    const last = regionPhotos[regionPhotos.length - 1];
                    return (
                      <div key={region}>
                        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <MapPin className="h-3 w-3" /> {region}
                          <Badge variant="outline" className="text-[10px]">{regionPhotos.length} photos</Badge>
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Before — {first.photoDate}</p>
                            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                              <Camera className="h-6 w-6 text-muted-foreground" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">After — {last.photoDate}</p>
                            <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                              <Camera className="h-6 w-6 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {BODY_REGIONS.filter((region) =>
                    photos.filter((p) => p.bodyRegion === region).length >= 2
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No body regions with multiple photos for comparison yet.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Photo Dialog */}
      <Dialog open={showPhotoForm} onOpenChange={setShowPhotoForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Document Skin Photo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Body Region</Label>
              <Select value={photoForm.bodyRegion} onValueChange={(v) => setPhotoForm((p) => ({ ...p, bodyRegion: v }))}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {BODY_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the observation..."
                value={photoForm.description}
                onChange={(e) => setPhotoForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Upload Photo</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs">Browse</Button>
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="e.g., rash, eczema, follow-up"
                value={photoForm.tags}
                onChange={(e) => setPhotoForm((p) => ({ ...p, tags: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPhotoForm(false)}>Cancel</Button>
              <Button onClick={handleAddPhoto}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Condition Dialog */}
      <Dialog open={showConditionForm} onOpenChange={setShowConditionForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Skin Condition</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Condition Name</Label>
              <Input
                placeholder="e.g., Eczema, Psoriasis, Acne"
                value={conditionForm.conditionName}
                onChange={(e) => setConditionForm((p) => ({ ...p, conditionName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Body Region</Label>
                <Select value={conditionForm.bodyRegion} onValueChange={(v) => setConditionForm((p) => ({ ...p, bodyRegion: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BODY_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={conditionForm.severity} onValueChange={(v) => setConditionForm((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Clinical notes..."
                value={conditionForm.notes}
                onChange={(e) => setConditionForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Initial Treatment (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Treatment Name</Label>
                  <Input
                    placeholder="e.g., Topical cream"
                    value={conditionForm.treatmentName}
                    onChange={(e) => setConditionForm((p) => ({ ...p, treatmentName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    placeholder="Details..."
                    value={conditionForm.treatmentNotes}
                    onChange={(e) => setConditionForm((p) => ({ ...p, treatmentNotes: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConditionForm(false)}>Cancel</Button>
              <Button onClick={handleAddCondition}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
