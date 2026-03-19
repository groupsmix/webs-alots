/**
 * Demo / mock data for the Health SaaS platform.
 * Used across all dashboards until Supabase is wired up.
 */

// ---------- Types ----------

export interface Doctor {
  id: string;
  name: string;
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
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "no-show" | "cancelled";
  isFirstVisit: boolean;
  hasInsurance: boolean;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  medications: { name: string; dosage: string; duration: string }[];
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

export const doctors: Doctor[] = [
  { id: "d1", name: "Dr. Ahmed Benali", specialty: "General Medicine", phone: "+212 6 12 34 56 78", email: "ahmed@clinic.ma", consultationFee: 200, languages: ["Arabic", "French"] },
  { id: "d2", name: "Dr. Fatima Zahra", specialty: "Pediatrics", phone: "+212 6 23 45 67 89", email: "fatima@clinic.ma", consultationFee: 250, languages: ["Arabic", "French", "English"] },
  { id: "d3", name: "Dr. Youssef El Amrani", specialty: "Cardiology", phone: "+212 6 34 56 78 90", email: "youssef@clinic.ma", consultationFee: 400, languages: ["Arabic", "French"] },
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
  { id: "p1", name: "Karim Mansouri", phone: "+212 6 11 22 33 44", email: "karim@email.com", age: 35, gender: "M", insurance: "CNSS", registeredAt: "2025-01-15" },
  { id: "p2", name: "Nadia El Fassi", phone: "+212 6 22 33 44 55", email: "nadia@email.com", age: 28, gender: "F", registeredAt: "2025-02-20" },
  { id: "p3", name: "Omar Tazi", phone: "+212 6 33 44 55 66", email: "omar@email.com", age: 42, gender: "M", insurance: "CNOPS", registeredAt: "2025-03-01" },
  { id: "p4", name: "Salma Berrada", phone: "+212 6 44 55 66 77", email: "salma@email.com", age: 31, gender: "F", insurance: "CNSS", registeredAt: "2025-03-10" },
  { id: "p5", name: "Hassan Idrissi", phone: "+212 6 55 66 77 88", email: "hassan@email.com", age: 55, gender: "M", registeredAt: "2025-04-05" },
  { id: "p6", name: "Amina Chaoui", phone: "+212 6 66 77 88 99", email: "amina@email.com", age: 24, gender: "F", insurance: "CNOPS", registeredAt: "2025-05-12" },
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

// ---------- Time slot helpers ----------

export const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

export function getAvailableSlots(date: string, doctorId: string): string[] {
  const booked = appointments
    .filter((a) => a.date === date && a.doctorId === doctorId && a.status !== "cancelled")
    .map((a) => a.time);
  return timeSlots.filter((slot) => !booked.includes(slot));
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
