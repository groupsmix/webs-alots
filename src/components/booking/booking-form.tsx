"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { doctors, services, getAvailableSlots } from "@/lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "./calendar";
import { TimeSlotPicker } from "./time-slots";

const steps = ["Doctor", "Service", "Date & Time", "Your Info", "Confirm"];

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isInsurance, setIsInsurance] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [patientInfo, setPatientInfo] = useState({ name: "", phone: "", email: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);

  const availableSlots = selectedDate && selectedDoctor
    ? getAvailableSlots(selectedDate, selectedDoctor)
    : [];

  const doctor = doctors.find((d) => d.id === selectedDoctor);
  const service = services.find((s) => s.id === selectedService);

  const canNext = () => {
    if (step === 0) return !!selectedDoctor;
    if (step === 1) return !!selectedService;
    if (step === 2) return !!selectedDate && !!selectedTime;
    if (step === 3) return !!patientInfo.name && !!patientInfo.phone;
    return true;
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
            <p><span className="text-muted-foreground">Doctor:</span> {doctor?.name}</p>
            <p><span className="text-muted-foreground">Service:</span> {service?.name}</p>
            <p><span className="text-muted-foreground">Date:</span> {selectedDate}</p>
            <p><span className="text-muted-foreground">Time:</span> {selectedTime}</p>
          </div>
          <Button className="mt-6" onClick={() => { setSubmitted(false); setStep(0); }}>
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
        {/* Step 0: Select Doctor */}
        {step === 0 && (
          <div className="grid gap-3">
            {doctors.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDoctor(d.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedDoctor === d.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-muted-foreground">{d.specialty}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Select Service */}
        {step === 1 && (
          <div className="grid gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedService(s.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedService === s.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
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

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="space-y-6">
            <BookingCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => { setSelectedDate(date); setSelectedTime(""); }}
            />
            {selectedDate && (
              <TimeSlotPicker
                slots={availableSlots}
                selectedSlot={selectedTime}
                onSelectSlot={setSelectedTime}
              />
            )}
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="b-name">Full Name</Label>
              <Input
                id="b-name"
                value={patientInfo.name}
                onChange={(e) => setPatientInfo({ ...patientInfo, name: e.target.value })}
                placeholder="Your full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-phone">Phone Number</Label>
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
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInsurance}
                  onChange={(e) => setIsInsurance(e.target.checked)}
                  className="rounded"
                />
                Using insurance
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isFirstVisit}
                  onChange={(e) => setIsFirstVisit(e.target.checked)}
                  className="rounded"
                />
                First visit
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="rounded-lg border p-6 space-y-3 text-sm">
            <h3 className="font-semibold text-base mb-4">Review Your Booking</h3>
            <div className="grid gap-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{doctor?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="font-medium">{service?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{selectedDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{selectedTime}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium">{service?.duration} min</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-medium">{service?.price} {service?.currency}</span></div>
              <hr />
              <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{patientInfo.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{patientInfo.phone}</span></div>
              {isInsurance && <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><Badge variant="success">Yes</Badge></div>}
              {isFirstVisit && <div className="flex justify-between"><span className="text-muted-foreground">Visit Type</span><Badge>First Visit</Badge></div>}
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
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setSubmitted(true)}>
              Confirm Booking
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
