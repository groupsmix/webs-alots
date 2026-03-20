"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";
import type { CustomFieldDefinition } from "@/lib/types/custom-fields";

const ENTITY_TYPES = [
  { value: "appointment", label: "Rendez-vous" },
  { value: "patient", label: "Patient" },
  { value: "consultation", label: "Consultation" },
  { value: "product", label: "Produit" },
  { value: "lab_order", label: "Commande Labo" },
];

const FIELD_TYPES = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste déroulante" },
  { value: "multi_select", label: "Sélection multiple" },
  { value: "file", label: "Fichier" },
  { value: "tooth_number", label: "Numéro de dent" },
];

interface ClinicTypeOption {
  type_key: string;
  name_fr: string;
  category: string;
}

export default function CustomFieldsAdminPage() {
  const [clinicTypes, setClinicTypes] = useState<ClinicTypeOption[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Load clinic types
  useEffect(() => {
    async function loadClinicTypes() {
      try {
        const res = await fetch("/api/custom-fields?clinic_type_key=_all_types");
        if (res.ok) {
          // Fallback: we'll use a hardcoded list based on known types
        }
      } catch {
        // Ignore
      }
      // Use known clinic types from the system
      setClinicTypes([
        { type_key: "general_medicine", name_fr: "Médecine Générale", category: "medical" },
        { type_key: "cardiology", name_fr: "Cardiologie", category: "medical" },
        { type_key: "dermatology", name_fr: "Dermatologie", category: "medical" },
        { type_key: "pediatrics", name_fr: "Pédiatrie", category: "medical" },
        { type_key: "ophthalmology", name_fr: "Ophtalmologie", category: "medical" },
        { type_key: "dental_clinic", name_fr: "Cabinet Dentaire", category: "clinics_centers" },
        { type_key: "pharmacy", name_fr: "Pharmacie", category: "pharmacy_retail" },
        { type_key: "medical_lab", name_fr: "Laboratoire", category: "diagnostic" },
        { type_key: "physiotherapy", name_fr: "Kinésithérapie", category: "para_medical" },
        { type_key: "radiology", name_fr: "Radiologie", category: "diagnostic" },
      ]);
    }
    loadClinicTypes();
  }, []);

  const loadDefinitions = useCallback(async () => {
    if (!selectedType) return;
    setLoading(true);
    try {
      let url = `/api/custom-fields?clinic_type_key=${encodeURIComponent(selectedType)}`;
      if (selectedEntity) {
        url += `&entity_type=${encodeURIComponent(selectedEntity)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setDefinitions(data.definitions ?? []);
    } catch {
      console.error("Failed to load definitions");
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedEntity]);

  useEffect(() => {
    if (selectedType) {
      loadDefinitions();
    }
  }, [selectedType, selectedEntity, loadDefinitions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce champ ?")) return;
    try {
      await fetch(`/api/custom-fields?id=${id}`, { method: "DELETE" });
      loadDefinitions();
    } catch {
      console.error("Failed to delete field");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Champs Personnalisés
          </h1>
          <p className="text-muted-foreground">
            Gérez les champs personnalisés pour chaque type de clinique
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1 min-w-[200px]">
              <Label>Type de clinique</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type..." />
                </SelectTrigger>
                <SelectContent>
                  {clinicTypes.map((ct) => (
                    <SelectItem key={ct.type_key} value={ct.type_key}>
                      {ct.name_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[200px]">
              <Label>Entité</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les entités" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et.value} value={et.value}>
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedType && (
              <div className="flex items-end">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau champ
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Créer un champ personnalisé</DialogTitle>
                    </DialogHeader>
                    <CreateFieldForm
                      clinicTypeKey={selectedType}
                      onSuccess={() => {
                        setShowCreateDialog(false);
                        loadDefinitions();
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Definitions List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Chargement...</div>
      ) : !selectedType ? (
        <div className="text-center py-12 text-muted-foreground">
          Sélectionnez un type de clinique pour voir les champs personnalisés
        </div>
      ) : definitions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun champ personnalisé pour ce type
        </div>
      ) : (
        <div className="grid gap-3">
          {definitions.map((def) => (
            <Card key={def.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{def.label_fr}</span>
                        {def.label_ar && (
                          <span className="text-muted-foreground text-sm" dir="rtl">
                            {def.label_ar}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {FIELD_TYPES.find((ft) => ft.value === def.field_type)?.label ?? def.field_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {ENTITY_TYPES.find((et) => et.value === def.entity_type)?.label ?? def.entity_type}
                        </Badge>
                        <code className="text-xs text-muted-foreground">{def.field_key}</code>
                        {def.is_required && (
                          <Badge variant="destructive" className="text-xs">Requis</Badge>
                        )}
                        {def.is_system && (
                          <Badge className="text-xs">Système</Badge>
                        )}
                      </div>
                      {def.description && (
                        <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={def.is_system}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(def.id)}
                      disabled={def.is_system}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Create Field Form ----

interface CreateFieldFormProps {
  clinicTypeKey: string;
  onSuccess: () => void;
}

function CreateFieldForm({ clinicTypeKey, onSuccess }: CreateFieldFormProps) {
  const [formData, setFormData] = useState({
    entity_type: "",
    field_key: "",
    field_type: "",
    label_fr: "",
    label_ar: "",
    description: "",
    placeholder: "",
    is_required: false,
    options_text: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Parse options for select/multi_select
      let options: Array<{ value: string; label_fr: string; label_ar: string }> = [];
      if (formData.field_type === "select" || formData.field_type === "multi_select") {
        options = formData.options_text
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split("|").map((s) => s.trim());
            return {
              value: parts[0]?.toLowerCase().replace(/\s+/g, "_") ?? "",
              label_fr: parts[0] ?? "",
              label_ar: parts[1] ?? "",
            };
          });
      }

      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_type_key: clinicTypeKey,
          entity_type: formData.entity_type,
          field_key: formData.field_key,
          field_type: formData.field_type,
          label_fr: formData.label_fr,
          label_ar: formData.label_ar || undefined,
          description: formData.description || undefined,
          placeholder: formData.placeholder || undefined,
          is_required: formData.is_required,
          options: options.length > 0 ? options : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la création");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Entité *</Label>
          <Select
            value={formData.entity_type}
            onValueChange={(v) => setFormData((p) => ({ ...p, entity_type: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((et) => (
                <SelectItem key={et.value} value={et.value}>
                  {et.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Type de champ *</Label>
          <Select
            value={formData.field_type}
            onValueChange={(v) => setFormData((p) => ({ ...p, field_type: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>
                  {ft.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Clé du champ *</Label>
        <Input
          value={formData.field_key}
          onChange={(e) => setFormData((p) => ({ ...p, field_key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
          placeholder="ex: tooth_number, blood_type"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Libellé (FR) *</Label>
          <Input
            value={formData.label_fr}
            onChange={(e) => setFormData((p) => ({ ...p, label_fr: e.target.value }))}
            placeholder="Numéro de dent"
          />
        </div>
        <div className="space-y-1">
          <Label>Libellé (AR)</Label>
          <Input
            value={formData.label_ar}
            onChange={(e) => setFormData((p) => ({ ...p, label_ar: e.target.value }))}
            placeholder="رقم السن"
            dir="rtl"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          placeholder="Description du champ..."
        />
      </div>

      {(formData.field_type === "select" || formData.field_type === "multi_select") && (
        <div className="space-y-1">
          <Label>Options (une par ligne, format: Label FR | Label AR)</Label>
          <Textarea
            value={formData.options_text}
            onChange={(e) => setFormData((p) => ({ ...p, options_text: e.target.value }))}
            placeholder={"Option 1 | الخيار 1\nOption 2 | الخيار 2"}
            rows={4}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_required"
          checked={formData.is_required}
          onChange={(e) => setFormData((p) => ({ ...p, is_required: e.target.checked }))}
        />
        <Label htmlFor="is_required">Champ obligatoire</Label>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Création..." : "Créer le champ"}
      </Button>
    </form>
  );
}
