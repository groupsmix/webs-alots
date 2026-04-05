/**
 * Morocco-Specific Utilities
 *
 * Core utilities for Moroccan business logic:
 * - Phone number formatting (+212)
 * - TVA (tax) calculation (20%)
 * - MAD currency formatting
 * - Insurance types (CNSS/CNOPS/AMO)
 * - Moroccan payment methods
 */

// ---- Phone Number Formatting ----

const MOROCCO_COUNTRY_CODE = "+212";

/**
 * Validates a Moroccan phone number.
 * Accepts formats: 0612345678, +212612345678, 212612345678, 06 12 34 56 78
 * MED-12: Accepts both mobile (6/7) and landline (5) numbers.
 * Use isValidMoroccanMobile() when you need mobile-only validation
 * (e.g. for WhatsApp/SMS delivery).
 */
export function isValidMoroccanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+212") || cleaned.startsWith("212")) {
    const local = cleaned.startsWith("+212") ? cleaned.slice(4) : cleaned.slice(3);
    return /^[5-7]\d{8}$/.test(local);
  }
  if (cleaned.startsWith("0")) {
    return /^0[5-7]\d{8}$/.test(cleaned);
  }
  return false;
}

/**
 * Validates a Moroccan MOBILE phone number (6xx or 7xx only).
 * MED-12: Use this for WhatsApp/SMS delivery — landlines (5xx) cannot
 * receive WhatsApp messages and will cause silent delivery failures.
 */
export function isValidMoroccanMobile(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+212") || cleaned.startsWith("212")) {
    const local = cleaned.startsWith("+212") ? cleaned.slice(4) : cleaned.slice(3);
    return /^[67]\d{8}$/.test(local);
  }
  if (cleaned.startsWith("0")) {
    return /^0[67]\d{8}$/.test(cleaned);
  }
  return false;
}

/**
 * Formats a phone number to international +212 format.
 * Input: "0612345678" → "+212 6 12 34 56 78"
 */
