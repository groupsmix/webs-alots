/**
 * Staff Schedule Optimization.
 *
 * Analyzes historical appointment volume by day and hour to suggest
 * optimal staffing levels (receptionists, assistants) to minimize
 * wait times while reducing unnecessary labor costs.
 */

export interface HourlyVolume {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number; // 0-23
  averagePatients: number;
  currentStaff: number;
}

export interface StaffSuggestion {
  dayOfWeek: number;
  hour: number;
  suggestedStaff: number;
  reasoning: { fr: string; ar: string };
  status: "optimal" | "overstaffed" | "understaffed";
  costSavings: number; // Estimated MAD saved or needed per hour
}

export interface OptimizationResult {
  suggestions: StaffSuggestion[];
  totalWeeklySavings: number;
  criticalUnderstaffedHours: number;
}

// ── Configuration ────────────────────────────────────────────────────────────

// Assumptions for the Moroccan context
const PATIENTS_PER_STAFF_HOUR = 4; // A receptionist/assistant can handle ~4 patients/hour optimally
const HOURLY_STAFF_COST = 25; // Average hourly wage in MAD for front-desk/assistant staff

// ── Algorithm ────────────────────────────────────────────────────────────────

export function optimizeStaffSchedule(historicalVolume: HourlyVolume[]): OptimizationResult {
  const suggestions: StaffSuggestion[] = [];
  let totalWeeklySavings = 0;
  let criticalUnderstaffedHours = 0;

  for (const slot of historicalVolume) {
    // We need at least 1 staff member if there are any patients, otherwise 0
    const requiredStaff =
      slot.averagePatients > 0
        ? Math.max(1, Math.ceil(slot.averagePatients / PATIENTS_PER_STAFF_HOUR))
        : 0;

    let status: "optimal" | "overstaffed" | "understaffed" = "optimal";
    let costSavings = 0;
    let reasoning = {
      fr: "Effectif optimal pour le volume actuel.",
      ar: "عدد الموظفين مثالي لحجم العمل الحالي.",
    };

    if (slot.currentStaff > requiredStaff) {
      status = "overstaffed";
      const excess = slot.currentStaff - requiredStaff;
      costSavings = excess * HOURLY_STAFF_COST;
      totalWeeklySavings += costSavings;

      reasoning = {
        fr: `Surcapacité : ${slot.currentStaff} employés pour en moyenne ${slot.averagePatients.toFixed(1)} patients. Vous pouvez réduire de ${excess} personne(s).`,
        ar: `فائض في الموظفين: ${slot.currentStaff} موظف لمتوسط ${slot.averagePatients.toFixed(1)} مريض. يمكنك تقليل ${excess} شخص.`,
      };
    } else if (slot.currentStaff < requiredStaff) {
      status = "understaffed";
      const deficit = requiredStaff - slot.currentStaff;
      costSavings = -(deficit * HOURLY_STAFF_COST); // Negative savings = cost to fix

      if (
        deficit >= 2 ||
        slot.averagePatients / Math.max(1, slot.currentStaff) > PATIENTS_PER_STAFF_HOUR * 1.5
      ) {
        criticalUnderstaffedHours++;
        reasoning = {
          fr: `Sous-effectif critique ! Risque de temps d'attente élevé. Ajoutez ${deficit} personne(s).`,
          ar: `نقص حاد في الموظفين! خطر زيادة وقت الانتظار. أضف ${deficit} شخص.`,
        };
      } else {
        reasoning = {
          fr: `Sous-effectif léger. Considérez l'ajout de ${deficit} personne(s) en renfort.`,
          ar: `نقص طفيف في الموظفين. فكر في إضافة ${deficit} شخص كدعم.`,
        };
      }
    }

    // Only add to suggestions if there's an action to take
    if (status !== "optimal") {
      suggestions.push({
        dayOfWeek: slot.dayOfWeek,
        hour: slot.hour,
        suggestedStaff: requiredStaff,
        status,
        reasoning,
        costSavings,
      });
    }
  }

  // Sort suggestions by biggest impact (most understaffed first, then most overstaffed)
  suggestions.sort((a, b) => {
    if (a.status === "understaffed" && b.status !== "understaffed") return -1;
    if (b.status === "understaffed" && a.status !== "understaffed") return 1;
    return Math.abs(b.costSavings) - Math.abs(a.costSavings);
  });

  return {
    suggestions,
    totalWeeklySavings,
    criticalUnderstaffedHours,
  };
}
