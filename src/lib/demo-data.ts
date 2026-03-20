/**
 * Demo / mock data for the Health SaaS platform.
 * Used across all dashboards until Supabase is wired up.
 */

// ---------- Types ----------

export interface Specialty {
  id: string;
  name: string;
  description: string;
}

export interface Doctor {
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

export interface Service {
  id: string;
  name: string;
  description: string;
  duration: number; // minutes
  price: number;
  currency: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number;
  gender: "M" | "F";
  dateOfBirth: string;
  allergies?: string[];
  insurance?: string;
  registeredAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string;
  time: string;
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "no-show" | "cancelled" | "rescheduled";
  isFirstVisit: boolean;
  hasInsurance: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  rescheduledFrom?: string;
  isEmergency?: boolean;
  recurrenceGroupId?: string;
  recurrencePattern?: "weekly" | "biweekly" | "monthly";
  recurrenceIndex?: number;
  doctorIds?: string[];
}

export interface WaitingListEntry {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  preferredDate: string;
  preferredTime?: string;
  serviceId?: string;
  serviceName?: string;
  status: "waiting" | "notified" | "booked" | "expired";
  createdAt: string;
}

export interface EmergencySlot {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isBooked: boolean;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  amount: number;
  currency: string;
  method: "cash" | "card" | "online" | "insurance";
  status: "pending" | "completed" | "refunded" | "failed";
  paymentType: "deposit" | "full";
  gatewaySessionId?: string;
  refundedAmount: number;
  createdAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
  notes?: string;
}

export interface Review {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  date: string;
  replied: boolean;
}

export interface Invoice {
  id: string;
  patientName: string;
  amount: number;
  currency: string;
  method: "cash" | "card" | "insurance";
  status: "paid" | "pending" | "overdue";
  date: string;
}

export interface Clinic {
  id: string;
  name: string;
  type: "doctor" | "dentist" | "pharmacy";
  plan: string;
  city: string;
  patientsCount: number;
  monthlyRevenue: number;
  status: "active" | "suspended" | "trial";
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

// ---------- Data ----------

export const specialties: Specialty[] = [
  { id: "sp1", name: "General Medicine", description: "Primary care and general health consultations" },
  { id: "sp2", name: "Pediatrics", description: "Medical care for children and infants" },
  { id: "sp3", name: "Cardiology", description: "Heart and cardiovascular system care" },
];

export const doctors: Doctor[] = [
  { id: "d1", name: "Dr. Ahmed Benali", specialtyId: "sp1", specialty: "General Medicine", phone: "+212 6 12 34 56 78", email: "ahmed@clinic.ma", consultationFee: 200, languages: ["Arabic", "French"] },
  { id: "d2", name: "Dr. Fatima Zahra", specialtyId: "sp2", specialty: "Pediatrics", phone: "+212 6 23 45 67 89", email: "fatima@clinic.ma", consultationFee: 250, languages: ["Arabic", "French", "English"] },
  { id: "d3", name: "Dr. Youssef El Amrani", specialtyId: "sp3", specialty: "Cardiology", phone: "+212 6 34 56 78 90", email: "youssef@clinic.ma", consultationFee: 400, languages: ["Arabic", "French"] },
];

export const services: Service[] = [
  { id: "s1", name: "General Consultation", description: "Comprehensive health check-up and medical consultation with the doctor.", duration: 30, price: 200, currency: "MAD", active: true },
  { id: "s2", name: "Follow-up Visit", description: "Follow-up appointment for ongoing treatment or monitoring.", duration: 20, price: 150, currency: "MAD", active: true },
  { id: "s3", name: "Pediatric Consultation", description: "Specialized medical consultation for children and infants.", duration: 30, price: 250, currency: "MAD", active: true },
  { id: "s4", name: "Cardiology Check-up", description: "Heart health assessment including ECG and blood pressure monitoring.", duration: 45, price: 400, currency: "MAD", active: true },
  { id: "s5", name: "Blood Test", description: "Complete blood panel analysis and lab work.", duration: 15, price: 100, currency: "MAD", active: true },
  { id: "s6", name: "Vaccination", description: "Standard vaccinations for adults and children.", duration: 15, price: 120, currency: "MAD", active: false },
];

export const patients: Patient[] = [
  { id: "p1", name: "Karim Mansouri", phone: "+212 6 11 22 33 44", email: "karim@email.com", age: 35, gender: "M", dateOfBirth: "1991-03-12", allergies: ["Penicillin"], insurance: "CNSS", registeredAt: "2025-01-15" },
  { id: "p2", name: "Nadia El Fassi", phone: "+212 6 22 33 44 55", email: "nadia@email.com", age: 28, gender: "F", dateOfBirth: "1998-07-22", registeredAt: "2025-02-20" },
  { id: "p3", name: "Omar Tazi", phone: "+212 6 33 44 55 66", email: "omar@email.com", age: 42, gender: "M", dateOfBirth: "1984-11-05", allergies: ["Aspirin", "Sulfa"], insurance: "CNOPS", registeredAt: "2025-03-01" },
  { id: "p4", name: "Salma Berrada", phone: "+212 6 44 55 66 77", email: "salma@email.com", age: 31, gender: "F", dateOfBirth: "1995-01-18", insurance: "CNSS", registeredAt: "2025-03-10" },
  { id: "p5", name: "Hassan Idrissi", phone: "+212 6 55 66 77 88", email: "hassan@email.com", age: 55, gender: "M", dateOfBirth: "1971-09-30", registeredAt: "2025-04-05" },
  { id: "p6", name: "Amina Chaoui", phone: "+212 6 66 77 88 99", email: "amina@email.com", age: 24, gender: "F", dateOfBirth: "2002-04-14", allergies: ["Latex"], insurance: "CNOPS", registeredAt: "2025-05-12" },
];

export const appointments: Appointment[] = [
  { id: "a1", patientId: "p1", patientName: "Karim Mansouri", doctorId: "d1", doctorName: "Dr. Ahmed Benali", serviceId: "s1", serviceName: "General Consultation", date: "2026-03-19", time: "09:00", status: "completed", isFirstVisit: false, hasInsurance: true },
  { id: "a2", patientId: "p2", patientName: "Nadia El Fassi", doctorId: "d1", doctorName: "Dr. Ahmed Benali", serviceId: "s2", serviceName: "Follow-up Visit", date: "2026-03-19", time: "09:30", status: "in-progress", isFirstVisit: false, hasInsurance: false },
  { id: "a3", patientId: "p3", patientName: "Omar Tazi", doctorId: "d1", doctorName: "Dr. Ahmed Benali", serviceId: "s4", serviceName: "Cardiology Check-up", date: "2026-03-19", time: "10:00", status: "confirmed", isFirstVisit: true, hasInsurance: true },
  { id: "a4", patientId: "p4", patientName: "Salma Berrada", doctorId: "d2", doctorName: "Dr. Fatima Zahra", serviceId: "s3", serviceName: "Pediatric Consultation", date: "2026-03-19", time: "10:30", status: "scheduled", isFirstVisit: true, hasInsurance: true },
  { id: "a5", patientId: "p5", patientName: "Hassan Idrissi", doctorId: "d3", doctorName: "Dr. Youssef El Amrani", serviceId: "s4", serviceName: "Cardiology Check-up", date: "2026-03-19", time: "11:00", status: "scheduled", isFirstVisit: false, hasInsurance: false },
  { id: "a6", patientId: "p6", patientName: "Amina Chaoui", doctorId: "d1", doctorName: "Dr. Ahmed Benali", serviceId: "s6", serviceName: "Vaccination", date: "2026-03-19", time: "11:30", status: "scheduled", isFirstVisit: true, hasInsurance: true },
  { id: "a7", patientId: "p1", patientName: "Karim Mansouri", doctorId: "d1", doctorName: "Dr. Ahmed Benali", serviceId: "s1", serviceName: "General Consultation", date: "2026-03-20", time: "09:00", status: "scheduled", isFirstVisit: false, hasInsurance: true },
  { id: "a8", patientId: "p3", patientName: "Omar Tazi", doctorId: "d3", doctorName: "Dr. Youssef El Amrani", serviceId: "s2", serviceName: "Follow-up Visit", date: "2026-03-20", time: "14:00", status: "scheduled", isFirstVisit: false, hasInsurance: true },
];

export const prescriptions: Prescription[] = [
  {
    id: "rx1", patientId: "p1", patientName: "Karim Mansouri", doctorName: "Dr. Ahmed Benali", date: "2026-03-19",
    medications: [
      { name: "Amoxicillin 500mg", dosage: "1 tablet 3x/day", duration: "7 days" },
      { name: "Ibuprofen 400mg", dosage: "1 tablet 2x/day after meals", duration: "5 days" },
    ],
  },
  {
    id: "rx2", patientId: "p2", patientName: "Nadia El Fassi", doctorName: "Dr. Ahmed Benali", date: "2026-03-18",
    medications: [
      { name: "Paracetamol 500mg", dosage: "1 tablet every 6 hours as needed", duration: "3 days" },
    ],
  },
  {
    id: "rx3", patientId: "p3", patientName: "Omar Tazi", doctorName: "Dr. Youssef El Amrani", date: "2026-03-17",
    medications: [
      { name: "Atorvastatin 20mg", dosage: "1 tablet at bedtime", duration: "30 days" },
      { name: "Aspirin 100mg", dosage: "1 tablet daily", duration: "30 days" },
      { name: "Lisinopril 10mg", dosage: "1 tablet daily", duration: "30 days" },
    ],
  },
];

export const reviews: Review[] = [
  { id: "r1", patientName: "Karim M.", rating: 5, comment: "Excellent doctor, very professional and caring. The clinic is clean and well-organized.", date: "2026-03-15", replied: true },
  { id: "r2", patientName: "Nadia E.", rating: 4, comment: "Good experience overall. Wait time was a bit long but the consultation was thorough.", date: "2026-03-12", replied: true },
  { id: "r3", patientName: "Omar T.", rating: 5, comment: "Best cardiologist in the city. Very detailed explanations and follow-up.", date: "2026-03-10", replied: false },
  { id: "r4", patientName: "Salma B.", rating: 5, comment: "Amazing with children. My son was very comfortable during the visit.", date: "2026-03-08", replied: true },
  { id: "r5", patientName: "Hassan I.", rating: 3, comment: "Good medical care but the online booking could be improved.", date: "2026-03-05", replied: false },
  { id: "r6", patientName: "Amina C.", rating: 4, comment: "Professional staff and modern equipment. Recommended!", date: "2026-03-01", replied: true },
];

export const invoices: Invoice[] = [
  { id: "inv1", patientName: "Karim Mansouri", amount: 200, currency: "MAD", method: "insurance", status: "paid", date: "2026-03-19" },
  { id: "inv2", patientName: "Nadia El Fassi", amount: 150, currency: "MAD", method: "cash", status: "paid", date: "2026-03-18" },
  { id: "inv3", patientName: "Omar Tazi", amount: 400, currency: "MAD", method: "card", status: "pending", date: "2026-03-17" },
  { id: "inv4", patientName: "Salma Berrada", amount: 250, currency: "MAD", method: "insurance", status: "pending", date: "2026-03-16" },
  { id: "inv5", patientName: "Hassan Idrissi", amount: 400, currency: "MAD", method: "cash", status: "overdue", date: "2026-03-10" },
];

export const clinics: Clinic[] = [
  { id: "c1", name: "Cabinet Dr. Ahmed Benali", type: "doctor", plan: "premium", city: "Casablanca", patientsCount: 342, monthlyRevenue: 68400, status: "active" },
  { id: "c2", name: "Dental Studio Marrakech", type: "dentist", plan: "premium", city: "Marrakech", patientsCount: 215, monthlyRevenue: 107500, status: "active" },
  { id: "c3", name: "Pharmacie Centrale Rabat", type: "pharmacy", plan: "standard", city: "Rabat", patientsCount: 890, monthlyRevenue: 45000, status: "active" },
  { id: "c4", name: "Cabinet Dr. Youssef", type: "doctor", plan: "basic", city: "Fes", patientsCount: 128, monthlyRevenue: 25600, status: "trial" },
  { id: "c5", name: "Clinique Dentaire Tanger", type: "dentist", plan: "standard", city: "Tangier", patientsCount: 176, monthlyRevenue: 52800, status: "active" },
  { id: "c6", name: "Pharmacie Ibn Sina", type: "pharmacy", plan: "basic", city: "Agadir", patientsCount: 0, monthlyRevenue: 2500, status: "suspended" },
];

export const blogPosts: BlogPost[] = [
  { id: "b1", title: "10 Tips for a Healthy Heart", excerpt: "Discover simple daily habits that can significantly improve your cardiovascular health and reduce the risk of heart disease.", date: "2026-03-15", readTime: "5 min", category: "Cardiology" },
  { id: "b2", title: "Understanding Childhood Vaccinations", excerpt: "A comprehensive guide for parents about the importance of vaccinations and the recommended schedule in Morocco.", date: "2026-03-10", readTime: "7 min", category: "Pediatrics" },
  { id: "b3", title: "Managing Diabetes: A Complete Guide", excerpt: "Learn about the latest treatments, dietary recommendations, and lifestyle changes for effective diabetes management.", date: "2026-03-05", readTime: "8 min", category: "General Health" },
  { id: "b4", title: "The Importance of Regular Check-ups", excerpt: "Why preventive medicine matters and how regular health screenings can detect problems early.", date: "2026-02-28", readTime: "4 min", category: "Preventive Care" },
];

// ---------- Waiting List Data ----------

export const waitingList: WaitingListEntry[] = [
  { id: "wl1", patientId: "p2", patientName: "Nadia El Fassi", doctorId: "d1", doctorName: "Dr. Ahmed Benali", preferredDate: "2026-03-21", preferredTime: "09:00", serviceId: "s1", serviceName: "General Consultation", status: "waiting", createdAt: "2026-03-19T10:00:00Z" },
  { id: "wl2", patientId: "p5", patientName: "Hassan Idrissi", doctorId: "d3", doctorName: "Dr. Youssef El Amrani", preferredDate: "2026-03-21", preferredTime: "10:00", serviceId: "s4", serviceName: "Cardiology Check-up", status: "waiting", createdAt: "2026-03-19T11:00:00Z" },
];

// ---------- Emergency Slots Data ----------

export const emergencySlots: EmergencySlot[] = [];

// ---------- Appointment-Doctor Assignments (multi-doctor) ----------

export const appointmentDoctors: { appointmentId: string; doctorId: string; isPrimary: boolean }[] = [];

// ---------- Payment Records ----------

export const paymentRecords: PaymentRecord[] = [];

// ---------- Consultation Notes (per-visit, private) ----------

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  date: string;
  chiefComplaint: string;
  examination: string;
  diagnosis: string;
  plan: string;
  privateNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export const consultationNotes: ConsultationNote[] = [
  {
    id: "cn1", appointmentId: "a1", patientId: "p1", doctorId: "d1", date: "2026-03-19",
    chiefComplaint: "Recurring headaches for 2 weeks, worsening in the evenings",
    examination: "BP 130/85, HR 72. Neurological exam normal. No papilledema.",
    diagnosis: "Tension-type headache",
    plan: "Prescribed Paracetamol 1g PRN, stress management, follow-up in 2 weeks if no improvement.",
    privateNotes: "Patient seems stressed, consider referring to psychologist if symptoms persist.",
    createdAt: "2026-03-19T09:30:00Z", updatedAt: "2026-03-19T09:30:00Z",
  },
  {
    id: "cn2", appointmentId: "a2", patientId: "p2", doctorId: "d1", date: "2026-03-19",
    chiefComplaint: "Follow-up on blood pressure medication",
    examination: "BP 125/80, improved from last visit. Weight stable.",
    diagnosis: "Hypertension - controlled",
    plan: "Continue Lisinopril 10mg daily. Repeat blood work in 1 month.",
    createdAt: "2026-03-19T10:00:00Z", updatedAt: "2026-03-19T10:00:00Z",
  },
  {
    id: "cn3", appointmentId: "a5", patientId: "p5", doctorId: "d3", date: "2026-03-19",
    chiefComplaint: "Routine cardiology check-up",
    examination: "ECG normal sinus rhythm. BP 140/90. Heart sounds normal, no murmurs.",
    diagnosis: "Borderline hypertension",
    plan: "Lifestyle modifications, reduce salt intake, exercise 30min daily. Recheck in 3 months.",
    privateNotes: "Family history of cardiac events. Monitor closely.",
    createdAt: "2026-03-19T11:15:00Z", updatedAt: "2026-03-19T11:15:00Z",
  },
];

// ---------- Internal Chat Messages ----------

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "doctor" | "receptionist";
  recipientId: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export const chatMessages: ChatMessage[] = [
  { id: "msg1", senderId: "d1", senderName: "Dr. Ahmed Benali", senderRole: "doctor", recipientId: "r1", message: "Please send in the next patient.", timestamp: "2026-03-20T09:05:00Z", read: true },
  { id: "msg2", senderId: "r1", senderName: "Receptionist Sara", senderRole: "receptionist", recipientId: "d1", message: "Karim Mansouri is on his way. He arrived 5 minutes ago.", timestamp: "2026-03-20T09:06:00Z", read: true },
  { id: "msg3", senderId: "d1", senderName: "Dr. Ahmed Benali", senderRole: "doctor", recipientId: "r1", message: "Thank you. Also, can you reschedule Omar Tazi to 14:30?", timestamp: "2026-03-20T09:10:00Z", read: true },
  { id: "msg4", senderId: "r1", senderName: "Receptionist Sara", senderRole: "receptionist", recipientId: "d1", message: "Done! Omar has been moved to 14:30. I notified him via WhatsApp.", timestamp: "2026-03-20T09:12:00Z", read: true },
  { id: "msg5", senderId: "r1", senderName: "Receptionist Sara", senderRole: "receptionist", recipientId: "d1", message: "Dr., Amina Chaoui just called to confirm her 11:30 appointment.", timestamp: "2026-03-20T09:45:00Z", read: false },
  { id: "msg6", senderId: "r1", senderName: "Receptionist Sara", senderRole: "receptionist", recipientId: "d1", message: "A walk-in patient is asking if you have any availability today. Should I add them?", timestamp: "2026-03-20T10:15:00Z", read: false },
];

// ---------- Waiting Room Queue ----------

export interface WaitingRoomEntry {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  serviceName: string;
  scheduledTime: string;
  arrivedAt: string;
  status: "waiting" | "in-consultation" | "done";
  priority: "normal" | "urgent" | "follow-up";
}

export const waitingRoom: WaitingRoomEntry[] = [
  { id: "wr1", patientId: "p1", patientName: "Karim Mansouri", appointmentId: "a7", serviceName: "General Consultation", scheduledTime: "09:00", arrivedAt: "2026-03-20T08:50:00Z", status: "in-consultation", priority: "normal" },
  { id: "wr2", patientId: "p3", patientName: "Omar Tazi", appointmentId: "a8", serviceName: "Follow-up Visit", scheduledTime: "14:00", arrivedAt: "2026-03-20T13:45:00Z", status: "waiting", priority: "follow-up" },
  { id: "wr3", patientId: "p4", patientName: "Salma Berrada", appointmentId: "a4", serviceName: "Pediatric Consultation", scheduledTime: "10:30", arrivedAt: "2026-03-20T10:15:00Z", status: "waiting", priority: "normal" },
  { id: "wr4", patientId: "p6", patientName: "Amina Chaoui", appointmentId: "a6", serviceName: "Vaccination", scheduledTime: "11:30", arrivedAt: "2026-03-20T11:20:00Z", status: "waiting", priority: "urgent" },
];

// ---------- Doctor Stats Helpers ----------

export function getDoctorWeekStats(doctorId: string) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startStr = startOfWeek.toISOString().split("T")[0];