export function formatMoroccanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  let local: string;

  if (cleaned.startsWith("+212")) {
    local = cleaned.slice(4);
  } else if (cleaned.startsWith("212")) {
    local = cleaned.slice(3);
  } else if (cleaned.startsWith("0")) {
    local = cleaned.slice(1);
  } else {
    return phone; // return as-is if unrecognized
  }

  if (local.length !== 9) return phone;

  // Format: +212 X XX XX XX XX
  return `${MOROCCO_COUNTRY_CODE} ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/**
 * Converts phone to WhatsApp-compatible format (no + or spaces).
 * Input: "+212 6 12 34 56 78" → "212612345678"
 */
export function phoneToWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("0")) {
    return "212" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Returns the mobile prefix label for display.
 */
export function getPhonePrefix(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("06") || cleaned.includes("2126")) return "Maroc Telecom / Orange / inwi";
  if (cleaned.startsWith("07") || cleaned.includes("2127")) return "inwi / Orange";
  if (cleaned.startsWith("05") || cleaned.includes("2125")) return "Fixe / ADSL";
  return "";
}

// ---- TVA (Tax) Calculation ----

/** Standard Moroccan TVA rate */
export const TVA_RATE = 0.20;

/** Reduced TVA rates */
export const TVA_RATES = {
  standard: 0.20,    // 20% - default for services
  reduced_14: 0.14,  // 14% - transport, certain food
  reduced_10: 0.10,  // 10% - hospitality, certain goods
  reduced_7: 0.07,   // 7% - basic necessities
  exempt: 0,         // 0% - medical acts (some are exempt)
} as const;

export type TVARate = keyof typeof TVA_RATES;

export interface TVABreakdown {
  /** Amount before tax */
  amountHT: number;
  /** TVA amount */
  tvaAmount: number;
  /** Total amount including tax */
  amountTTC: number;
  /** TVA rate applied */
  tvaRate: number;
  /** TVA rate label */
  tvaRateLabel: string;
}

/**
 * Calculate TVA breakdown from a price.
 * @param amount - The base amount (HT = Hors Taxe)
 * @param rate - TVA rate key (default: "standard" = 20%)
 * @param isAmountTTC - If true, amount is TTC (includes tax), calculate backwards
 */
export function calculateTVA(
  amount: number,
  rate: TVARate = "standard",
  isAmountTTC = false,
): TVABreakdown {
  const tvaRate = TVA_RATES[rate];
  const tvaRateLabel = `${(tvaRate * 100).toFixed(0)}%`;

  if (isAmountTTC) {
    const amountHT = Math.round((amount / (1 + tvaRate)) * 100) / 100;
    const tvaAmount = Math.round((amount - amountHT) * 100) / 100;
    return { amountHT, tvaAmount, amountTTC: amount, tvaRate, tvaRateLabel };
  }

  const tvaAmount = Math.round(amount * tvaRate * 100) / 100;
  const amountTTC = Math.round((amount + tvaAmount) * 100) / 100;
  return { amountHT: amount, tvaAmount, amountTTC, tvaRate, tvaRateLabel };
}

// ---- Currency Formatting ----

/**
 * Format amount in Moroccan Dirhams.
 * @param amount - numeric amount
 * @param options - formatting options
 */
export function formatMAD(
  amount: number,
  options?: { locale?: string; showCurrency?: boolean; decimals?: number },
): string {
  const locale = options?.locale ?? "fr-MA";
  const decimals = options?.decimals ?? 2;
  const showCurrency = options?.showCurrency ?? true;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return showCurrency ? `${formatted} MAD` : formatted;
}

/**
 * Format amount in Moroccan Dirhams with centimes.
 * e.g. "1 500,00 DH" (formal) or "1500 MAD" (informal)
 */
export function formatMADFormal(amount: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " DH";
}

// ---- Insurance Types ----

export type MoroccanInsuranceType = "cnss" | "cnops" | "amo" | "mutuelle" | "ramed" | "private" | "none";

export interface InsuranceProvider {
  id: string;
  type: MoroccanInsuranceType;
  name: string;
  nameFr: string;
  nameAr: string;
  coverageRate: number; // percentage covered (0-100)
  description: string;
}

export const INSURANCE_PROVIDERS: InsuranceProvider[] = [
  {
    id: "cnss",
    type: "cnss",
    name: "CNSS",
    nameFr: "Caisse Nationale de Sécurité Sociale",
    nameAr: "الصندوق الوطني للضمان الاجتماعي",
    coverageRate: 70,
    description: "Private sector employees mandatory health insurance",
  },
  {
    id: "cnops",
    type: "cnops",
    name: "CNOPS",
    nameFr: "Caisse Nationale des Organismes de Prévoyance Sociale",
    nameAr: "الصندوق الوطني لمنظمات الاحتياط الاجتماعي",
    coverageRate: 80,
    description: "Public sector employees health insurance",
  },
  {
    id: "amo",
    type: "amo",
    name: "AMO",
    nameFr: "Assurance Maladie Obligatoire",
    nameAr: "التأمين الإجباري عن المرض",
    coverageRate: 70,
    description: "Mandatory health insurance (covers both CNSS and CNOPS)",
  },
  {
    id: "ramed",
    type: "ramed",
    name: "RAMED",
    nameFr: "Régime d'Assistance Médicale",
    nameAr: "نظام المساعدة الطبية",
    coverageRate: 100,
    description: "Medical assistance for economically disadvantaged",
  },
  {
    id: "rma",
    type: "private",
    name: "RMA Watanya",
    nameFr: "RMA Watanya",
    nameAr: "آر إم أ وطنية",
    coverageRate: 80,
    description: "Private insurance - RMA Watanya",
  },
  {
    id: "saham",
    type: "private",
    name: "SAHAM Assurance",
    nameFr: "SAHAM Assurance",
    nameAr: "سهام للتأمين",
    coverageRate: 80,
    description: "Private insurance - SAHAM",
  },
  {
    id: "axa",
    type: "private",
    name: "AXA Assurance Maroc",
    nameFr: "AXA Assurance Maroc",
    nameAr: "أكسا للتأمين المغرب",
    coverageRate: 85,
    description: "Private insurance - AXA Morocco",
  },
  {
    id: "wafa",
    type: "private",
    name: "Wafa Assurance",
    nameFr: "Wafa Assurance",
    nameAr: "وفا للتأمين",
    coverageRate: 80,
    description: "Private insurance - Wafa Assurance",
  },
  {
    id: "atlanta",
    type: "private",
    name: "Atlanta Assurance",
    nameFr: "Atlanta Assurance",
    nameAr: "أتلانتا للتأمين",
    coverageRate: 75,
    description: "Private insurance - Atlanta",
  },
  {
    id: "mamda",
    type: "private",
    name: "MAMDA",
    nameFr: "Mutuelle Agricole Marocaine d'Assurances",
    nameAr: "التعاضدية المغربية للتأمين الفلاحي",
    coverageRate: 70,
    description: "Agricultural mutual insurance - MAMDA",
  },
];

export interface MutuelleInfo {
  name: string;
  registrationNumber: string;
  coverageRate: number; // additional coverage on top of base insurance
}

export interface PatientInsurance {
  primaryInsurance: MoroccanInsuranceType;
  primaryInsuranceId: string;
  affiliationNumber: string;
  mutuelle?: MutuelleInfo;
  expiryDate?: string;
}

/**
 * Calculate the patient's out-of-pocket cost (reste à charge).
 * Takes into account primary insurance + optional mutuelle.
 */
export function calculateResteACharge(
  totalAmount: number,
  insurance: PatientInsurance,
): {
  totalAmount: number;
  insuranceCovered: number;
  mutuelleCovered: number;
  resteACharge: number;
  coverageBreakdown: string;
} {
  const provider = INSURANCE_PROVIDERS.find((p) => p.id === insurance.primaryInsuranceId);
  const primaryRate = provider?.coverageRate ?? 0;
  const insuranceCovered = Math.round(totalAmount * (primaryRate / 100) * 100) / 100;

  let mutuelleCovered = 0;
  if (insurance.mutuelle) {
    const remaining = totalAmount - insuranceCovered;
    mutuelleCovered = Math.round(remaining * (insurance.mutuelle.coverageRate / 100) * 100) / 100;
  }

  const resteACharge = Math.round((totalAmount - insuranceCovered - mutuelleCovered) * 100) / 100;

  const parts: string[] = [];
  if (insuranceCovered > 0) parts.push(`${provider?.name ?? "Assurance"}: ${primaryRate}%`);
  if (mutuelleCovered > 0) parts.push(`Mutuelle: ${insurance.mutuelle?.coverageRate}%`);
  const coverageBreakdown = parts.join(" + ");

  return {
    totalAmount,
    insuranceCovered,
    mutuelleCovered,
    resteACharge: Math.max(0, resteACharge),
    coverageBreakdown,
  };
}

// ---- Payment Methods ----

export type MoroccanPaymentMethod =
  | "cash"
  | "cmi"           // CMI card payment
  | "cashplus"      // CashPlus mobile money
  | "wafacash"      // Wafacash transfer
  | "baridbank"     // Barid Bank / Al Barid
  | "bank_transfer" // Virement bancaire
  | "check"         // Chèque
  | "insurance"     // Direct insurance payment
  | "online";       // Online (generic)

export interface PaymentMethodInfo {
  id: MoroccanPaymentMethod;
  name: string;
  nameFr: string;
  nameAr: string;
  icon: string; // Lucide icon name
  description: string;
  requiresReference: boolean;
  isOnline: boolean;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    id: "cash",
    name: "Cash",
    nameFr: "Espèces",
    nameAr: "نقدا",
    icon: "Banknote",
    description: "Payment in cash at the clinic",
    requiresReference: false,
    isOnline: false,
  },
  {
    id: "cmi",
    name: "CMI Card",
    nameFr: "Carte CMI",
    nameAr: "بطاقة CMI",
    icon: "CreditCard",
    description: "CMI payment gateway - Moroccan card network",
    requiresReference: true,
    isOnline: true,
  },
  {
    id: "cashplus",
    name: "CashPlus",
    nameFr: "CashPlus",
    nameAr: "كاش بلوس",
    icon: "Smartphone",
    description: "CashPlus mobile money or deposit point",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "wafacash",
    name: "Wafacash",
    nameFr: "Wafacash",
    nameAr: "وفاكاش",
    icon: "Wallet",
    description: "Wafacash money transfer",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "baridbank",
    name: "Barid Bank",
    nameFr: "Barid Bank / Al Barid",
    nameAr: "بريد بنك",
    icon: "Building2",
    description: "Barid Bank transfer or Al Barid Cash deposit",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "bank_transfer",
    name: "Bank Transfer",
    nameFr: "Virement bancaire",
    nameAr: "تحويل بنكي",
    icon: "ArrowRightLeft",
    description: "Standard bank wire transfer",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "check",
    name: "Check",
    nameFr: "Chèque",
    nameAr: "شيك",
    icon: "FileText",
    description: "Payment by check",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "insurance",
    name: "Insurance",
    nameFr: "Tiers payant",
    nameAr: "التأمين",
    icon: "Shield",
    description: "Direct payment by insurance (tiers payant)",
    requiresReference: true,
    isOnline: false,
  },
  {
    id: "online",
    name: "Online Payment",
    nameFr: "Paiement en ligne",
    nameAr: "الدفع عبر الإنترنت",
    icon: "Globe",
    description: "Online payment via website",
    requiresReference: true,
    isOnline: true,
  },
];

// ---- Ramadan Mode ----

export interface RamadanConfig {
  enabled: boolean;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  workingHours: Record<number, { open: string; close: string; enabled: boolean }>;
}

/**
 * Default Ramadan working hours for Moroccan clinics.
 * Typically 9:00-15:00 (shorter days, no lunch break).
 */
export const DEFAULT_RAMADAN_HOURS: Record<number, { open: string; close: string; enabled: boolean }> = {
  0: { open: "09:00", close: "15:00", enabled: false }, // Sunday
  1: { open: "09:00", close: "15:00", enabled: true },  // Monday
  2: { open: "09:00", close: "15:00", enabled: true },
  3: { open: "09:00", close: "15:00", enabled: true },
  4: { open: "09:00", close: "15:00", enabled: true },
  5: { open: "09:00", close: "15:00", enabled: true },
  6: { open: "09:00", close: "13:00", enabled: true },  // Saturday
};

/**
 * Check if a given date falls within Ramadan period.
 */
export function isRamadanPeriod(date: Date, config: RamadanConfig): boolean {
  if (!config.enabled) return false;
  const d = date.toISOString().split("T")[0];
  return d >= config.startDate && d <= config.endDate;
}

/**
 * Get the effective working hours for a given date.
 * Returns Ramadan hours if within Ramadan period, otherwise regular hours.
 */
export function getEffectiveWorkingHours(
  date: Date,
  regularHours: Record<number, { open: string; close: string; enabled: boolean }>,
  ramadanConfig?: RamadanConfig,
): { open: string; close: string; enabled: boolean } {
  const dayOfWeek = date.getDay();
  if (ramadanConfig && isRamadanPeriod(date, ramadanConfig)) {
    return ramadanConfig.workingHours[dayOfWeek] ?? DEFAULT_RAMADAN_HOURS[dayOfWeek];
  }
  return regularHours[dayOfWeek] ?? { open: "09:00", close: "17:00", enabled: false };
}

// ---- Installment Payments (Tqsit) ----

export interface InstallmentPayment {
  /** Payment number (1-based) */
  number: number;
  /** Amount for this payment */
  amount: number;
  /** Due date ISO string */
  dueDate: string;
  /** Payment status */
  status: "pending" | "paid" | "overdue";
}

export interface InstallmentPlan {
  /** Total amount to be paid */
  totalAmount: number;
  /** Number of installments */
  numberOfPayments: number;
  /** Amount per installment */
  amountPerPayment: number;
  /** Remaining amount (rounding adjustment on last payment) */
  lastPaymentAdjustment: number;
  /** Payment schedule */
  schedule: InstallmentPayment[];
}

/**
 * Calculate an installment payment plan.
 * Splits total amount into equal monthly payments.
 * Any rounding remainder is added to the last payment.
 *
 * @param totalAmount - Total amount to split
 * @param numberOfPayments - Number of installments (2-12)
 * @param startDate - First payment date (defaults to today)
 */
export function calculateInstallments(
  totalAmount: number,
  numberOfPayments: number,
  startDate?: Date,
): InstallmentPlan {
  const count = Math.min(Math.max(numberOfPayments, 2), 12);
  const perPayment = Math.floor((totalAmount / count) * 100) / 100;
  const lastAdjustment = Math.round((totalAmount - perPayment * count) * 100) / 100;

  const start = startDate ?? new Date();
  const schedule: InstallmentPayment[] = [];

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    const amount = i === count - 1 ? perPayment + lastAdjustment : perPayment;

    schedule.push({
      number: i + 1,
      amount: Math.round(amount * 100) / 100,
      dueDate: dueDate.toISOString().split("T")[0],
      status: "pending",
    });
  }

  return {
    totalAmount,
    numberOfPayments: count,
    amountPerPayment: perPayment,
    lastPaymentAdjustment: lastAdjustment,
    schedule,
  };
}

// ---- Moroccan Cities ----

export const MOROCCAN_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir",
  "Meknès", "Oujda", "Kénitra", "Tétouan", "Salé", "Temara",
  "Safi", "Mohammedia", "El Jadida", "Béni Mellal", "Nador",
  "Taza", "Settat", "Berrechid", "Khouribga", "Khémisset",
  "Larache", "Guelmim", "Errachidia", "Ifrane",
] as const;

// ---- Garde / Astreinte Types ----

export type GardeType = "garde" | "astreinte";

export interface GardeScheduleEntry {
  id: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: GardeType;
  notes?: string;
}

// ---- Multi-Cabinet ----

export interface CabinetLocation {
  id: string;
  clinicId: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isDefault: boolean;
  workingDays: number[]; // 0-6
}
