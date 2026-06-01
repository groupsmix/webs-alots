import { type AvailableSlot } from "@/lib/scheduling/availability";

export interface PatientPreferences {
  preferredDaysOfWeek: number[]; // e.g., [1, 3] for Monday, Wednesday
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  isUrgent: boolean;
}

export interface ScoredSlot extends AvailableSlot {
  score: number;
  matchReasons: { fr: string; ar: string }[];
}

/**
 * Scores a list of available slots based on a patient's historical or explicit preferences.
 */
export function suggestSmartSlots(
  availableSlots: AvailableSlot[],
  preferences: PatientPreferences,
  limit: number = 3
): ScoredSlot[] {
  const scoredSlots: ScoredSlot[] = [];

  for (const slot of availableSlots) {
    let score = 0;
    const matchReasons: { fr: string; ar: string }[] = [];
    const date = new Date(slot.start);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    
    // 1. Urgency: If urgent, prioritize the soonest available slots heavily
    if (preferences.isUrgent) {
      const now = new Date();
      const daysAway = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAway < 1) {
        score += 100;
        matchReasons.push({ fr: "Créneau le plus proche", ar: "أقرب موعد متاح" });
      } else if (daysAway < 3) {
        score += 50;
      }
      // Decay score slightly over time so sooner is always better within the same bracket
      score -= daysAway; 
    }

    // 2. Day of Week match
    if (preferences.preferredDaysOfWeek.includes(dayOfWeek)) {
      score += 40;
      const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      matchReasons.push({ 
        fr: `Correspond à votre jour préféré (${dayNames[dayOfWeek]})`,
        ar: `يطابق يومك المفضل (${dayNamesAr[dayOfWeek]})`
      });
    }

    // 3. Time of Day match
    let timeMatch = false;
    if (preferences.preferredTimeOfDay === "morning" && hour < 12) {
      timeMatch = true;
      matchReasons.push({ fr: "Matin", ar: "صباحاً" });
    } else if (preferences.preferredTimeOfDay === "afternoon" && hour >= 12 && hour < 17) {
      timeMatch = true;
      matchReasons.push({ fr: "Après-midi", ar: "بعد الظهر" });
    } else if (preferences.preferredTimeOfDay === "evening" && hour >= 17) {
      timeMatch = true;
      matchReasons.push({ fr: "Soirée", ar: "مساءً" });
    }

    if (timeMatch) {
      score += 30;
    }

    scoredSlots.push({ ...slot, score, matchReasons });
  }

  // Sort by score descending, then by date ascending (sooner is better if scores tie)
  scoredSlots.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  return scoredSlots.slice(0, limit);
}
