/**
 * Clinic Configuration
 *
 * This is the ONLY file you change per client deployment.
 * Each clinic gets its own copy with customized values.
 */

/**
 * Supported clinic types for the static config file.
 *
 * These map to `type_key` values in the `CLINIC_TYPES` registry
 * (see src/lib/config/clinic-types.ts) and to specialty feature sets
 * in `SPECIALTY_FEATURES` (see src/lib/hooks/use-clinic-features.tsx).
 *
 * Types with full specialty UI support in the doctor dashboard:
 *   doctor, dentist, pediatrician, gynecologist, ophthalmologist,
 *   cardiologist, dermatologist, orthopedist, neurologist, psychiatrist,
 *   physiotherapist, radiologist, nutritionist
 *
 * Types with basic (non-specialty) support:
 *   pharmacy, lab, optician, parapharmacy, psychologist, speech-therapist,
 *   equipment
 */
export type ClinicType =
  | "doctor"
  | "dentist"
  | "pharmacy"
  | "lab"
  | "equipment"
  | "nutritionist"
  | "optician"
  | "parapharmacy"
  | "physiotherapist"
  | "psychologist"
  | "speech-therapist"
  | "radiology"
  | "pediatrician"
  | "gynecologist"
  | "ophthalmologist"
  | "cardiologist"
  | "dermatologist"
  | "orthopedist"
  | "neurologist"
  | "psychiatrist";

export type ClinicTier = "vitrine" | "cabinet" | "pro" | "premium" | "saas";

export interface ClinicConfig {
  /**
   * @deprecated Do NOT use for tenant identification.
   * Tenant clinic_id MUST come from request context via requireTenant().
   * This field is retained only for backward-compatible branding fallback.
   */
  clinicId?: string;

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

  /** Locale for patient-facing WhatsApp/SMS messages */
  patientMessageLocale: "fr" | "ar" | "darija";

  /** Currency code */
  currency: string;

  /** IANA timezone for date/time operations (e.g. "Africa/Casablanca") */
  timezone: string;

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
    /** Morocco-specific features */
    insuranceTracking: boolean;
    installmentPayments: boolean;
    gardeScheduling: boolean;
    carnetDeSante: boolean;
    fiscExport: boolean;
    multiCabinet: boolean;
    publicDirectory: boolean;
    tvQueueDisplay: boolean;
    ordonnanceFr: boolean;
  };

  /** Morocco-specific configuration */
  morocco?: {
    /** Legal identification numbers */
    legal?: {
      ice?: string;
      identifiantFiscal?: string;
      rc?: string;
      cnss?: string;
      patente?: string;
      autorisationExercice?: string;
    };

    /** Ramadan mode configuration */
    ramadan?: {
      enabled: boolean;
      startDate: string;
      endDate: string;
    };

    /** Accepted payment methods */
    paymentMethods?: string[];

    /** Accepted insurance providers */
    acceptedInsurance?: string[];

    /** Default TVA rate key */
    defaultTVARate?: "standard" | "reduced_14" | "reduced_10" | "reduced_7" | "exempt";
  };
}

/**
 * Default clinic configuration.
 * Override per client by editing this file before deployment.
 */
export const clinicConfig: ClinicConfig = {
  // clinicId removed — tenant identity comes from request context (requireTenant())
  name: "",
  type: "doctor",
  tier: "pro",
  domain: undefined,
  locale: "fr",
  patientMessageLocale: "fr",
  currency: "MAD",
  timezone: "Africa/Casablanca",

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
    insuranceTracking: true,
    installmentPayments: true,
    gardeScheduling: true,
    carnetDeSante: true,
    fiscExport: true,
    multiCabinet: false,
    publicDirectory: true,
    tvQueueDisplay: true,
    ordonnanceFr: true,
  },

  morocco: {
    legal: {
      ice: undefined,
      identifiantFiscal: undefined,
      rc: undefined,
      cnss: undefined,
      patente: undefined,
      autorisationExercice: undefined,
    },
    ramadan: {
      enabled: false,
      startDate: "",
      endDate: "",
    },
    paymentMethods: ["cash", "cmi", "cashplus", "wafacash", "baridbank", "bank_transfer", "check", "insurance"],
    acceptedInsurance: ["cnss", "cnops", "amo", "ramed"],
    defaultTVARate: "standard",
  },
};
