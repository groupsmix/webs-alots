"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Phone, CheckCircle, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "@/components/tenant-provider";

type KioskStep = "phone" | "appointments" | "confirming" | "confirmed" | "not-found" | "disabled";

interface AppointmentInfo {
  id: string;
  doctorName: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
}

interface CheckInResult {
  queuePosition: number;
  estimatedWait: number;
}

export default function CheckInKioskPage() {
  const tenant = useTenant();
  const [step, setStep] = useState<KioskStep>("phone");
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState<AppointmentInfo[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentInfo | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [kioskEnabled, setKioskEnabled] = useState<boolean | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clinicId = tenant?.clinicId;

  // Check if kiosk mode is enabled
  useEffect(() => {
    if (!clinicId) return;
    async function checkKioskMode() {
      try {
        const res = await fetch(`/api/checkin/status?clinicId=${clinicId}`);
        const json = await res.json();
        setKioskEnabled(json.data?.enabled ?? false);
      } catch {
        setKioskEnabled(false);
      }
    }
    checkKioskMode();
  }, [clinicId]);

  // Auto-reset after 10 seconds of inactivity on confirmation screen
  const resetKiosk = useCallback(() => {
    setStep("phone");
    setPhone("");
    setAppointments([]);
    setSelectedAppointment(null);
    setCheckInResult(null);
  }, []);

  useEffect(() => {
    if (step === "confirmed") {
      inactivityTimer.current = setTimeout(resetKiosk, 10_000);
      return () => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    }
  }, [step, resetKiosk]);

  // Reset inactivity timer on any interaction
  const handleInteraction = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (step === "confirmed") {
      inactivityTimer.current = setTimeout(resetKiosk, 10_000);
    }
  }, [step, resetKiosk]);

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 8 || !clinicId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/checkin/lookup?phone=${encodeURIComponent(phone)}&clinicId=${clinicId}`);
      const json = await res.json();
      if (json.ok && json.data?.appointments?.length > 0) {
        setAppointments(json.data.appointments);
        setStep("appointments");
      } else {
        setStep("not-found");
      }
    } catch {
      setStep("not-found");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (appointment: AppointmentInfo) => {
    if (!clinicId) return;
    setSelectedAppointment(appointment);
    setStep("confirming");
    setLoading(true);
    try {
      const res = await fetch("/api/checkin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          clinicId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setCheckInResult({
          queuePosition: json.data.queuePosition,
          estimatedWait: json.data.estimatedWait,
        });
        setStep("confirmed");
      } else {
        setStep("not-found");
      }
    } catch {
      setStep("not-found");
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (phone.length < 15) {
      setPhone((p) => p + digit);
    }
  };

  const handleBackspace = () => {
    setPhone((p) => p.slice(0, -1));
  };

  if (kioskEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (kioskEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Self Check-In</h1>
            <p className="text-muted-foreground">
              Self check-in is not currently available at this clinic.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <div className="w-full max-w-lg">
        {/* Clinic Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {tenant?.clinicName ?? "Clinic"}
          </h1>
          <p className="text-lg text-gray-600 mt-1">Self Check-In</p>
        </div>

        {/* Phone Input Step */}
        {step === "phone" && (
          <Card className="shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <Phone className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <h2 className="text-2xl font-semibold">Enter Your Phone Number</h2>
                <p className="text-muted-foreground mt-1">We&apos;ll find your appointment</p>
              </div>

              {/* Phone Display */}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-6 min-h-[60px] flex items-center justify-center">
                <span className="text-3xl font-mono tracking-widest">
                  {phone || "Enter phone..."}
                </span>
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "del"].map((key) => (
                  <Button
                    key={key}
                    variant={key === "del" ? "outline" : "secondary"}
                    className="h-16 text-2xl font-semibold rounded-xl"
                    onClick={() => {
                      if (key === "del") handleBackspace();
                      else handleDigit(key);
                    }}
                  >
                    {key === "del" ? "⌫" : key}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full h-16 text-xl font-semibold rounded-xl"
                onClick={handlePhoneSubmit}
                disabled={phone.length < 8 || loading}
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                ) : null}
                Find My Appointment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Appointments List Step */}
        {step === "appointments" && (
          <Card className="shadow-xl">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetKiosk}
                  className="rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-2xl font-semibold">Your Appointments Today</h2>
              </div>

              <div className="space-y-4">
                {appointments.map((appt) => (
                  <Card key={appt.id} className="border-2 hover:border-blue-400 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold">{appt.serviceName}</p>
                          <p className="text-muted-foreground">
                            Dr. {appt.doctorName} &bull; {appt.time}
                          </p>
                        </div>
                        <Button
                          size="lg"
                          className="h-14 px-8 text-lg font-semibold rounded-xl bg-green-600 hover:bg-green-700"
                          onClick={() => handleCheckIn(appt)}
                        >
                          I&apos;m Here
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirming Step */}
        {step === "confirming" && (
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold">Checking you in...</h2>
              <p className="text-muted-foreground mt-2">
                {selectedAppointment?.serviceName} with Dr. {selectedAppointment?.doctorName}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Confirmed Step */}
        {step === "confirmed" && checkInResult && (
          <Card className="shadow-xl border-2 border-green-400">
            <CardContent className="p-12 text-center">
              <CheckCircle className="h-20 w-20 text-green-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-green-700 mb-2">
                You&apos;re Checked In!
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                {selectedAppointment?.serviceName} with Dr. {selectedAppointment?.doctorName}
              </p>

              <div className="bg-blue-50 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-6 w-6 text-blue-600" />
                  <span className="text-lg font-medium text-blue-800">Queue Position</span>
                </div>
                <p className="text-5xl font-bold text-blue-600 mb-1">
                  #{checkInResult.queuePosition}
                </p>
                <p className="text-lg text-blue-700">
                  Estimated wait: ~{checkInResult.estimatedWait} minutes
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Please have a seat. We&apos;ll call you shortly.
              </p>

              {/* Auto-reset progress bar */}
              <div className="mt-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full animate-[shrink_10s_linear_forwards]"
                  style={{ width: "100%" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Screen resets automatically...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Not Found Step */}
        {step === "not-found" && (
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-2xl font-semibold mb-2">No Appointments Found</h2>
              <p className="text-muted-foreground mb-6">
                We couldn&apos;t find any appointments for today with that phone number.
              </p>
              <Button
                className="h-14 px-8 text-lg font-semibold rounded-xl"
                onClick={resetKiosk}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
