/**
 * Wait Time Predictor Algorithm.
 *
 * Estimates real-time waiting room times by combining static appointment 
 * duration averages with real-time queue data (number of patients currently
 * waiting, delays in current consultations, walk-ins).
 */

export interface QueueState {
  currentConsultationStartTime?: string; // ISO date string
  patientsInQueue: number;
  walkInsInQueue: number;
  averageConsultationDurationMinutes: number;
  doctorDelayMinutes: number; // e.g., if doctor started late or previous consultations ran long
}

export interface WaitTimeEstimate {
  estimatedMinutes: number;
  timeRange: { min: number; max: number };
  status: "on-time" | "delayed" | "severely-delayed";
  explanation: { fr: string; ar: string };
}

/**
 * Predicts the wait time for a patient newly arriving at the clinic,
 * or checks the estimated remaining time for a patient already in queue.
 *
 * @param state Current real-time queue state of the clinic
 * @param positionInQueue 0 for next, 1 for second, etc. (defaults to end of queue)
 */
export function predictWaitTime(
  state: QueueState,
  positionInQueue?: number
): WaitTimeEstimate {
  // If no position provided, assume patient is at the end of the line
  const effectivePosition = positionInQueue !== undefined 
    ? positionInQueue 
    : state.patientsInQueue + state.walkInsInQueue;

  // Base calculation: number of people ahead * average duration
  let baseEstimate = effectivePosition * state.averageConsultationDurationMinutes;

  // Add the time remaining for the *current* consultation
  if (state.currentConsultationStartTime) {
    const currentStart = new Date(state.currentConsultationStartTime).getTime();
    const now = new Date().getTime();
    const elapsedMinutes = (now - currentStart) / (1000 * 60);
    
    if (elapsedMinutes < state.averageConsultationDurationMinutes) {
      // Add the remaining expected time of current consultation
      baseEstimate += (state.averageConsultationDurationMinutes - elapsedMinutes);
    } else {
      // Current consultation is running overtime. Add a penalty buffer.
      baseEstimate += 5; // Assume it will wrap up in ~5 mins
    }
  }

  // Add general delays (doctor started late, systematic delays today)
  baseEstimate += state.doctorDelayMinutes;

  // Floor at 0
  const estimatedMinutes = Math.max(0, Math.round(baseEstimate));

  // Calculate range (± 15% or ± 5 mins, whichever is larger)
  const variance = Math.max(5, Math.round(estimatedMinutes * 0.15));
  const min = Math.max(0, estimatedMinutes - variance);
  const max = estimatedMinutes + variance;

  // Determine status
  let status: "on-time" | "delayed" | "severely-delayed" = "on-time";
  let explanation = {
    fr: "Consultations à l'heure.",
    ar: "الاستشارات في موعدها."
  };

  if (state.doctorDelayMinutes > 30 || estimatedMinutes > 60) {
    status = "severely-delayed";
    explanation = {
      fr: "Retard important en raison d'urgences ou consultations prolongées.",
      ar: "تأخير كبير بسبب حالات الطوارئ أو الاستشارات المطولة."
    };
  } else if (state.doctorDelayMinutes > 10 || state.walkInsInQueue > 0) {
    status = "delayed";
    explanation = {
      fr: "Léger retard dû à l'affluence en salle d'attente.",
      ar: "تأخير طفيف بسبب الازدحام في غرفة الانتظار."
    };
  }

  return {
    estimatedMinutes,
    timeRange: { min, max },
    status,
    explanation
  };
}