  const weekAppts = appointments.filter(
    (a) => a.doctorId === doctorId && a.date >= startStr && a.date <= now.toISOString().split("T")[0]
  );
  const uniquePatients = new Set(weekAppts.map((a) => a.patientId)).size;
  const completed = weekAppts.filter((a) => a.status === "completed").length;
  const noShows = weekAppts.filter((a) => a.status === "no-show").length;

  return { totalAppointments: weekAppts.length, uniquePatients, completed, noShows };
}

export function getDoctorMonthStats(doctorId: string) {
  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

  const monthAppts = appointments.filter(
    (a) => a.doctorId === doctorId && a.date.startsWith(monthStr)
  );
  const uniquePatients = new Set(monthAppts.map((a) => a.patientId)).size;
  const completed = monthAppts.filter((a) => a.status === "completed").length;
  const noShows = monthAppts.filter((a) => a.status === "no-show").length;
  const revenue = monthAppts.filter((a) => a.status === "completed").length * 200; // simplified

  return { totalAppointments: monthAppts.length, uniquePatients, completed, noShows, revenue };
}

export function getNextAvailableSlots(doctorId: string, daysAhead: number = 7): { date: string; slots: string[] }[] {
  const results: { date: string; slots: string[] }[] = [];
  const today = new Date();

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const slots = getAvailableSlots(dateStr, doctorId);
    if (slots.length > 0) {
      results.push({ date: dateStr, slots });
    }
  }
  return results;
}

