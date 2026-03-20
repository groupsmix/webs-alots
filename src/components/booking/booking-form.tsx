"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Stethoscope, User, ShieldCheck } from "lucide-react";
import { specialties, doctors, services, getAvailableSlots, generateTimeSlots, getSlotBookingCounts, getDoctorsBySpecialty } from "@/lib/demo-data";
import { clinicConfig } from "@/config/clinic.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "./calendar";
import { TimeSlotPicker } from "./time-slots";

const steps = ["Specialty", "Doctor", "Service", "Date & Time", "Your Info", "Confirm"];

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isInsurance, setIsInsurance] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [patientInfo, setPatientInfo] = useState({ name: "", phone: "", email: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);

  const filteredDoctors = useMemo(() => {
    if (!selectedSpecialty) return doctors;
    return getDoctorsBySpecialty(selectedSpecialty);
  }, [selectedSpecialty]);

  const availableSlots = selectedDate && selectedDoctor
    ? getAvailableSlots(selectedDate, selectedDoctor)
    : [];

  const allSlots = selectedDate ? generateTimeSlots(selectedDate) : [];

  const slotCounts = selectedDate && selectedDoctor
    ? getSlotBookingCounts(selectedDate, selectedDoctor)
    : {};

  const doctor = doctors.find((d) => d.id === selectedDoctor);
  const service = services.find((s) => s.id === selectedService);
  const specialty = specialties.find((s) => s.id === selectedSpecialty);

  const canNext = () => {
    if (step === 0) return !!selectedSpecialty;
    if (step === 1) return !!selectedDoctor;
    if (step === 2) return !!selectedService;
    if (step === 3) return !!selectedDate && !!selectedTime;
    if (step === 4) return !!patientInfo.name && !!patientInfo.phone;
    return true;
  };

  const handleConfirm = async () => {
    try {
      await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialtyId: selectedSpecialty,
          doctorId: selectedDoctor,
          serviceId: selectedService,
          date: selectedDate,
          time: selectedTime,
          isFirstVisit,
          hasInsurance: isInsurance,
          patient: patientInfo,
          slotDuration: clinicConfig.booking.slotDuration,
          bufferTime: clinicConfig.booking.bufferTime,
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground mb-4">
            Your appointment has been scheduled. You will receive a WhatsApp confirmation shortly.
          </p>
          <div className="rounded-lg border p-4 max-w-sm mx-auto text-left text-sm space-y-1">
            <p><span className="text-muted-foreground">Specialty:</span> {specialty?.name}</p>
            <p><span className="text-muted-foreground">Doctor:</span> {doctor?.name}</p>
            <p><span className="text-muted-foreground">Service:</span> {service?.name}</p>
            <p><span className="text-muted-foreground">Date:</span> {selectedDate}</p>
            <p><span className="text-muted-foreground">Time:</span> {selectedTime}</p>
            <p><span className="text-muted-foreground">Duration:</span> {service?.duration} min</p>
            <p><span className="text-muted-foreground">Price:</span> {service?.price} {service?.currency}</p>
            {isInsurance && <p><span className="text-muted-foreground">Insurance:</span> Yes</p>}
            <p><span className="text-muted-foreground">Visit Type:</span> {isFirstVisit ? "First Visit" : "Return Visit"}</p>
          </div>
          <Button className="mt-6" onClick={() => {
            setSubmitted(false);
            setStep(0);
            setSelectedSpecialty("");
            setSelectedDoctor("");
            setSelectedService("");
            setSelectedDate("");
            setSelectedTime("");
            setPatientInfo({ name: "", phone: "", email: "", reason: "" });
            setIsFirstVisit(true);
            setIsInsurance(false);
          }}>
            Book Another Appointment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book an Appointment</CardTitle>
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-4">
          {steps.map((s, i) => (
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
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-6 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">Step {step + 1}: {steps[step]}</p>
      </CardHeader>
      <CardContent>
        {/* Step 0: Select Specialty */}
        {step === 0 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground mb-2">Choose the medical specialty for your visit:</p>
            {specialties.map((sp) => (
              <button
                key={sp.id}
                onClick={() => { setSelectedSpecialty(sp.id); setSelectedDoctor(""); }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedSpecialty === sp.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{sp.name}</p>
                    <p className="text-sm text-muted-foreground">{sp.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Select Doctor */}
        {step === 1 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground mb-2">
              Select your preferred doctor{specialty ? ` in ${specialty.name}` : ""}:
            </p>
            {filteredDoctors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDoctor(d.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedDoctor === d.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-sm text-muted-foreground">{d.specialty}</p>
                    <p className="text-xs text-muted-foreground">{d.languages.join(", ")}</p>
                  </div>
                  <Badge variant="outline">{d.consultationFee} MAD</Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select Service */}
        {step === 2 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground mb-2">Choose the service you need:</p>
            {services.filter((s) => s.active).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedService(s.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedService === s.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.name}</p>
                  <Badge variant="outline">{s.price} {s.currency}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {s.description} &middot; {s.duration} min
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Step 3: Select Date & Time */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Select an available date (unavailable days are greyed out):</p>
              <BookingCalendar
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(""); }}
              />
            </div>
            {selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Choose an available time slot:</p>
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

        {/* Step 4: Patient Info */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-name">Full Name *</Label>
              <Input
                id="b-name"
                value={patientInfo.name}
                onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-phone">Phone Number *</Label>
              <Input
                id="b-phone"
                value={patientInfo.phone}
                onChange={(e) => setPatientInfo({ ...patientInfo, phone: e.target.value })}
                placeholder="+212 6XX XX XX XX"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-email">Email (optional)</Label>
              <Input
                id="b-email"
                value={patientInfo.email}
                onChange={(e) => setPatientInfo({ ...patientInfo, email: e.target.value })}
                type="email"
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-reason">Reason for Visit</Label>
              <Input
                id="b-reason"
                value={patientInfo.reason}
                onChange={(e) => setPatientInfo({ ...patientInfo, reason: e.target.value })}
                placeholder="Brief description of your concern"
              />
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">Visit Type</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsFirstVisit(true)}
                  className={`rounded-lg border p-3 text-center text-sm transition-colors ${isFirstVisit ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"}`}
                >
                  <User className="h-5 w-5 mx-auto mb-1 text-primary" />
                  First Visit
                </button>
                <button
                  onClick={() => setIsFirstVisit(false)}
                  className={`rounded-lg border p-3 text-center text-sm transition-colors ${!isFirstVisit ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted/50"}`}
                >
                  <Check className="h-5 w-5 mx-auto mb-1 text-primary" />
                  Return Visit
                </button>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isInsurance ? "bg-green-100" : "bg-muted"}`}>
                  <ShieldCheck className={`h-5 w-5 ${isInsurance ? "text-green-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Insurance Coverage</p>
                  <p className="text-xs text-muted-foreground">Check if you will use insurance (CNSS, CNOPS, etc.)</p>
                </div>
                <input
                  type="checkbox"
                  checked={isInsurance}
                  onChange={(e) => setIsInsurance(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300"
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <div className="rounded-lg border p-6 space-y-3 text-sm">
            <h3 className="font-semibold text-base mb-4">Review Your Booking</h3>
            <div className="grid gap-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Specialty</span><span className="font-medium">{specialty?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{doctor?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-medium">{service?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{selectedTime}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium">{service?.duration} min</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Buffer Time</span><span className="font-medium">{clinicConfig.booking.bufferTime} min</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{service?.price} {service?.currency}</span></div>
              <hr />
              <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{patientInfo.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{patientInfo.phone}</span></div>
              {patientInfo.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{patientInfo.email}</span></div>}
              {patientInfo.reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="font-medium">{patientInfo.reason}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Visit Type</span><Badge variant={isFirstVisit ? "default" : "secondary"}>{isFirstVisit ? "First Visit" : "Return Visit"}</Badge></div>
              {isInsurance && <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><Badge variant="success">Covered</Badge></div>}
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
            Back
          </Button>
          {step < 5 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleConfirm}>
              Confirm Booking
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
