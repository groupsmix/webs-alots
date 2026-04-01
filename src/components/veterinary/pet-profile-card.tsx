"use client";

import {
  PawPrint, Calendar, Weight, Edit, Trash2, Plus,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDisplayDate } from "@/lib/utils";

export interface PetProfile {
  id: string;
  owner_id: string;
  clinic_id: string;
  name: string;
  species: string;
  breed: string | null;
  weight_kg: number | null;
  date_of_birth: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕",
  cat: "🐈",
  bird: "🐦",
  rabbit: "🐇",
  reptile: "🦎",
  fish: "🐟",
  hamster: "🐹",
  other: "🐾",
};

interface PetProfileCardProps {
  pets: PetProfile[];
  editable?: boolean;
  onEdit?: (pet: PetProfile) => void;
  onDelete?: (petId: string) => void;
  onAdd?: () => void;
}

export function PetProfileCard({
  pets,
  editable = false,
  onEdit,
  onDelete,
  onAdd,
}: PetProfileCardProps) {
  const [search, setSearch] = useState("");

  const filteredPets = pets.filter((pet) =>
    pet.name.toLowerCase().includes(search.toLowerCase()) ||
    pet.species.toLowerCase().includes(search.toLowerCase()) ||
    (pet.breed?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Profils des animaux</h2>
          <Badge variant="secondary">{pets.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 text-sm"
          />
          {editable && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Pet Grid */}
      {filteredPets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PawPrint className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? "Aucun animal trouvé" : "Aucun animal enregistré"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              editable={editable}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PetCard({
  pet,
  editable,
  onEdit,
  onDelete,
}: {
  pet: PetProfile;
  editable: boolean;
  onEdit?: (pet: PetProfile) => void;
  onDelete?: (petId: string) => void;
}) {
  const emoji = SPECIES_EMOJI[pet.species.toLowerCase()] ?? SPECIES_EMOJI.other;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
              {emoji}
            </div>
            <div>
              <CardTitle className="text-base">{pet.name}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
              </p>
            </div>
          </div>
          {editable && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onEdit?.(pet)} title="Modifier">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete?.(pet.id)} title="Supprimer">
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {pet.weight_kg != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Weight className="h-3.5 w-3.5" />
              <span>{pet.weight_kg} kg</span>
            </div>
          )}
          {pet.date_of_birth && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDisplayDate(pet.date_of_birth, "fr", "short")}</span>
            </div>
          )}
        </div>
        {pet.notes && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pet.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Add Pet Form (inline) ───────────────────────────────── */

interface AddPetFormProps {
  onSubmit: (data: {
    name: string;
    species: string;
    breed?: string;
    weight_kg?: number;
    date_of_birth?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

export function AddPetForm({ onSubmit, onCancel }: AddPetFormProps) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("");
  const [weight, setWeight] = useState("");
  const [dob, setDob] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      species,
      breed: breed.trim() || undefined,
      weight_kg: weight ? parseFloat(weight) : undefined,
      date_of_birth: dob || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <PawPrint className="h-4 w-4" />
          Nouveau profil animal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rex" required />
            </div>
            <div>
              <Label className="text-xs">Espece *</Label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="dog">Chien</option>
                <option value="cat">Chat</option>
                <option value="bird">Oiseau</option>
                <option value="rabbit">Lapin</option>
                <option value="reptile">Reptile</option>
                <option value="fish">Poisson</option>
                <option value="hamster">Hamster</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Race</Label>
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Berger allemand" />
            </div>
            <div>
              <Label className="text-xs">Poids (kg)</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" step="0.1" placeholder="25" />
            </div>
            <div>
              <Label className="text-xs">Date de naissance</Label>
              <Input value={dob} onChange={(e) => setDob(e.target.value)} type="date" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, traitements en cours..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm">Enregistrer</Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
