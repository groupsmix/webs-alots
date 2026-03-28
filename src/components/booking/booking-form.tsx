"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Stethoscope, User, Clock, Phone, Loader2, MessageCircle } from "lucide-react";
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

// Simplified 3-step booking flow
// Step 1: Select Service (with doctor)
// Step 2: Pick Date & Time
// Step 3: Confirm (phone number only, no account required)

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
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  // Simplified patient info: phone only required for first booking
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  // Honeypot field for basic bot protection (invisible to real users)
  const [honeypot, setHoneypot] = useState("");
  const [waitingListMessage, setWaitingListMessage] = useState<string | null>(null);

  // Supabase-loaded data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    Promise.all([
      fetchDoctors(clinicId),
      fetchServices(clinicId),
    ]).then(([dbDoctors, dbServices]) => {
      if (cancelled) return;
      setDoctors(dbDoctors.map(mapDoctor));
      setServices(dbServices.map(mapService));
      setLoading(false);
    }).catch((err) => {
      logger.warn("Operation failed", { context: "booking-form", error: err });
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tenant?.clinicId]);

  // Fetch available slots when date or doctor changes
  useEffect(() => {
    if (!selectedDate || !selectedDoctor) return;

    let cancelled = false;

    fetch(`/api/booking?date=${selectedDate}&doctorId=${selectedDoctor}`)
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
  }, [selectedDate, selectedDoctor]);

  // Derive slot arrays
  const availableSlots = (selectedDate && selectedDoctor) ? slotData.available : [];
  const allSlots = (selectedDate && selectedDoctor) ? slotData.all : [];
  const slotCounts = (selectedDate && selectedDoctor) ? slotData.counts : {};

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  const doctor = doctors.find((d) => d.id === selectedDoctor);
  const service = services.find((s) => s.id === selectedService);

  const canNext = () => {
    if (step === 0) return !!selectedService && !!selectedDoctor;
    if (step === 1) return !!selectedDate && !!selectedTime;
    if (step === 2) return !!patientPhone.trim() && patientPhone.trim().length >= 6;
    return true;
  };

  const handleJoinWaitingList = async (slot: string) => {
    try {
      const res = await fetch("/api/booking/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: `patient-${Date.now()}`,
          patientName: patientName || "Patient",
          doctorId: selectedDoctor,
          preferredDate: selectedDate,
          preferredTime: slot,
          serviceId: selectedService,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitingListMessage(`Vous avez \u00e9t\u00e9 ajout\u00e9(e) \u00e0 la liste d'attente pour le ${selectedDate} \u00e0 ${slot}.`);
      } else {
        setWaitingListMessage(data.error ?? "Impossible de rejoindre la liste d'attente.");
      }
    } catch {
      setWaitingListMessage("Impossible de rejoindre la liste d'attente.");
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    // Honeypot check: if the hidden field was filled, silently reject
    if (honeypot) {
      setSubmitted(true);
      return;
    }
    setIsSubmitting(true);
    setBookingError(null);
    try {
      // Step 1: Get booking token (phone verification)
      const verifyRes = await fetch("/api/booking/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: patientPhone }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setBookingError(verifyData.error ?? "Erreur de v\u00e9rification. Veuillez r\u00e9essayer.");
        return;
      }
      const bookingToken = verifyData.token as string;

      // Step 2: Create booking with the token
      const specialtyId = doctor?.specialtyId ?? "";

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-booking-token": bookingToken,
        },
        body: JSON.stringify({
          specialtyId,
          doctorId: selectedDoctor,
          serviceId: selectedService,
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
      if (!res.ok) {
        setBookingError(data.error ?? "Erreur lors de la r\u00e9servation. Veuillez r\u00e9essayer.");
        return;
      }
      if (data.appointment?.id) {
        setBookingId(data.appointment.id);
      }
      setSubmitted(true);
    } catch {
      setBookingError("Erreur de connexion. Veuillez r\u00e9essayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen
  if (submitted) {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const manageUrl = bookingId ? `${baseUrl}/book/manage?id=${bookingId}` : "";

    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Rendez-vous confirm\u00e9 !</h2>
          <p className="text-muted-foreground mb-4">
            Vous recevrez une confirmation par WhatsApp au {patientPhone}.
          </p>

          <div className="rounded-lg border p-4 max-w-sm mx-auto text-left text-sm space-y-1">
            <p><span className="text-muted-foreground">Service :</span> {service?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">M\u00e9decin :</span> {doctor?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">Date :</span> {selectedDate}</p>
            <p><span className="text-muted-foreground">Heure :</span> {selectedTime}</p>
            <p><span className="text-muted-foreground">Dur\u00e9e :</span> {service?.duration ?? "—"} min</p>
            <p><span className="text-muted-foreground">Prix :</span> {service?.price ?? "—"} {service?.currency ?? ""}</p>
          </div>

          {manageUrl && (
            <p className="text-xs text-muted-foreground mt-4">
              G\u00e9rer ou annuler votre rendez-vous :{" "}
              <a href={manageUrl} className="text-primary underline">{manageUrl}</a>
            </p>
          )}

          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Confirmation WhatsApp envoy\u00e9e avec les d\u00e9tails</span>
          </div>

          <Button className="mt-6" onClick={() => {
            setSubmitted(false);
            setStep(0);
            setSelectedDoctor("");
            setSelectedService("");
            setSelectedDate("");
            setSelectedTime("");
            setPatientPhone("");
            setPatientName("");
            setBookingId(null);
            setBookingError(null);
            setWaitingListMessage(null);
          }}>
            Prendre un autre rendez-vous
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Chargement des services\u2026</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prendre un rendez-vous</CardTitle>
        {/* 3-step indicator */}
        <div className="flex items-center gap-1 mt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shrink-0 ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs ml-2 hidden sm:block ${i <= step ? "font-medium" : "text-muted-foreground"}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step 1: Select Service (with doctor) */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Select doctor */}
            <div>
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Choisissez votre m\u00e9decin :
              </p>
              <div className="grid gap-2">
                {doctors.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDoctor(d.id); setSelectedService(""); }}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selectedDoctor === d.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.specialty}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{d.consultationFee} MAD</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Select service */}
            {selectedDoctor && (
              <div>
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  Choisissez le service :
                </p>
                <div className="grid gap-2">
                  {activeServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s.id)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedService === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.description} \u00b7 {s.duration} min
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{s.price} {s.currency}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pick Date & Time */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                S\u00e9lectionnez une date et un cr\u00e9neau :
              </p>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(""); }}
              />
            </div>
            {selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Cr\u00e9neaux disponibles :</p>
                <TimeSlotPicker
                  slots={availableSlots}
                  allSlots={allSlots}
                  slotCounts={slotCounts}
                  maxPerSlot={clinicConfig.booking.maxPerSlot}
                  selectedSlot={selectedTime}
                  onSelectSlot={setSelectedTime}
                  showWaitingList={clinicConfig.features.waitingList}
                  onJoinWaitingList={handleJoinWaitingList}
                />
                {waitingListMessage && (
                  <p className="text-sm text-primary mt-2">{waitingListMessage}</p>
                )}
              </div>
            )}

            {/* Selected summary */}
            {selectedDate && selectedTime && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">R\u00e9sum\u00e9</p>
                <p>{service?.name ?? "—"} avec {doctor?.name ?? "—"}</p>
                <p>{selectedDate} \u00e0 {selectedTime} \u00b7 {service?.duration ?? "—"} min</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm (phone only) */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Booking summary */}
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <h3 className="font-semibold text-base mb-3">R\u00e9capitulatif</h3>
              <div className="grid gap-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-medium">{service?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">M\u00e9decin</span><span className="font-medium">{doctor?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sp\u00e9cialit\u00e9</span><span className="font-medium">{doctor?.specialty ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedDate}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Heure</span><span className="font-medium">{selectedTime}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dur\u00e9e</span><span className="font-medium">{service?.duration ?? "—"} min</span></div>
                <hr />
                <div className="flex justify-between font-medium"><span>Prix</span><span>{service?.price ?? "—"} {service?.currency ?? ""}</span></div>
              </div>
            </div>

            {/* Phone number - the only required field */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b-phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Num\u00e9ro de t\u00e9l\u00e9phone *
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
                  Vous recevrez la confirmation par WhatsApp. Aucun compte requis.
                </p>
              </div>

              {/* Optional name */}
              <div className="space-y-2">
                <Label htmlFor="b-name" className="text-sm">Nom (optionnel)</Label>
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

            {/* Error message */}
            {bookingError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {bookingError}
              </div>
            )}

            {/* WhatsApp note */}
            <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-800">
              <MessageCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Apr\u00e8s confirmation, vous recevrez un message WhatsApp avec les d\u00e9tails du rendez-vous,
                le nom du m\u00e9decin, l&apos;adresse du cabinet et un lien pour g\u00e9rer ou annuler votre rendez-vous.
              </span>
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
              {isSubmitting ? "Envoi en cours\u2026" : "Confirmer le rendez-vous"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
