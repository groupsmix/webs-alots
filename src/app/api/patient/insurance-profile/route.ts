import { NextRequest } from "next/server";
import { apiError, apiSuccess, apiValidationError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/with-auth";
import type { AuthContext } from "@/lib/with-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseUntyped = { from(table: string): any };

type InsuranceType = "cnss" | "cnops" | "amo" | "ramed" | "private" | "none";

interface InsuranceProfile {
  insuranceType: InsuranceType;
  membershipNumber: string | null;
  coveragePercentage: number;
  requiresPreApproval: boolean;
  formTemplate: string;
  copayEstimate: number;
  notes: string[];
}

const INSURANCE_CONFIGS: Record<
  InsuranceType,
  {
    coveragePercentage: number;
    requiresPreApproval: boolean;
    formTemplate: string;
    copayBase: number;
    notesFr: string[];
    notesAr: string[];
  }
> = {
  cnss: {
    coveragePercentage: 70,
    requiresPreApproval: false,
    formTemplate: "cnss_feuille_soin",
    copayBase: 30,
    notesFr: [
      "Feuille de soins CNSS obligatoire",
      "Le patient paie 30% du tarif conventionné",
      "Médicaments: remboursement sur liste CNSS uniquement",
      "Délai de remboursement: 2-4 semaines",
    ],
    notesAr: [
      "ورقة العلاج CNSS إلزامية",
      "يدفع المريض 30% من التعرفة المتفق عليها",
      "الأدوية: استرداد فقط حسب قائمة CNSS",
      "مدة الاسترداد: 2-4 أسابيع",
    ],
  },
  cnops: {
    coveragePercentage: 80,
    requiresPreApproval: false,
    formTemplate: "cnops_feuille_soin",
    copayBase: 20,
    notesFr: [
      "Feuille de soins CNOPS à remplir",
      "Le patient paie 20% du tarif",
      "Prise en charge directe possible dans les cliniques conventionnées",
      "Carte CNOPS à vérifier avant consultation",
    ],
    notesAr: [
      "ملء ورقة العلاج CNOPS",
      "يدفع المريض 20% من التعرفة",
      "إمكانية التكفل المباشر في العيادات المتعاقدة",
      "التحقق من بطاقة CNOPS قبل الاستشارة",
    ],
  },
  amo: {
    coveragePercentage: 70,
    requiresPreApproval: true,
    formTemplate: "amo_prise_en_charge",
    copayBase: 30,
    notesFr: [
      "Accord préalable requis pour hospitalisation et actes lourds",
      "Tiers payant possible avec convention",
      "Vérifier la validité de la carte AMO",
      "Plafond annuel applicable — vérifier le solde restant",
    ],
    notesAr: [
      "موافقة مسبقة مطلوبة للاستشفاء والعمليات الكبيرة",
      "الدفع المباشر ممكن مع الاتفاقية",
      "التحقق من صلاحية بطاقة AMO",
      "سقف سنوي قابل للتطبيق — التحقق من الرصيد المتبقي",
    ],
  },
  ramed: {
    coveragePercentage: 100,
    requiresPreApproval: true,
    formTemplate: "ramed_attestation",
    copayBase: 0,
    notesFr: [
      "RAMED couvre uniquement les hôpitaux publics",
      "Carte RAMED valide obligatoire",
      "Pas de prise en charge dans le privé sauf urgence",
      "Renouvellement annuel de la carte à vérifier",
    ],
    notesAr: [
      "RAMED يغطي فقط المستشفيات العمومية",
      "بطاقة RAMED صالحة إلزامية",
      "لا تكفل في القطاع الخاص إلا في حالات الطوارئ",
      "التحقق من تجديد البطاقة السنوي",
    ],
  },
  private: {
    coveragePercentage: 80,
    requiresPreApproval: true,
    formTemplate: "private_claim_form",
    copayBase: 20,
    notesFr: [
      "Vérifier les conditions de la police d'assurance",
      "Accord préalable souvent requis pour hospitalisation",
      "Plafond et exclusions selon le contrat",
      "Demander une copie de la carte d'assurance",
    ],
    notesAr: [
      "التحقق من شروط بوليصة التأمين",
      "موافقة مسبقة مطلوبة غالباً للاستشفاء",
      "سقف واستثناءات حسب العقد",
      "طلب نسخة من بطاقة التأمين",
    ],
  },
  none: {
    coveragePercentage: 0,
    requiresPreApproval: false,
    formTemplate: "cash_receipt",
    copayBase: 100,
    notesFr: [
      "Patient sans couverture — paiement intégral",
      "Proposer un reçu/facture pour chaque consultation",
      "Possibilité de facilités de paiement",
      "Orienter vers l'inscription RAMED si éligible",
    ],
    notesAr: [
      "مريض بدون تغطية — الدفع الكامل",
      "تقديم إيصال/فاتورة لكل استشارة",
      "إمكانية تسهيلات الدفع",
      "توجيه للتسجيل في RAMED إذا كان مؤهلاً",
    ],
  },
};

/**
 * GET /api/patient/insurance-profile?patient_id=xxx
 * Returns the insurance profile for a patient.
 */
async function handleGet(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with this account", 403);
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patient_id");
  const language = url.searchParams.get("language") ?? "fr";

  if (!patientId) {
    return apiValidationError("patient_id is required");
  }

  try {
    const sb = auth.supabase as unknown as SupabaseUntyped;
    const { data: patient, error } = await sb
      .from("patients")
      .select("id, insurance_type, insurance_number")
      .eq("clinic_id", clinicId)
      .eq("id", patientId)
      .single();

    if (error || !patient) {
      return apiError("Patient not found", 404);
    }

    const insuranceType = (patient.insurance_type as InsuranceType) ?? "none";
    const config = INSURANCE_CONFIGS[insuranceType] ?? INSURANCE_CONFIGS.none;

    const profile: InsuranceProfile = {
      insuranceType,
      membershipNumber: patient.insurance_number as string | null,
      coveragePercentage: config.coveragePercentage,
      requiresPreApproval: config.requiresPreApproval,
      formTemplate: config.formTemplate,
      copayEstimate: config.copayBase,
      notes: language === "ar" ? config.notesAr : config.notesFr,
    };

    return apiSuccess({ profile });
  } catch (err) {
    logger.error("Insurance profile fetch failed", {
      context: "insurance-profile",
      error: err instanceof Error ? err.message : String(err),
      clinicId,
    });
    return apiError("Failed to fetch insurance profile", 500);
  }
}

/**
 * POST /api/patient/insurance-profile
 * Updates a patient's insurance type and number.
 */
async function handlePost(req: NextRequest, auth: AuthContext) {
  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic associated with this account", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiValidationError("Invalid JSON body");
  }

  const patientId = body.patientId as string | undefined;
  const insuranceType = body.insuranceType as string | undefined;
  const insuranceNumber = body.insuranceNumber as string | undefined;

  if (!patientId || typeof patientId !== "string") {
    return apiValidationError("patientId is required");
  }

  const validTypes: InsuranceType[] = ["cnss", "cnops", "amo", "ramed", "private", "none"];
  if (!insuranceType || !validTypes.includes(insuranceType as InsuranceType)) {
    return apiValidationError(`insuranceType must be one of: ${validTypes.join(", ")}`);
  }

  try {
    const sb = auth.supabase as unknown as SupabaseUntyped;
    const { error } = await sb
      .from("patients")
      .update({
        insurance_type: insuranceType,
        insurance_number: insuranceNumber ?? null,
      })
      .eq("clinic_id", clinicId)
      .eq("id", patientId);

    if (error) {
      logger.error("Insurance profile update failed", {
        context: "insurance-profile",
        error: error.message,
        clinicId,
        patientId,
      });
      return apiError("Failed to update insurance profile", 500);
    }

    const config = INSURANCE_CONFIGS[insuranceType as InsuranceType];

    return apiSuccess({
      updated: true,
      insuranceType,
      coveragePercentage: config.coveragePercentage,
      formTemplate: config.formTemplate,
    });
  } catch (err) {
    logger.error("Insurance profile update error", {
      context: "insurance-profile",
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Internal error", 500);
  }
}

export const GET = withAuth(handleGet, ["doctor", "clinic_admin", "receptionist"]);
export const POST = withAuth(handlePost, ["doctor", "clinic_admin", "receptionist"]);
