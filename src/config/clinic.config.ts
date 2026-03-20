/**
 * Clinic Configuration
 *
 * This is the ONLY file you change per client deployment.
 * Each clinic gets its own copy with customized values.
 */

export type ClinicType = "doctor" | "dentist" | "pharmacy";

export type ClinicTier = "vitrine" | "cabinet" | "pro" | "premium" | "saas";

export interface ClinicConfig {
  /** Unique clinic identifier (matches clinic_id in Supabase) */
  clinicId: string;

  /** Display name of the clinic */
  name: string;

  /** Type of health practice */
  type: ClinicType;

  /** Subscription tier — controls which features are enabled */
  tier: ClinicTier;

  /** Custom domain (e.g., dr-ahmed.ma) */
  domain?: string;

  /** Default locale */
  locale: "fr" | "ar" | "en";

  /** Currency code */
  currency: string;

  /** Contact information */
  contact: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    city?: string;
    googleMapsUrl?: string;
  };

  /** Working hours per day (0 = Sunday, 6 = Saturday) */
  workingHours: Record<
    number,
    { open: string; close: string; enabled: boolean }
  >;

  /** Booking configuration */
  booking: {
    slotDuration: number;
    bufferTime: number;
    maxAdvanceDays: number;
    maxPerSlot: number;
    cancellationHours: number;
    depositAmount?: number;
    depositPercentage?: number;
    maxRecurringWeeks: number;
  };

  /** Feature flags based on tier */
  features: {
    booking: boolean;
    patientPortal: boolean;
    doctorDashboard: boolean;
    receptionistDashboard: boolean;
    prescriptions: boolean;
    documents: boolean;
    analytics: boolean;
    multiDoctor: boolean;
    onlinePayment: boolean;
    whatsappNotifications: boolean;
    waitingList: boolean;
    emergencySlots: boolean;
    recurringBookings: boolean;
    chatbot: boolean;
  };
}

/**
 * Default clinic configuration.
 * Override per client by editing this file before deployment.
 */
export const clinicConfig: ClinicConfig = {
  clinicId: "demo-clinic",
  name: "Demo Clinic",
  type: "doctor",
  tier: "pro",
  domain: undefined,
  locale: "fr",
  currency: "MAD",

  contact: {
    phone: undefined,
    whatsapp: undefined,
    email: undefined,
    address: undefined,
    city: undefined,
    googleMapsUrl: undefined,
  },

  workingHours: {
    0: { open: "09:00", close: "17:00", enabled: false }, // Sunday
    1: { open: "09:00", close: "17:00", enabled: true }, // Monday
    2: { open: "09:00", close: "17:00", enabled: true },
    3: { open: "09:00", close: "17:00", enabled: true },
    4: { open: "09:00", close: "17:00", enabled: true },
    5: { open: "09:00", close: "17:00", enabled: true },
    6: { open: "09:00", close: "13:00", enabled: true }, // Saturday
  },

  booking: {
    slotDuration: 30,
    bufferTime: 10,
    maxAdvanceDays: 30,
    maxPerSlot: 1,
    cancellationHours: 24,
    depositAmount: undefined,
    depositPercentage: 20,
    maxRecurringWeeks: 12,
  },

  features: {
    booking: true,
    patientPortal: true,
    doctorDashboard: true,
    receptionistDashboard: true,
    prescriptions: true,
    documents: true,
    analytics: true,
    multiDoctor: false,
    onlinePayment: false,
    whatsappNotifications: false,
    waitingList: true,
    emergencySlots: true,
    recurringBookings: true,
    chatbot: false,
  },
};
