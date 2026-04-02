"use client";

import { PawPrint, Plus, Search } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";

interface PetProfile {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  weight_kg: number | null;
  date_of_birth: string | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  owner?: { id: string; name: string } | null;
}

const SPECIES_OPTIONS = [
  "dog", "cat", "bird", "rabbit", "hamster", "fish",
  "reptile", "horse", "cattle", "sheep", "goat", "other",
];

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", rabbit: "🐇", hamster: "🐹",
  fish: "🐟", reptile: "🦎", horse: "🐴", cattle: "🐄", sheep: "🐑",
  goat: "🐐", other: "🐾",
};

export default function PetProfilesPage() {
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newPet, setNewPet] = useState({
    name: "",
    species: "dog",
    breed: "",
    weight_kg: "",
    date_of_birth: "",
    owner_id: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const loadPets = useCallback(async () => {
    try {
      const res = await fetch("/api/pets");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { pets: PetProfile[] };
      setPets(data.pets ?? []);
    } catch (err) {
      logger.warn("Failed to load pet profiles", { context: "pet-profiles-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPet.name,
          species: newPet.species,
          breed: newPet.breed || undefined,
          weight_kg: newPet.weight_kg ? Number(newPet.weight_kg) : undefined,
          date_of_birth: newPet.date_of_birth || undefined,
          owner_id: newPet.owner_id,
          notes: newPet.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setCreateOpen(false);
      setNewPet({ name: "", species: "dog", breed: "", weight_kg: "", date_of_birth: "", owner_id: "", notes: "" });
      void loadPets();
    } catch (err) {
      logger.warn("Failed to create pet profile", { context: "pet-profiles-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  const filtered = pets.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.species.toLowerCase().includes(search.toLowerCase()) ||
      (p.breed?.toLowerCase().includes(search.toLowerCase()) ?? false),
  );

  const speciesCounts = pets.reduce<Record<string, number>>((acc, p) => {
    acc[p.species] = (acc[p.species] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Pet Profiles" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PawPrint className="h-6 w-6" />
            Pet Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage pet profiles, species, and vaccination records
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Pet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <PawPrint className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{pets.length}</p>
                <p className="text-xs text-muted-foreground">Total Pets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <PawPrint className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{pets.filter((p) => p.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active Pets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <PawPrint className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{Object.keys(speciesCounts).length}</p>
                <p className="text-xs text-muted-foreground">Species Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Species breakdown */}
      {Object.keys(speciesCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(speciesCounts).map(([species, count]) => (
            <Badge key={species} variant="secondary" className="text-xs">
              {SPECIES_EMOJI[species] ?? "🐾"} {species}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, species, or breed..." className="pl-9" />
      </div>

      {/* Pet Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              No pet profiles found. Register your first pet to get started.
            </CardContent>
          </Card>
        ) : (
          filtered.map((pet) => (
            <Card key={pet.id} className={!pet.is_active ? "opacity-60" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{SPECIES_EMOJI[pet.species] ?? "🐾"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{pet.name}</span>
                      <Badge variant={pet.is_active ? "default" : "secondary"} className="text-[10px]">
                        {pet.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
                    {pet.weight_kg && (
                      <p className="text-xs text-muted-foreground">{pet.weight_kg} kg</p>
                    )}
                    {pet.date_of_birth && (
                      <p className="text-xs text-muted-foreground">Born: {pet.date_of_birth}</p>
                    )}
                    {pet.owner && (
                      <p className="text-xs text-muted-foreground mt-1">Owner: {pet.owner.name}</p>
                    )}
                    {pet.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pet.notes}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>New Pet Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pet Name</Label>
              <Input value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} placeholder="e.g., Buddy" />
            </div>
            <div className="space-y-2">
              <Label>Owner ID</Label>
              <Input value={newPet.owner_id} onChange={(e) => setNewPet({ ...newPet, owner_id: e.target.value })} placeholder="Owner user UUID" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Species</Label>
                <select
                  value={newPet.species}
                  onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {SPECIES_OPTIONS.map((s) => (
                    <option key={s} value={s}>{SPECIES_EMOJI[s]} {s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Breed (optional)</Label>
                <Input value={newPet.breed} onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })} placeholder="e.g., Labrador" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={newPet.weight_kg} onChange={(e) => setNewPet({ ...newPet, weight_kg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={newPet.date_of_birth} onChange={(e) => setNewPet({ ...newPet, date_of_birth: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={newPet.notes} onChange={(e) => setNewPet({ ...newPet, notes: e.target.value })} placeholder="Any notes about the pet..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !newPet.name || !newPet.owner_id}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Pet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
