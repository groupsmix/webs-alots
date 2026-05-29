/**
 * Clinical Encounter Types
 *
 * Adapted from ECC healthcare-emr-patterns skill.
 * Single-page encounter flow: complaint → exam → diagnosis → prescription → sign.
 * Locked encounter pattern: no edits after sign, addendum only.
 */

export type EncounterStatus = "in_progress" | "signed" | "addendum";

export interface EncounterVitals {
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  supplementalOxygen?: boolean;
  weight?: number;
  height?: number;
  consciousness?: "alert" | "voice" | "pain" | "unresponsive";
}

export interface EncounterMedication {
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface ClinicalEncounter {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  appointmentId?: string;
  status: EncounterStatus;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  examination: string;
  vitals: EncounterVitals;
  diagnosis: string;
  icdCode?: string;
  medications: EncounterMedication[];
  investigations: string;
  plan: string;
  signedAt?: string;
  signedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterAddendum {
  id: string;
  encounterId: string;
  authorId: string;
  clinicId: string;
  content: string;
  createdAt: string;
}

export interface ClinicalTemplate {
  id: string;
  name: string;
  chips: string[];
  requiredFields: string[];
  redFlags: string[];
  icdSuggestions: string[];
}

export const CLINICAL_TEMPLATES: ClinicalTemplate[] = [
  {
    id: "chest-pain",
    name: "Douleur thoracique",
    chips: [
      "Substernal",
      "Irradiation bras gauche",
      "Oppressive",
      "À l'effort",
      "Au repos",
      "Palpitations",
    ],
    requiredFields: ["vitals", "examination", "diagnosis"],
    redFlags: ["Douleur thoracique oppressive substernal"],
    icdSuggestions: ["I20.9", "I21.9", "R07.9"],
  },
  {
    id: "dyspnea",
    name: "Dyspnée",
    chips: ["À l'effort", "Au repos", "Nocturne", "Orthopnée", "Sifflements", "Toux productive"],
    requiredFields: ["vitals", "examination"],
    redFlags: ["Dyspnée aiguë au repos"],
    icdSuggestions: ["J45.9", "J44.1", "I50.9"],
  },
  {
    id: "abdominal-pain",
    name: "Douleur abdominale",
    chips: [
      "Épigastrique",
      "Fosse iliaque droite",
      "Fosse iliaque gauche",
      "Diffuse",
      "Post-prandiale",
      "Nausées",
      "Vomissements",
    ],
    requiredFields: ["examination", "diagnosis"],
    redFlags: ["Défense abdominale", "Contracture"],
    icdSuggestions: ["K29.7", "K35.8", "R10.4"],
  },
  {
    id: "headache",
    name: "Céphalée",
    chips: [
      "Frontale",
      "Occipitale",
      "Unilatérale",
      "Pulsatile",
      "En casque",
      "Photophobie",
      "Nausées",
    ],
    requiredFields: ["examination"],
    redFlags: ["Céphalée brutale en coup de tonnerre", "Raideur de la nuque"],
    icdSuggestions: ["G43.9", "G44.1", "R51"],
  },
  {
    id: "fever",
    name: "Fièvre",
    chips: [
      "Frissons",
      "Sueurs nocturnes",
      "Asthénie",
      "Myalgies",
      "Toux",
      "Brûlures mictionnelles",
    ],
    requiredFields: ["vitals", "examination"],
    redFlags: ["Fièvre > 40°C", "Altération de conscience"],
    icdSuggestions: ["R50.9", "J06.9", "N39.0"],
  },
];
