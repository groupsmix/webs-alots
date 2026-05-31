/**
 * Help center content management.
 *
 * Provides context-sensitive help, searchable FAQ, and guided tours.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type HelpCategory =
  | "getting_started"
  | "appointments"
  | "patients"
  | "billing"
  | "settings"
  | "security"
  | "troubleshooting";

export type UserRoleFilter = "all" | "doctor" | "receptionist" | "clinic_admin" | "patient";

export interface HelpArticle {
  id: string;
  title: string;
  titleFr: string;
  category: HelpCategory;
  roles: UserRoleFilter[];
  content: string;
  contentFr: string;
  keywords: string[];
  relatedArticles: string[];
}

export interface FAQEntry {
  id: string;
  question: string;
  questionFr: string;
  answer: string;
  answerFr: string;
  category: HelpCategory;
  roles: UserRoleFilter[];
}

export interface SearchResult {
  article: HelpArticle | FAQEntry;
  score: number;
  type: "article" | "faq";
}

// ─── Content Database ────────────────────────────────────────────────────────

export const FAQ_ENTRIES: FAQEntry[] = [
  {
    id: "faq-cancel-appointment",
    question: "How do I cancel an appointment?",
    questionFr: "Comment annuler un rendez-vous ?",
    answer:
      "Navigate to the appointment in your calendar, click it, and select 'Cancel'. You can provide a reason. Patients will be notified via WhatsApp.",
    answerFr:
      "Naviguez vers le rendez-vous dans votre calendrier, cliquez dessus et sélectionnez 'Annuler'. Vous pouvez fournir une raison. Les patients seront notifiés par WhatsApp.",
    category: "appointments",
    roles: ["all"],
  },
  {
    id: "faq-add-doctor",
    question: "How do I add a new doctor to my clinic?",
    questionFr: "Comment ajouter un nouveau médecin à ma clinique ?",
    answer:
      "Go to Settings → Staff Management → Invite. Enter the doctor's email and select the 'doctor' role. They'll receive an invitation to join.",
    answerFr:
      "Allez dans Paramètres → Gestion du personnel → Inviter. Entrez l'email du médecin et sélectionnez le rôle 'médecin'. Ils recevront une invitation.",
    category: "settings",
    roles: ["clinic_admin"],
  },
  {
    id: "faq-payment-methods",
    question: "What payment methods are supported?",
    questionFr: "Quels modes de paiement sont acceptés ?",
    answer:
      "Oltigo supports cash, bank transfer (virement), CMI online payment, and Stripe for international cards. Configure in Settings → Payments.",
    answerFr:
      "Oltigo accepte les espèces, le virement bancaire, le paiement en ligne CMI, et Stripe pour les cartes internationales. Configurez dans Paramètres → Paiements.",
    category: "billing",
    roles: ["clinic_admin", "receptionist"],
  },
  {
    id: "faq-patient-records",
    question: "How long are patient records retained?",
    questionFr: "Combien de temps les dossiers patients sont-ils conservés ?",
    answer:
      "Medical records are retained for 20 years as required by Moroccan healthcare regulations. Administrative records are kept for 10 years.",
    answerFr:
      "Les dossiers médicaux sont conservés pendant 20 ans conformément à la réglementation marocaine. Les dossiers administratifs sont conservés 10 ans.",
    category: "security",
    roles: ["all"],
  },
  {
    id: "faq-export-data",
    question: "Can I export my clinic's data?",
    questionFr: "Puis-je exporter les données de ma clinique ?",
    answer:
      "Yes, go to Settings → Data Management → Export. You can export appointments, patients, and financial data in CSV or PDF format.",
    answerFr:
      "Oui, allez dans Paramètres → Gestion des données → Export. Vous pouvez exporter les rendez-vous, patients et données financières en CSV ou PDF.",
    category: "settings",
    roles: ["clinic_admin"],
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "guide-first-setup",
    title: "Setting Up Your Clinic",
    titleFr: "Configuration de votre clinique",
    category: "getting_started",
    roles: ["clinic_admin"],
    content:
      "Follow the onboarding wizard to configure your clinic profile, working hours, and staff.",
    contentFr:
      "Suivez l'assistant d'onboarding pour configurer le profil de votre clinique, les horaires de travail et le personnel.",
    keywords: ["setup", "configure", "onboarding", "start"],
    relatedArticles: ["guide-staff-management"],
  },
  {
    id: "guide-staff-management",
    title: "Managing Staff Members",
    titleFr: "Gestion du personnel",
    category: "settings",
    roles: ["clinic_admin"],
    content:
      "Add doctors, receptionists, and other staff. Assign roles and manage permissions from Settings → Staff.",
    contentFr:
      "Ajoutez des médecins, réceptionnistes et autres membres. Assignez les rôles et gérez les permissions depuis Paramètres → Personnel.",
    keywords: ["staff", "team", "invite", "roles", "permissions"],
    relatedArticles: ["guide-first-setup"],
  },
];

// ─── Implementation ──────────────────────────────────────────────────────────

export function searchHelp(query: string, role?: UserRoleFilter): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const results: SearchResult[] = [];
  const queryTerms = normalizedQuery.split(/\s+/);

  for (const article of HELP_ARTICLES) {
    if (role && !article.roles.includes(role) && !article.roles.includes("all")) continue;

    const score = computeRelevance(queryTerms, [
      article.title.toLowerCase(),
      article.titleFr.toLowerCase(),
      ...article.keywords,
      article.content.toLowerCase(),
    ]);

    if (score > 0) {
      results.push({ article, score, type: "article" });
    }
  }

  for (const faq of FAQ_ENTRIES) {
    if (role && !faq.roles.includes(role) && !faq.roles.includes("all")) continue;

    const score = computeRelevance(queryTerms, [
      faq.question.toLowerCase(),
      faq.questionFr.toLowerCase(),
      faq.answer.toLowerCase(),
    ]);

    if (score > 0) {
      results.push({ article: faq, score, type: "faq" });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}

export function getArticlesByCategory(
  category: HelpCategory,
  role?: UserRoleFilter,
): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => {
    if (a.category !== category) return false;
    if (role && !a.roles.includes(role) && !a.roles.includes("all")) return false;
    return true;
  });
}

export function getContextualHelp(path: string): HelpArticle | FAQEntry | null {
  if (path.includes("/appointments")) {
    return FAQ_ENTRIES.find((f) => f.category === "appointments") ?? null;
  }
  if (path.includes("/settings")) {
    return HELP_ARTICLES.find((a) => a.category === "settings") ?? null;
  }
  if (path.includes("/billing") || path.includes("/payments")) {
    return FAQ_ENTRIES.find((f) => f.category === "billing") ?? null;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeRelevance(queryTerms: string[], fields: string[]): number {
  let score = 0;
  const combined = fields.join(" ");

  for (const term of queryTerms) {
    if (combined.includes(term)) {
      score += 1;
      if (fields[0].includes(term)) score += 2;
    }
  }

  return score;
}
