"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { t } from "@/lib/i18n";
import { useFormValidation, commonRules } from "@/lib/hooks/use-form-validation";
import { formatDisplayDate } from "@/lib/utils";

// Simplified 3-step booking flow
// Step 1: Select Service (with doctor)
// Step 2: Pick Date & Time
// Step 3: Confirm (phone number only, no account required)

const STEPS = ["Service", "Date & Heure", "Confirmation"];

/**
 * Validate Moroccan phone numbers.
 * Accepted formats: +212 6XXXXXXXX, +212 7XXXXXXXX, 06XXXXXXXX, 07XXXXXXXX
 * (with or without spaces/dashes).
 */
function isValidMoroccanPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-().]/g, "");
  return /^(?:\+212|0)[67]\d{8}$/.test(digits);
}

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
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  // Honeypot field for basic bot protection (invisible to real users)
  const [honeypot, setHoneypot] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Refs for focus management on step transitions (Issue 25)
  const stepHeadingRefs = useRef<(HTMLHeadingElement | null)[]>([null, null, null]);
  const stepAnnouncerRef = useRef<HTMLDivElement>(null);

  // Inline validation via useFormValidation hook
  const validationRules = useMemo(() => ({
    phone: [commonRules.required("Le numéro de téléphone est obligatoire"), commonRules.phone()],
  }), []);
  const { onFieldChange: onValidationChange, onFieldBlur: onValidationBlur, getFieldError } = useFormValidation<{ phone: string }>(validationRules);
  const [waitingListMessage, setWaitingListMessage] = useState<string | null>(null);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);

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

  // Move focus to the new step's heading on step transitions (Issue 25)
  const goToStep = useCallback((newStep: number) => {
    setStep(newStep);
    // Use requestAnimationFrame to wait for the new step content to render
    requestAnimationFrame(() => {
      stepHeadingRefs.current[newStep]?.focus();
    });
    // Announce step change to screen readers
    if (stepAnnouncerRef.current) {
      stepAnnouncerRef.current.textContent = `${STEPS[newStep]}, étape ${newStep + 1} sur ${STEPS.length}`;
    }
  }, []);

  const canNext = () => {
    if (step === 0) return !!selectedService && !!selectedDoctor;
    if (step === 1) return !!selectedDate && !!selectedTime;
    if (step === 2) return !!patientPhone.trim() && isValidMoroccanPhone(patientPhone) && confirmChecked;
    return true;
  };

  const handleJoinWaitingList = async (slot: string) => {
    // Require a valid phone before joining the waiting list (Issue 17)
    if (!patientPhone.trim() || !isValidMoroccanPhone(patientPhone)) {
      setWaitingListMessage("Veuillez saisir un numéro de téléphone valide avant de rejoindre la liste d\u2019attente.");
      return;
    }
    // Prevent double-clicks while request is in-flight (Issue 51)
    if (isJoiningWaitlist) return;
    setIsJoiningWaitlist(true);
    try {
      const res = await fetch("/api/booking/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientPhone: patientPhone,
          patientName: patientName || "Patient",
          doctorId: selectedDoctor,
          preferredDate: selectedDate,
          preferredTime: slot,
          serviceId: selectedService,
          website: honeypot,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWaitingListMessage(`Vous avez \u00e9t\u00e9 ajout\u00e9(e) \u00e0 la liste d'attente pour le ${selectedDate} \u00e0 ${slot}.`);
      } else {
        setWaitingListMessage(data.error ?? "Impossible de rejoindre la liste d'attente.");
      }
    } catch (err) {
      logger.warn("Failed to join waiting list", { context: "booking-form", error: err });
      setWaitingListMessage("Impossible de rejoindre la liste d'attente.");
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  // Idempotency key to prevent duplicate bookings from double-clicks or
  // network retries. Generated once per confirm attempt.
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    // Honeypot check: if the hidden field was filled, silently reject
    if (honeypot) {
      setSubmitted(true);
      return;
    }
    setIsSubmitting(true);
    setBookingError(null);

    // Generate a unique idempotency key for this submission attempt
    idempotencyKeyRef.current = crypto.randomUUID();
    const idempotencyKey = idempotencyKeyRef.current;

    try {
      // Unified progress: verify phone + create booking in one flow (Issue 3).
      // The verify endpoint issues an HMAC token (no OTP) so we present
      // a single "Confirmation en cours..." status to the user.
      setVerificationStatus("Confirmation en cours...");
      const verifyRes = await fetch("/api/booking/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: patientPhone }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        const errorMsg =
          verifyRes.status === 503
            ? "Service temporairement indisponible. Veuillez r\u00e9essayer."
            : verifyRes.status === 404
              ? "Ce num\u00e9ro n\u2019est pas enregistr\u00e9."
              : verifyData.error ?? "Erreur de connexion, veuillez r\u00e9essayer.";
        setBookingError(errorMsg);
        setVerificationStatus(null);
        return;
      }
      const bookingToken = verifyData.token as string;
      const specialtyId = doctor?.specialtyId ?? "";

      const res = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-booking-token": bookingToken,
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          specialtyId,
          doctorId: selectedDoctor,
          serviceId: selectedService,
          date: selectedDate,
          time: selectedTime,
          isFirstVisit,
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
        const serverMsg = data.error as string | undefined;
        setBookingError(
          serverMsg?.includes("slot")
            ? "Ce cr\u00e9neau n\u2019est plus disponible. Veuillez en choisir un autre."
            : serverMsg ?? "Erreur lors de la r\u00e9servation. Veuillez r\u00e9essayer.",
        );
        return;
      }
      if (data.appointment?.id) {
        setBookingId(data.appointment.id);
      }
      setSubmitted(true);
    } catch (err) {
      logger.warn("Booking confirmation failed", { context: "booking-form", error: err });
      setBookingError("Erreur de connexion. Veuillez r\u00e9essayer.");
    } finally {
      setIsSubmitting(false);
      setVerificationStatus(null);
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
            <p><span className="text-muted-foreground">Date :</span> {formatDisplayDate(selectedDate, "fr", "long")}</p>
            <p><span className="text-muted-foreground">Heure :</span> {selectedTime}</p>
            <p><span className="text-muted-foreground">Dur\u00e9e :</span> {service?.duration ?? "—"} min</p>
            <p><span className="text-muted-foreground">Prix :</span> {service?.price ?? "—"} {service?.currency ?? ""}</p>
          </div>

          {manageUrl && (
            <div className="mt-4">
              <a
                href={manageUrl}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                G\u00e9rer mon rendez-vous
              </a>
            </div>
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
            setIsFirstVisit(true);
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
        {/* Screen reader announcer for step changes (Issue 25) */}
        <div ref={stepAnnouncerRef} className="sr-only" aria-live="assertive" aria-atomic="true" />

        {/* Step 1: Select Service (with doctor) */}
        {step === 0 && (
          <div className="space-y-6" role="tabpanel" aria-labelledby="step-heading-0">
            {/* Select doctor */}
            <div>
              <p id="step-heading-0" ref={(el) => { stepHeadingRefs.current[0] = el; }} tabIndex={-1} className="text-sm font-medium mb-3 flex items-center gap-2 outline-none">
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
          <div className="space-y-6" role="tabpanel" aria-labelledby="step-heading-1">
            <div>
              <p id="step-heading-1" ref={(el) => { stepHeadingRefs.current[1] = el; }} tabIndex={-1} className="text-sm text-muted-foreground mb-3 flex items-center gap-2 outline-none">
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
                <p>{formatDisplayDate(selectedDate, "fr", "long")} \u00e0 {selectedTime} \u00b7 {service?.duration ?? "—"} min</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirm (phone only) */}
        {step === 2 && (
          <div className="space-y-6" role="tabpanel" aria-labelledby="step-heading-2">
            {/* Booking summary */}
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <h3 id="step-heading-2" ref={(el) => { stepHeadingRefs.current[2] = el; }} tabIndex={-1} className="font-semibold text-base mb-3 outline-none">R\u00e9capitulatif</h3>
              <div className="grid gap-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-medium">{service?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">M\u00e9decin</span><span className="font-medium">{doctor?.name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sp\u00e9cialit\u00e9</span><span className="font-medium">{doctor?.specialty ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{formatDisplayDate(selectedDate, "fr", "long")}</span></div>
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
                  onChange={(e) => {
                    setPatientPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                    onValidationChange("phone", e.target.value);
                  }}
                  onBlur={() => {
                    onValidationBlur("phone", patientPhone);
                    if (patientPhone.trim() && !isValidMoroccanPhone(patientPhone)) {
                      setPhoneError(t("fr", "booking.invalidPhone"));
                    }
                  }}
                  placeholder="+212 6XX XX XX XX"
                  type="tel"
                  required
                  autoFocus
                  className={phoneError ? "border-destructive" : ""}
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                />
                {(phoneError || getFieldError("phone")) ? (
                  <p id="phone-error" className="text-xs text-destructive">{phoneError || getFieldError("phone")}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Vous recevrez la confirmation par WhatsApp. Aucun compte requis.
                  </p>
                )}
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

              {/* First visit toggle (Issue 49) */}
              <div className="flex items-center gap-3">
                <input
                  id="b-first-visit"
                  type="checkbox"
                  checked={isFirstVisit}
                  onChange={(e) => setIsFirstVisit(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="b-first-visit" className="text-sm cursor-pointer">
                  {t("fr", "booking.isFirstVisit")}
                </Label>
              </div>

              {/* Confirmation checkbox (Issue 18) */}
              <div className="flex items-start gap-3">
                <input
                  id="b-confirm"
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="b-confirm" className="text-sm cursor-pointer leading-snug">
                  Je confirme que ces informations sont correctes
                </Label>
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
            onClick={() => goToStep(step - 1)}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("fr", "action.back")}
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => goToStep(step + 1)}
              disabled={!canNext()}
            >
              {t("fr", "booking.next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isSubmitting || !canNext()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting
                ? (verificationStatus ?? t("fr", "booking.submitting"))
                : t("fr", "booking.confirm")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
