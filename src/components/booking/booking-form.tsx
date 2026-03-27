"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Stethoscope, User, Loader2, Phone, MessageCircle } from "lucide-react";
import { fetchDoctors, fetchServices, type DoctorView, type ServiceView } from "@/lib/data/client";
import { clinicConfig } from "@/config/clinic.config";
import { useTenant } from "@/components/tenant-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "./calendar";
import { TimeSlotPicker } from "./time-slots";
import { logger } from "@/lib/logger";

/**
 * Simplified 3-step booking flow:
 *   Step 1 — Select service (implicitly selects doctor)
 *   Step 2 — Pick date & time
 *   Step 3 — Confirm (phone number only, no account required)
 */
const STEPS = ["Service", "Date & Heure", "Confirmation"];

interface Doctor {
  id: string;
  name: string;
  specialtyId: string;
  specialty: string;
  phone: string;
  email: string;
  avatar?: string;
  consultationFee: number;
  languages: string[];
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  currency: string;
  active: boolean;
}

/** A combined service+doctor entry for the unified Step 1 */
interface ServiceOption {
  service: Service;
  doctor: Doctor;
  key: string;
}

function mapDoctor(d: DoctorView): Doctor {
  return {
    id: d.id,
    name: d.name,
    specialtyId: d.specialtyId,
    specialty: d.specialty,
    phone: d.phone,
    email: d.email,
    avatar: d.avatar,
    consultationFee: d.consultationFee,
    languages: d.languages,
  };
}

function mapService(s: ServiceView): Service {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    duration: s.duration,
    price: s.price,
    currency: s.currency,
    active: s.active,
  };
}