// ---------- Time slot helpers ----------

import { clinicConfig } from "@/config/clinic.config";

/**
 * Generate time slots dynamically based on clinic working hours,
 * slot duration, and buffer time configuration.
 */
export function generateTimeSlots(date: string): string[] {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const hours = clinicConfig.workingHours[dayOfWeek];
  if (!hours?.enabled) return [];

  const slotDuration = clinicConfig.booking.slotDuration;
  const bufferTime = clinicConfig.booking.bufferTime;
  const totalInterval = slotDuration + bufferTime;

  const [openH, openM] = hours.open.split(":").map(Number);
  const [closeH, closeM] = hours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const slots: string[] = [];
  for (let m = openMinutes; m + slotDuration <= closeMinutes; m += totalInterval) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

export const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

/**
 * Get available slots for a doctor on a given date.
 * Respects max capacity per slot and filters out fully-booked times.
 */
export function getAvailableSlots(date: string, doctorId: string): string[] {
  const allSlots = generateTimeSlots(date);
  const maxPerSlot = clinicConfig.booking.maxPerSlot;

  return allSlots.filter((slot) => {
    const bookingsAtSlot = appointments.filter(
      (a) => a.date === date && a.doctorId === doctorId && a.time === slot && a.status !== "cancelled"
    ).length;
    return bookingsAtSlot < maxPerSlot;
  });
}

/**
 * Get booked slot counts for display purposes.
 */
export function getSlotBookingCounts(date: string, doctorId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  appointments
    .filter((a) => a.date === date && a.doctorId === doctorId && a.status !== "cancelled")
    .forEach((a) => {
      counts[a.time] = (counts[a.time] || 0) + 1;
    });
  return counts;
}

/**
 * Get doctors filtered by specialty.
 */
export function getDoctorsBySpecialty(specialtyId: string): Doctor[] {
  return doctors.filter((d) => d.specialtyId === specialtyId);
}

// ---------- Stats helpers ----------

export function getTodayAppointments(doctorId?: string) {
  const today = new Date().toISOString().split("T")[0];
  return appointments.filter((a) => a.date === today && (!doctorId || a.doctorId === doctorId));
}

export function getPatientAppointments(patientId: string) {
  return appointments.filter((a) => a.patientId === patientId);
}

export function getDoctorAppointments(doctorId: string) {
  return appointments.filter((a) => a.doctorId === doctorId);
}

export function getAverageRating() {
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return total / reviews.length;
}

export function getTotalRevenue() {
  return invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
}

// ---------- Cancellation helpers ----------

/**
 * Check if an appointment can be cancelled based on the cancellation window.
 */
export function canCancelAppointment(appointmentId: string, now?: Date): { canCancel: boolean; reason?: string; hoursRemaining?: number } {
  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) return { canCancel: false, reason: "Appointment not found" };
  if (appt.status === "cancelled" || appt.status === "completed" || appt.status === "rescheduled") {
    return { canCancel: false, reason: "Appointment cannot be cancelled in its current state" };
  }

  const currentTime = now ?? new Date();
  const appointmentDateTime = new Date(`${appt.date}T${appt.time}:00`);
  const hoursUntilAppt = (appointmentDateTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
  const cancellationWindowHours = clinicConfig.booking.cancellationHours;

  if (hoursUntilAppt < cancellationWindowHours) {
    return {
      canCancel: false,
      reason: `Cancellations must be made at least ${cancellationWindowHours} hours before the appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppt),
    };
  }

  return { canCancel: true, hoursRemaining: hoursUntilAppt };
}

/**
 * Cancel an appointment.
 */
export function cancelAppointment(appointmentId: string, reason?: string, now?: Date): { success: boolean; error?: string } {
  const check = canCancelAppointment(appointmentId, now);
  if (!check.canCancel) return { success: false, error: check.reason };

  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) return { success: false, error: "Appointment not found" };

  appt.status = "cancelled";
  appt.cancelledAt = new Date().toISOString();
  appt.cancellationReason = reason ?? "Cancelled by patient";

  // Check waiting list for this slot and promote first entry
  promoteFromWaitingList(appt.doctorId, appt.date, appt.time);

  return { success: true };
}

// ---------- Reschedule helpers ----------

/**
 * Reschedule an appointment to a new date/time.
 */
export function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string,
  now?: Date,
): { success: boolean; newAppointmentId?: string; error?: string } {
  const check = canCancelAppointment(appointmentId, now);
  if (!check.canCancel) return { success: false, error: check.reason };

  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) return { success: false, error: "Appointment not found" };

  // Check new slot availability
  const available = getAvailableSlots(newDate, appt.doctorId);
  if (!available.includes(newTime)) {
    return { success: false, error: "Selected time slot is not available" };
  }

  // Mark old appointment as rescheduled
  appt.status = "rescheduled";

  // Create new appointment
  const newId = `apt-${Date.now()}`;
  const newAppt: Appointment = {
    ...appt,
    id: newId,
    date: newDate,
    time: newTime,
    status: "scheduled",
    rescheduledFrom: appointmentId,
  };
  appointments.push(newAppt);

  // Promote waiting list for old slot
  promoteFromWaitingList(appt.doctorId, appt.date, appt.time);

  return { success: true, newAppointmentId: newId };
}

// ---------- Waiting List helpers ----------

/**
 * Add a patient to the waiting list for a specific slot.
 */
export function addToWaitingList(
  patientId: string,
  patientName: string,
  doctorId: string,
  preferredDate: string,
  preferredTime?: string,
  serviceId?: string,
): { success: boolean; entryId?: string; error?: string } {
  const doctor = doctors.find((d) => d.id === doctorId);
  if (!doctor) return { success: false, error: "Doctor not found" };

  // Check if already on waiting list for same doctor/date
  const existing = waitingList.find(
    (w) => w.patientId === patientId && w.doctorId === doctorId && w.preferredDate === preferredDate && w.status === "waiting",
  );
  if (existing) return { success: false, error: "Already on the waiting list for this doctor and date" };

  const service = serviceId ? services.find((s) => s.id === serviceId) : undefined;
  const entryId = `wl-${Date.now()}`;

  waitingList.push({
    id: entryId,
    patientId,
    patientName,
    doctorId,
    doctorName: doctor.name,
    preferredDate,
    preferredTime: preferredTime,
    serviceId,
    serviceName: service?.name,
    status: "waiting",
    createdAt: new Date().toISOString(),
  });

  return { success: true, entryId };
}

/**
 * Remove a patient from the waiting list.
 */
export function removeFromWaitingList(entryId: string): { success: boolean; error?: string } {
  const idx = waitingList.findIndex((w) => w.id === entryId);
  if (idx === -1) return { success: false, error: "Waiting list entry not found" };
  waitingList.splice(idx, 1);
  return { success: true };
}

/**
 * Get waiting list entries for a specific patient.
 */
export function getPatientWaitingList(patientId: string): WaitingListEntry[] {
  return waitingList.filter((w) => w.patientId === patientId && w.status === "waiting");
}

/**
 * Get waiting list entries for a specific doctor/date.
 */
export function getWaitingListForSlot(doctorId: string, date: string, time?: string): WaitingListEntry[] {
  return waitingList.filter(
    (w) => w.doctorId === doctorId && w.preferredDate === date && w.status === "waiting" && (!time || !w.preferredTime || w.preferredTime === time),
  );
}

/**
 * Promote the first waiting list entry when a slot opens up.
 */
export function promoteFromWaitingList(doctorId: string, date: string, time: string): WaitingListEntry | null {
  const candidates = getWaitingListForSlot(doctorId, date, time);
  if (candidates.length === 0) return null;

  const first = candidates[0];
  first.status = "notified";
  return first;
}

// ---------- Emergency Slot helpers ----------

/**
 * Create an emergency slot for a doctor.
 */
export function createEmergencySlot(
  doctorId: string,
  date: string,
  startTime: string,
  durationMin: number,
  reason?: string,
): { success: boolean; slotId?: string; error?: string } {
  const doctor = doctors.find((d) => d.id === doctorId);
  if (!doctor) return { success: false, error: "Doctor not found" };

  const [hh, mm] = startTime.split(":").map(Number);
  const endMinutes = hh * 60 + mm + durationMin;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  const slotId = `es-${Date.now()}`;
  emergencySlots.push({
    id: slotId,
    doctorId,
    doctorName: doctor.name,
    date,
    startTime,
    endTime,
    reason,
    isBooked: false,
    createdAt: new Date().toISOString(),
  });

  return { success: true, slotId };
}

/**
 * Get emergency slots for a doctor on a given date.
 */
export function getEmergencySlots(doctorId?: string, date?: string): EmergencySlot[] {
  return emergencySlots.filter(
    (s) => (!doctorId || s.doctorId === doctorId) && (!date || s.date === date),
  );
}

/**
 * Book an emergency slot.
 */
export function bookEmergencySlot(
  slotId: string,
  patientId: string,
  patientName: string,
  serviceId?: string,
): { success: boolean; appointmentId?: string; error?: string } {
  const slot = emergencySlots.find((s) => s.id === slotId);
  if (!slot) return { success: false, error: "Emergency slot not found" };
  if (slot.isBooked) return { success: false, error: "Emergency slot is already booked" };

  const doctor = doctors.find((d) => d.id === slot.doctorId);
  const service = serviceId ? services.find((s) => s.id === serviceId) : undefined;

  const appointmentId = `apt-${Date.now()}`;
  appointments.push({
    id: appointmentId,
    patientId,
    patientName,
    doctorId: slot.doctorId,
    doctorName: doctor?.name ?? "Unknown",
    serviceId: serviceId ?? "",
    serviceName: service?.name ?? "Emergency Visit",
    date: slot.date,
    time: slot.startTime,
    status: "confirmed",
    isFirstVisit: false,
    hasInsurance: false,
    isEmergency: true,
  });

  slot.isBooked = true;
  return { success: true, appointmentId };
}

// ---------- Recurring Booking helpers ----------

/**
 * Create a recurring booking series.
 */
export function createRecurringBooking(
  baseAppointment: Omit<Appointment, "id" | "recurrenceGroupId" | "recurrencePattern" | "recurrenceIndex">,
  pattern: "weekly" | "biweekly" | "monthly",
  occurrences: number,
): { success: boolean; appointmentIds: string[]; skippedDates: string[]; error?: string } {
  const maxWeeks = clinicConfig.booking.maxRecurringWeeks;
  const maxOccurrences = Math.min(occurrences, maxWeeks);

  const groupId = `rg-${Date.now()}`;
  const appointmentIds: string[] = [];
  const skippedDates: string[] = [];

  for (let i = 0; i < maxOccurrences; i++) {
    const baseDate = new Date(baseAppointment.date);
    let newDate: Date;

    if (pattern === "weekly") {
      newDate = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    } else if (pattern === "biweekly") {
      newDate = new Date(baseDate.getTime() + i * 14 * 24 * 60 * 60 * 1000);
    } else {
      newDate = new Date(baseDate);
      newDate.setMonth(newDate.getMonth() + i);
    }

    const dateStr = newDate.toISOString().split("T")[0];
    const dayOfWeek = newDate.getDay();
    const hours = clinicConfig.workingHours[dayOfWeek];

    if (!hours?.enabled) {
      skippedDates.push(dateStr);
      continue;
    }

    const available = getAvailableSlots(dateStr, baseAppointment.doctorId);
    if (!available.includes(baseAppointment.time)) {
      skippedDates.push(dateStr);
      continue;
    }

    const id = `apt-${Date.now()}-${i}`;
    appointments.push({
      ...baseAppointment,
      id,
      date: dateStr,
      status: "scheduled",
      recurrenceGroupId: groupId,
      recurrencePattern: pattern,
      recurrenceIndex: i,
    });
    appointmentIds.push(id);
  }

  return { success: true, appointmentIds, skippedDates };
}

/**
 * Cancel a recurring booking series or single occurrence.
 */
export function cancelRecurringSeries(groupId: string, cancelAll: boolean, appointmentId?: string): { success: boolean; cancelledCount: number; error?: string } {
  if (cancelAll) {
    const series = appointments.filter((a) => a.recurrenceGroupId === groupId && a.status !== "cancelled" && a.status !== "completed");
    series.forEach((a) => {
      a.status = "cancelled";
      a.cancelledAt = new Date().toISOString();
      a.cancellationReason = "Recurring series cancelled";
    });
    return { success: true, cancelledCount: series.length };
  }

  if (appointmentId) {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return { success: false, cancelledCount: 0, error: "Appointment not found" };
    appt.status = "cancelled";
    appt.cancelledAt = new Date().toISOString();
    appt.cancellationReason = "Single occurrence cancelled";
    return { success: true, cancelledCount: 1 };
  }

  return { success: false, cancelledCount: 0, error: "Must specify appointmentId or cancelAll" };
}

// ---------- Multi-Doctor helpers ----------

/**
 * Assign additional doctors to an appointment.
 */
export function assignDoctorsToAppointment(
  appointmentId: string,
  doctorIds: string[],
  primaryDoctorId: string,
): { success: boolean; error?: string } {
  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) return { success: false, error: "Appointment not found" };

  // Remove existing assignments
  const existingIdx = appointmentDoctors.filter((ad) => ad.appointmentId === appointmentId);
  existingIdx.forEach((ad) => {
    const idx = appointmentDoctors.indexOf(ad);
    if (idx !== -1) appointmentDoctors.splice(idx, 1);
  });

  // Add new assignments
  for (const doctorId of doctorIds) {
    appointmentDoctors.push({
      appointmentId,
      doctorId,
      isPrimary: doctorId === primaryDoctorId,
    });
  }

  appt.doctorIds = doctorIds;
  return { success: true };
}

/**
 * Get all doctors assigned to an appointment.
 */
export function getAppointmentDoctors(appointmentId: string): { doctorId: string; doctorName: string; isPrimary: boolean }[] {
  const assignments = appointmentDoctors.filter((ad) => ad.appointmentId === appointmentId);
  return assignments.map((ad) => {
    const doctor = doctors.find((d) => d.id === ad.doctorId);
    return {
      doctorId: ad.doctorId,
      doctorName: doctor?.name ?? "Unknown",
      isPrimary: ad.isPrimary,
    };
  });
}

// ---------- Payment helpers ----------

/**
 * Initiate a payment for an appointment.
 */
export function initiatePayment(
  appointmentId: string,
  patientId: string,
  patientName: string,
  amount: number,
  paymentType: "deposit" | "full",
  method: "cash" | "card" | "online" | "insurance" = "online",
): { success: boolean; paymentId?: string; gatewaySessionId?: string; error?: string } {
  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) return { success: false, error: "Appointment not found" };

  const existing = paymentRecords.find((p) => p.appointmentId === appointmentId && p.status !== "refunded" && p.status !== "failed");
  if (existing) return { success: false, error: "A payment already exists for this appointment" };

  const paymentId = `pay-${Date.now()}`;
  const gatewaySessionId = method === "online" ? `gw-${Date.now()}` : undefined;

  paymentRecords.push({
    id: paymentId,
    appointmentId,
    patientId,
    patientName,
    amount,
    currency: "MAD",
    method,
    status: "pending",
    paymentType,
    gatewaySessionId,
    refundedAmount: 0,
    createdAt: new Date().toISOString(),
  });

  return { success: true, paymentId, gatewaySessionId };
}

/**
 * Confirm a payment.
 */
export function confirmPayment(paymentId: string): { success: boolean; error?: string } {
  const payment = paymentRecords.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: "Payment not found" };
  if (payment.status !== "pending") return { success: false, error: "Payment is not in pending state" };

  payment.status = "completed";

  // Also confirm the appointment
  const appt = appointments.find((a) => a.id === payment.appointmentId);
  if (appt && appt.status === "pending") {
    appt.status = "confirmed";
  }

  return { success: true };
}

/**
 * Refund a payment.
 */
export function refundPayment(paymentId: string, amount?: number): { success: boolean; error?: string } {
  const payment = paymentRecords.find((p) => p.id === paymentId);
  if (!payment) return { success: false, error: "Payment not found" };
  if (payment.status !== "completed") return { success: false, error: "Only completed payments can be refunded" };

  const refundAmount = amount ?? payment.amount;
  payment.refundedAmount = refundAmount;
  payment.status = "refunded";

  return { success: true };
}

/**
 * Get payment for an appointment.
 */
export function getAppointmentPayment(appointmentId: string): PaymentRecord | undefined {
  return paymentRecords.find((p) => p.appointmentId === appointmentId);
}
