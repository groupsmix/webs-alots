"use client";

/**
 * Pet Profile Card (Veterinary Vertical)
 *
 * Displays a pet profile card with species icon, breed, weight,
 * and age. Used in the patient/client dashboard for veterinary clinics.
 */

import {
  PawPrint,
  Weight,
  Calendar,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PetProfile } from "@/lib/types/database";

// ── Species labels ──

const SPECIES_LABELS: Record<string, { fr: string; icon: string }> = {
  dog: { fr: "Chien", icon: "🐕" },
  cat: { fr: "Chat", icon: "🐈" },
  bird: { fr: "Oiseau", icon: "🐦" },
  rabbit: { fr: "Lapin", icon: "🐇" },
  hamster: { fr: "Hamster", icon: "🐹" },
  fish: { fr: "Poisson", icon: "🐟" },
  reptile: { fr: "Reptile", icon: "🦎" },
  horse: { fr: "Cheval", icon: "🐴" },
  cattle: { fr: "Bovin", icon: "🐄" },
  sheep: { fr: "Mouton", icon: "🐑" },
  goat: { fr: "Chèvre", icon: "🐐" },
  other: { fr: "Autre", icon: "🐾" },
};

// ── Helpers ──

function computeAge(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;

  if (totalMonths < 1) return "< 1 mois";
  if (totalMonths < 12) return `${totalMonths} mois`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (m === 0) return `${y} an${y > 1 ? "s" : ""}`;
  return `${y} an${y > 1 ? "s" : ""} ${m} mois`;
}

// ── Props ──

interface PetProfileCardProps {
  pet: PetProfile;
  /** Called when the user clicks the edit button */
  onEdit?: (pet: PetProfile) => void;
  /** Called when the user clicks the delete button */
  onDelete?: (petId: string) => void;
  /** Show edit/delete actions (default: true) */
  showActions?: boolean;
}

// ── Component ──

export function PetProfileCard({
  pet,
  onEdit,
  onDelete,
  showActions = true,
}: PetProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const speciesInfo = SPECIES_LABELS[pet.species] ?? SPECIES_LABELS.other;
  const age = computeAge(pet.date_of_birth);

  return (
    <Card className="border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-lg">{speciesInfo.icon}</span>
            <span>{pet.name}</span>
            <Badge variant="outline" className="text-[10px] ml-1">
              {speciesInfo.fr}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            {showActions && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(pet)}
                className="h-7 w-7 p-0"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {showActions && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(pet.id)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 w-7 p-0"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Summary line — always visible */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {pet.breed && (
            <span className="flex items-center gap-1">
              <PawPrint className="h-3 w-3" />
              {pet.breed}
            </span>
          )}
          {pet.weight_kg != null && (
            <span className="flex items-center gap-1">
              <Weight className="h-3 w-3" />
              {pet.weight_kg} kg
            </span>
          )}
          {age && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {age}
            </span>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t pt-3 text-sm">
            {pet.date_of_birth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date de naissance</span>
                <span>
                  {new Date(pet.date_of_birth).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
            {pet.notes && (
              <div>
                <span className="text-muted-foreground">Notes</span>
                <p className="mt-1 text-foreground">{pet.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