export function BookingForm() {
  const [step, setStep] = useState(0);
  const tenant = useTenant();

  // Selections
  const [selectedServiceKey, setSelectedServiceKey] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // Honeypot field for basic bot protection (invisible to real users)
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Supabase-loaded data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Slot data (fetched dynamically via API when date/doctor change)
  const [slotData, setSlotData] = useState<{
    available: string[];
    all: string[];
    counts: Record<string, number>;
  }>({ available: [], all: [], counts: {} });

  // Load doctors and services from Supabase on mount
  useEffect(() => {
    const clinicId = tenant?.clinicId;
    if (!clinicId) return;

    let cancelled = false;
    Promise.all([
      fetchDoctors(clinicId),
      fetchServices(clinicId),
    ]).then(([dbDoctors, dbServices]) => {
      if (cancelled) return;
      setDoctors(dbDoctors.map(mapDoctor));
      setServices(dbServices.map(mapService));
    }).catch((err) => {
      logger.warn("Operation failed", { context: "booking-form", error: err });
    });
    return () => { cancelled = true; };
  }, [tenant?.clinicId]);

  // Build combined service+doctor options for Step 1
  const serviceOptions: ServiceOption[] = useMemo(() => {
    const opts: ServiceOption[] = [];
    const emptyDoctor: Doctor = {
      id: "", name: "", specialtyId: "", specialty: "",
      phone: "", email: "", consultationFee: 0, languages: [],
    };
    for (const svc of services.filter((s) => s.active)) {
      if (doctors.length > 0) {
        for (const doc of doctors) {
          opts.push({ service: svc, doctor: doc, key: `${svc.id}::${doc.id}` });
        }
      } else {
        opts.push({ service: svc, doctor: emptyDoctor, key: `${svc.id}::` });
      }
    }
    return opts;
  }, [services, doctors]);

  // Parse current selection
  const selected = useMemo(() => {
    return serviceOptions.find((o) => o.key === selectedServiceKey) ?? null;
  }, [serviceOptions, selectedServiceKey]);

  const selectedDoctor = selected?.doctor ?? null;
  const selectedService = selected?.service ?? null;

  // Fetch available slots when date or doctor changes
  useEffect(() => {
    if (!selectedDate || !selectedDoctor?.id) return;

    let cancelled = false;

    fetch(`/api/booking?date=${selectedDate}&doctorId=${selectedDoctor.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setSlotData(data
          ? { available: data.slots ?? [], all: data.allSlots ?? [], counts: data.bookedCounts ?? {} }
          : { available: [], all: [], counts: {} });
      })
      .catch(() => {
        if (!cancelled) setSlotData({ available: [], all: [], counts: {} });
      });

    return () => { cancelled = true; };
  }, [selectedDate, selectedDoctor?.id]);

  // Derive slot arrays
  const availableSlots = (selectedDate && selectedDoctor?.id) ? slotData.available : [];
  const allSlots = (selectedDate && selectedDoctor?.id) ? slotData.all : [];
  const slotCounts = (selectedDate && selectedDoctor?.id) ? slotData.counts : {};

  const canNext = () => {
    if (step === 0) return !!selectedServiceKey;
    if (step === 1) return !!selectedDate && !!selectedTime;
    if (step === 2) return !!patientPhone;
    return true;
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    // Honeypot check: if the hidden field was filled, silently reject
    if (honeypot) {
      setSubmitted(true);
      return;
    }
    setIsSubmitting(true);
    try {
      // Verify the phone number to get a booking token
      const verifyRes = await fetch("/api/booking/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: patientPhone }),
      });
      const verifyData = await verifyRes.json();
      const bookingToken = verifyData.token ?? "";

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-booking-token": bookingToken,
        },
        body: JSON.stringify({
          specialtyId: selectedDoctor?.specialtyId ?? "",
          doctorId: selectedDoctor?.id ?? "",
          serviceId: selectedService?.id ?? "",
          date: selectedDate,
          time: selectedTime,
          isFirstVisit: true,
          hasInsurance: false,
          patient: {
            name: patientName || patientPhone,
            phone: patientPhone,
          },
          slotDuration: clinicConfig.booking.slotDuration,
          bufferTime: clinicConfig.booking.bufferTime,
        }),
      });
      const data = await res.json();
      if (data.appointment?.id) {
        setBookingId(data.appointment.id);
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const manageUrl = bookingId ? `${siteUrl}/book?manage=${bookingId}` : "";

    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Rendez-vous confirmé !</h2>
          <p className="text-muted-foreground mb-4">
            Vous recevrez une confirmation par WhatsApp sous peu.
          </p>
          <div className="rounded-lg border p-4 max-w-sm mx-auto text-left text-sm space-y-1">
            {selectedService && (
              <p><span className="text-muted-foreground">Service :</span> {selectedService.name}</p>
            )}
            {selectedDoctor?.name && (
              <p><span className="text-muted-foreground">Médecin :</span> {selectedDoctor.name}</p>
            )}
            <p><span className="text-muted-foreground">Date :</span> {selectedDate}</p>
            <p><span className="text-muted-foreground">Heure :</span> {selectedTime}</p>
            {selectedService && (
              <>
                <p><span className="text-muted-foreground">Durée :</span> {selectedService.duration} min</p>
                <p><span className="text-muted-foreground">Prix :</span> {selectedService.price} {selectedService.currency}</p>
              </>
            )}
            <p><span className="text-muted-foreground">Téléphone :</span> {patientPhone}</p>
          </div>
          {manageUrl && (
            <p className="text-xs text-muted-foreground mt-3">
              <a href={manageUrl} className="text-primary underline">Gérer ou annuler votre rendez-vous</a>
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <MessageCircle className="h-4 w-4 text-green-600" />
            <span>Confirmation envoyée par WhatsApp</span>
          </div>
          <Button className="mt-6" onClick={() => {
            setSubmitted(false);
            setStep(0);
            setSelectedServiceKey("");
            setSelectedDate("");
            setSelectedTime("");
            setPatientPhone("");
            setPatientName("");
            setBookingId(null);
          }}>
            Prendre un autre rendez-vous
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prendre un rendez-vous</CardTitle>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-6 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">Étape {step + 1} : {STEPS[step]}</p>
      </CardHeader>
      <CardContent>
        {/* Step 1: Select Service (includes doctor) */}
        {step === 0 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground mb-2">
              Choisissez le service et le médecin :
            </p>
            {serviceOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setSelectedServiceKey(opt.key);
                  setSelectedDate("");
                  setSelectedTime("");
                }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedServiceKey === opt.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{opt.service.name}</p>
                    {opt.doctor.name && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Dr. {opt.doctor.name}
                          {opt.doctor.specialty && ` — ${opt.doctor.specialty}`}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.service.duration} min
                      {opt.service.description && ` · ${opt.service.description}`}
                    </p>
                  </div>
                  <Badge variant="outline">{opt.service.price} {opt.service.currency}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Sélectionnez une date disponible :</p>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(""); }}
              />
            </div>
            {selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Choisissez un créneau horaire :</p>
                <TimeSlotPicker
                  slots={availableSlots}
                  allSlots={allSlots}
                  slotCounts={slotCounts}
                  maxPerSlot={clinicConfig.booking.maxPerSlot}
                  selectedSlot={selectedTime}
                  onSelectSlot={setSelectedTime}
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm (phone number only — no account required) */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <h3 className="font-semibold text-base mb-3">Récapitulatif</h3>
              {selectedService && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{selectedService.name}</span>
                </div>
              )}
              {selectedDoctor?.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Médecin</span>
                  <span className="font-medium">{selectedDoctor.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Heure</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              {selectedService && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durée</span>
                    <span className="font-medium">{selectedService.duration} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix</span>
                    <span className="font-medium">{selectedService.price} {selectedService.currency}</span>
                  </div>
                </>
              )}
            </div>

            {/* Phone number — the only required field */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b-phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Numéro de téléphone *
                </Label>
                <Input
                  id="b-phone"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+212 6XX XX XX XX"
                  type="tel"
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Vous recevrez la confirmation par WhatsApp sur ce numéro.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-name">Nom (optionnel)</Label>
                <Input
                  id="b-name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Votre nom"
                />
              </div>
              {/* Honeypot field - hidden from real users, catches bots */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="b-website">Website</label>
                <input
                  id="b-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isSubmitting || !canNext()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? "Envoi en cours…" : "Confirmer le rendez-vous"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
