"use client";

import { useState, useMemo } from "react";
import {
  Search, MapPin, Star, Phone, Calendar,
  Filter, Globe, MessageCircle, Stethoscope,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOROCCAN_CITIES, formatMoroccanPhone, phoneToWhatsApp } from "@/lib/morocco";

// ---- Types ----

export interface DirectoryDoctor {
  id: string;
  name: string;
  nameAr?: string;
  specialty: string;
  specialtyAr?: string;
  city: string;
  address: string;
  phone: string;
  email?: string;
  languages: string[];
  rating: number;
  reviewCount: number;
  consultationFee: number;
  acceptsInsurance: string[];
  isAvailableToday: boolean;
  nextAvailableSlot?: string;
  avatar?: string;
  clinicName: string;
  googleMapsUrl?: string;
  yearsExperience?: number;
}

// ---- Specialties ----

const SPECIALTIES = [
  { id: "general", name: "Médecine Générale", nameAr: "طب عام" },
  { id: "dentist", name: "Dentiste", nameAr: "طبيب أسنان" },
  { id: "pediatrics", name: "Pédiatrie", nameAr: "طب الأطفال" },
  { id: "cardiology", name: "Cardiologie", nameAr: "أمراض القلب" },
  { id: "dermatology", name: "Dermatologie", nameAr: "أمراض الجلد" },
  { id: "gynecology", name: "Gynécologie", nameAr: "أمراض النساء" },
  { id: "ophthalmology", name: "Ophtalmologie", nameAr: "طب العيون" },
  { id: "orthopedics", name: "Orthopédie", nameAr: "جراحة العظام" },
  { id: "ent", name: "ORL", nameAr: "أنف أذن حنجرة" },
  { id: "psychiatry", name: "Psychiatrie", nameAr: "الطب النفسي" },
  { id: "radiology", name: "Radiologie", nameAr: "الأشعة" },
  { id: "pharmacy", name: "Pharmacie", nameAr: "صيدلية" },
];

// ---- Component ----

interface DoctorDirectoryProps {
  doctors: DirectoryDoctor[];
  onBookAppointment?: (doctorId: string) => void;
}

/**
 * DoctorDirectory
 *
 * Doctolib-style public directory page for Moroccan doctors.
 * Patients can search by city, specialty, and availability.
 *
 * Features:
 * - Search by name or specialty
 * - Filter by city (Moroccan cities)
 * - Filter by specialty
 * - Show ratings and reviews
 * - Direct booking, WhatsApp, and phone call
 * - Insurance accepted display
 * - Arabic + French display
 */
export function DoctorDirectory({
  doctors,
  onBookAppointment,
}: DoctorDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const [sortBy, setSortBy] = useState<"rating" | "fee" | "name">("rating");
  const [showFilters, setShowFilters] = useState(false);

  const filteredDoctors = useMemo(() => {
    let result = doctors;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.clinicName.toLowerCase().includes(q) ||
          (d.nameAr && d.nameAr.includes(searchQuery))
      );
    }

    // City filter
    if (selectedCity !== "all") {
      result = result.filter((d) => d.city === selectedCity);
    }

    // Specialty filter
    if (selectedSpecialty !== "all") {
      result = result.filter(
        (d) => d.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase())
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "fee") return a.consultationFee - b.consultationFee;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [doctors, searchQuery, selectedCity, selectedSpecialty, sortBy]);

  const cities = useMemo(() => {
    const set = new Set(doctors.map((d) => d.city));
    return Array.from(set).sort();
  }, [doctors]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hero search */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-3xl font-bold">
          Trouvez votre médecin
        </h1>
        <p className="text-muted-foreground">
          Recherchez par ville, spécialité ou nom du médecin
        </p>
        <p className="text-sm text-muted-foreground" dir="rtl">
          ابحث عن طبيب بالقرب منك
        </p>

        <div className="flex gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nom, spécialité, clinique..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtres
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ville</label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Toutes les villes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les villes</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Spécialité</label>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les spécialités</SelectItem>
                    {SPECIALTIES.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Trier par</label>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as "rating" | "fee" | "name")}
                >
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Avis</SelectItem>
                    <SelectItem value="fee">Tarif</SelectItem>
                    <SelectItem value="name">Nom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredDoctors.length} médecin{filteredDoctors.length !== 1 ? "s" : ""} trouvé{filteredDoctors.length !== 1 ? "s" : ""}</span>
        {(selectedCity !== "all" || selectedSpecialty !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCity("all");
              setSelectedSpecialty("all");
            }}
          >
            Réinitialiser les filtres
          </Button>
        )}
      </div>

      {/* Doctor cards */}
      <div className="space-y-4">
        {filteredDoctors.map((doctor) => (
          <Card key={doctor.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {doctor.avatar ? (
                    <img
                      src={doctor.avatar}
                      alt={doctor.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <Stethoscope className="h-8 w-8 text-primary" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-base">{doctor.name}</h3>
                      {doctor.nameAr && (
                        <p className="text-sm text-muted-foreground" dir="rtl">
                          {doctor.nameAr}
                        </p>
                      )}
                      <p className="text-sm text-primary">{doctor.specialty}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {doctor.clinicName}, {doctor.city}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold">{doctor.rating.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({doctor.reviewCount})
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {doctor.consultationFee} MAD
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {doctor.isAvailableToday && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Disponible aujourd&apos;hui
                      </Badge>
                    )}
                    {doctor.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        <Globe className="h-3 w-3 mr-0.5" />
                        {lang}
                      </Badge>
                    ))}
                    {doctor.acceptsInsurance.slice(0, 3).map((ins) => (
                      <Badge key={ins} variant="secondary" className="text-xs">
                        {ins}
                      </Badge>
                    ))}
                    {doctor.acceptsInsurance.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{doctor.acceptsInsurance.length - 3}
                      </Badge>
                    )}
                  </div>

                  {doctor.nextAvailableSlot && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Prochain créneau: {doctor.nextAvailableSlot}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => onBookAppointment?.(doctor.id)}
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      حجز موعد
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://wa.me/${phoneToWhatsApp(doctor.phone)}`,
                          "_blank"
                        )
                      }
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1 text-green-600" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.open(`tel:${doctor.phone.replace(/\s/g, "")}`, "_self")
                      }
                    >
                      <Phone className="h-3.5 w-3.5 mr-1" />
                      Appeler
                    </Button>
                    {doctor.googleMapsUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doctor.googleMapsUrl, "_blank")}
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        Carte
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredDoctors.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">Aucun médecin trouvé</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Essayez de modifier vos critères de recherche
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
