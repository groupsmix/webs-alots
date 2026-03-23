"use client";

import { useState, useEffect } from "react";
import { Phone, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentUser,
  fetchDoctors,
  fetchServices,
  fetchPatients,
  type DoctorView,
  type ServiceView,
  type PatientView,
} from "@/lib/data/client";

interface ManualBookingDialogProps {
  trigger?: React.ReactNode;
  onBook?: (booking: {
    patientId: string;
    doctorId: string;
    serviceId: string;
    date: string;
    time: string;
    notes: string;
    source: "phone" | "walk_in";
  }) => void;
}

export function ManualBookingDialog({ trigger, onBook }: ManualBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorView[]>([]);
  const [services, setServices] = useState<ServiceView[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const user = await getCurrentUser();
      if (controller.signal.aborted) return;
      if (!user?.clinic_id) return;
      const [docs, svcs, pts] = await Promise.all([
        fetchDoctors(user.clinic_id),
        fetchServices(user.clinic_id),
        fetchPatients(user.clinic_id),
      ]);
      if (controller.signal.aborted) return;
      setDoctors(docs);
      setServices(svcs);
      setPatients(pts);
    }
    load().catch(() => {
      // Data loading errors are non-fatal for dialog pre-population
    });
    return () => { controller.abort(); };
  }, []);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<"phone" | "walk_in">("phone");

  const timeSlots = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  ];

  const handleSubmit = () => {
    if (!patientId || !doctorId || !serviceId || !date || !time) return;
    onBook?.({ patientId, doctorId, serviceId, date, time, notes, source });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setServiceId("");
    setDate(new Date().toISOString().split("T")[0]);
    setTime("");
    setNotes("");
    setSource("phone");
  };

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Phone className="h-4 w-4 mr-1" />
            Manual Booking
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]" onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Manual Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Booking Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "phone" | "walk_in")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor..." />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.specialty ? ` - ${d.specialty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.filter((s) => s.active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration}min - {s.price} {s.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!patientId || !doctorId || !serviceId || !date || !time}>
              Book Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
