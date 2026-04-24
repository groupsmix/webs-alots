"use client";

import {
  MapPin, Plus, Trash2, Building2, Star,
  Phone, Clock, Check,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CabinetLocation } from "@/lib/morocco";
import { MOROCCAN_CITIES } from "@/lib/morocco";

interface MultiCabinetProps {
  locations: CabinetLocation[];
  doctorName: string;
  onAddLocation?: (location: Omit<CabinetLocation, "id">) => void;
  onRemoveLocation?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  readOnly?: boolean;
}

const DAY_NAMES_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * MultiCabinet
 *
 * Manage multiple clinic locations for a doctor.
 * Very common in Morocco: doctors often work in 2-3 different clinics.
 *
 * Features:
 * - Add/remove clinic locations
 * - Set working days per location
 * - Mark default location
 * - Display city and address
 */
export function MultiCabinet({
  locations,
  doctorName,
  onAddLocation,
  onRemoveLocation,
  onSetDefault,
  readOnly = false,
}: MultiCabinetProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("Casablanca");
  const [newPhone, setNewPhone] = useState("");
  const [newWorkingDays, setNewWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const handleAdd = () => {
    if (!newName.trim() || !newAddress.trim()) return;
    onAddLocation?.({
      clinicId: "", // will be set by backend
      name: newName,
      address: newAddress,
      city: newCity,
      phone: newPhone,
      isDefault: locations.length === 0,
      workingDays: newWorkingDays,
    });
    setShowAddForm(false);
    setNewName("");
    setNewAddress("");
    setNewPhone("");
    setNewWorkingDays([1, 2, 3, 4, 5]);
  };

  const toggleWorkingDay = (day: number) => {
    setNewWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Cabinets — {doctorName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {locations.length} cabinet{locations.length !== 1 ? "s" : ""} enregistré{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un cabinet
          </Button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nouveau cabinet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom du cabinet *</Label>
                <Input
                  placeholder="Ex: Cabinet Dr. Ahmed — Maârif"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ville *</Label>
                <select
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {MOROCCAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Adresse *</Label>
                <Input
                  placeholder="Ex: 123 Bd Mohammed V, 3ème étage, Appt 5"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  placeholder="+212 5 XX XX XX XX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Jours de travail</Label>
                <div className="flex gap-1">
                  {DAY_NAMES_SHORT.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => toggleWorkingDay(i)}
                      className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                        newWorkingDays.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || !newAddress.trim()}>
                Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Locations list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {locations.map((loc) => (
          <Card
            key={loc.id}
            className={loc.isDefault ? "border-primary" : ""}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{loc.name}</p>
                    {loc.isDefault && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-0.5" />
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {loc.city}
                  </p>
                </div>
                {!readOnly && !loc.isDefault && onRemoveLocation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveLocation(loc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground mb-2">{loc.address}</p>

              {loc.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <Phone className="h-3 w-3" />
                  {loc.phone}
                </p>
              )}

              {/* Working days */}
              <div className="flex items-center gap-1 mb-3">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <div className="flex gap-1">
                  {DAY_NAMES_SHORT.map((name, i) => (
                    <span
                      key={i}
                      className={`w-7 h-7 rounded-full text-[10px] flex items-center justify-center ${
                        loc.workingDays.includes(i)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground/30"
                      }`}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {!readOnly && !loc.isDefault && onSetDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onSetDefault(loc.id)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Définir comme principal
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun cabinet enregistré
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ajoutez vos différents lieux de consultation
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
