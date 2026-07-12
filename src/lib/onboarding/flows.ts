export type ClinicSpecialty =
  | "general_medicine"
  | "dental"
  | "cardiology"
  | "pediatrics"
  | "pharmacy"
  | "dermatology"
  | "other";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  required: boolean;
  aiAssisted: boolean;
  nextStep: string | null;
  conditionalNext?: {
    condition: (data: Record<string, unknown>) => boolean;
    nextStep: string;
  }[];
}

const BASE_STEPS: OnboardingStep[] = [
  {
    id: "clinic_info",
    title: "Informations de la clinique",
    description: "Nom, adresse, téléphone, email",
    required: true,
    aiAssisted: true,
    nextStep: "specialty",
  },
  {
    id: "specialty",
    title: "Spécialité médicale",
    description: "Type de clinique et spécialités proposées",
    required: true,
    aiAssisted: false,
    nextStep: "legal_docs",
    conditionalNext: [
      { condition: (data) => data.specialty === "pharmacy", nextStep: "pharmacy_license" },
      { condition: (data) => data.specialty === "dental", nextStep: "dental_equipment" },
    ],
  },
  {
    id: "legal_docs",
    title: "Documents légaux",
    description: "Registre de commerce, CNSS contrat, autorisation d'exercice",
    required: true,
    aiAssisted: true,
    nextStep: "team_setup",
  },
  {
    id: "team_setup",
    title: "Équipe médicale",
    description: "Ajouter les médecins et le personnel",
    required: true,
    aiAssisted: false,
    nextStep: "insurance_setup",
  },
  {
    id: "insurance_setup",
    title: "Configuration assurances",
    description: "CNSS, CNOPS, RAMED, mutuelles acceptées",
    required: true,
    aiAssisted: true,
    nextStep: "schedule_setup",
  },
  {
    id: "schedule_setup",
    title: "Horaires de la clinique",
    description: "Jours et heures d'ouverture, durée des consultations",
    required: true,
    aiAssisted: false,
    nextStep: "whatsapp_setup",
  },
  {
    id: "whatsapp_setup",
    title: "WhatsApp Business",
    description: "Connexion numéro WhatsApp pour les rappels patients",
    required: false,
    aiAssisted: false,
    nextStep: "go_live",
  },
  {
    id: "go_live",
    title: "Mise en ligne 🎉",
    description: "Votre clinique est prête",
    required: true,
    aiAssisted: true,
    nextStep: null,
  },
];

const SPECIALTY_STEPS: Partial<Record<ClinicSpecialty, OnboardingStep[]>> = {
  pharmacy: [
    {
      id: "pharmacy_license",
      title: "Autorisation pharmaceutique",
      description: "Numéro d'autorisation d'exploitation de pharmacie",
      required: true,
      aiAssisted: true,
      nextStep: "legal_docs",
    },
  ],
  dental: [
    {
      id: "dental_equipment",
      title: "Équipements dentaires",
      description: "Types de soins et équipements disponibles",
      required: false,
      aiAssisted: false,
      nextStep: "legal_docs",
    },
  ],
};

function getOnboardingFlow(specialty?: ClinicSpecialty): OnboardingStep[] {
  const extra = specialty ? (SPECIALTY_STEPS[specialty] ?? []) : [];
  return [...extra, ...BASE_STEPS];
}

export function getOnboardingProgress(
  completedStepIds: string[],
  specialty?: ClinicSpecialty,
): { completed: number; total: number; percentage: number; nextStep: OnboardingStep | null } {
  const flow = getOnboardingFlow(specialty);
  const completedSet = new Set(completedStepIds);
  const completed = flow.filter((step) => completedSet.has(step.id)).length;
  const total = flow.length;
  const nextStep = flow.find((step) => !completedSet.has(step.id)) ?? null;
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextStep,
  };
}
