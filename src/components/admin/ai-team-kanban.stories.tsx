import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, type ReactNode } from "react";
import { AITeamKanban } from "./ai-team-kanban";
import type { TeamTask } from "./ai-team-kanban";

/**
 * Stubs `window.fetch` for the task-transition endpoint so the action buttons
 * (approve / request changes / cancel / retry) resolve successfully inside
 * Storybook instead of failing with "Erreur réseau" (there is no backend in
 * the preview). The original fetch is restored on unmount. This is intentionally
 * dependency-free rather than pulling in MSW.
 */
function MockTransitionApi({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/ai/team/tasks")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  return <>{children}</>;
}

const meta: Meta<typeof AITeamKanban> = {
  title: "Admin/AITeamKanban",
  component: AITeamKanban,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MockTransitionApi>
        <Story />
      </MockTransitionApi>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Kanban board for AI team tasks (Phase C3). " +
          "Displays durable tasks across 6 status columns with human override actions: " +
          "approve, request changes, cancel, retry. " +
          "Connects to `/api/ai/team/tasks/v2` for state transitions.",
      },
    },
  },
  argTypes: {
    onRefresh: { action: "refresh" },
  },
};

export default meta;
type Story = StoryObj<typeof AITeamKanban>;

// ── Shared timestamp helpers ──────────────────────────────────────────────────

const NOW = "2026-06-20T09:00:00.000Z";
const YESTERDAY = "2026-06-19T14:30:00.000Z";
const TWO_DAYS_AGO = "2026-06-18T10:15:00.000Z";

function makeHistoryEvent(
  type: string,
  actor: string,
  at: string,
  payload: Record<string, unknown> = {},
) {
  return { type, actor, at, payload };
}

// ── Mock task factory ─────────────────────────────────────────────────────────

function makeTask(
  overrides: Partial<TeamTask> & Pick<TeamTask, "id" | "title" | "status">,
): TeamTask {
  return {
    description: null,
    agent_type: "marketing",
    reviewer_agent_type: null,
    review_comments: null,
    review_cycles: 0,
    history_events: [],
    created_by: "user-admin-001",
    created_at: YESTERDAY,
    updated_at: YESTERDAY,
    ...overrides,
  };
}

// ── Full board — one or two tasks in every column ─────────────────────────────

const FULL_BOARD_TASKS: TeamTask[] = [
  // BACKLOG — 2 tasks
  makeTask({
    id: "task-001",
    title: "Rédiger campagne SMS de rappel vaccin grippe",
    description:
      "Préparer un message WhatsApp de rappel pour les patients adultes en vue de la campagne de vaccination antigrippale de novembre.",
    agent_type: "marketing",
    status: "backlog",
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
    ],
    created_at: TWO_DAYS_AGO,
    updated_at: TWO_DAYS_AGO,
  }),
  makeTask({
    id: "task-002",
    title: "Résumé hebdomadaire des tickets support",
    description:
      "Générer un rapport synthétique des 20 derniers tickets avec catégories et tendances.",
    agent_type: "support",
    status: "backlog",
    history_events: [
      makeHistoryEvent("created", "admin", YESTERDAY, { from: null, to: "backlog" }),
    ],
  }),

  // IN_PROGRESS — 2 tasks
  makeTask({
    id: "task-003",
    title: "Rédiger annonce Ramadan — horaires ajustés",
    description:
      "L'équipe a besoin d'une annonce patiente multicanale (WhatsApp + email) indiquant les horaires de la clinique pendant le Ramadan.",
    agent_type: "marketing",
    status: "in_progress",
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", YESTERDAY, { from: "backlog", to: "in_progress" }),
    ],
    updated_at: YESTERDAY,
  }),
  makeTask({
    id: "task-004",
    title: "Brouillon réponse FAQ — prise de rendez-vous en ligne",
    description:
      "Rédiger 5 réponses type pour les questions fréquentes sur la prise de RDV via l'application.",
    agent_type: "support",
    status: "in_progress",
    history_events: [
      makeHistoryEvent("created", "secretary-agent", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "secretary-agent", TWO_DAYS_AGO, {
        from: "backlog",
        to: "in_progress",
      }),
    ],
    updated_at: TWO_DAYS_AGO,
  }),

  // REVIEW — 2 tasks
  makeTask({
    id: "task-005",
    title: "Proposition de plan de fidélisation patients chroniques",
    description:
      "Identifier les patients avec ≥ 3 visites/an et proposer un programme de suivi personnalisé.",
    agent_type: "marketing",
    status: "review",
    reviewer_agent_type: "doctor",
    review_cycles: 1,
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", TWO_DAYS_AGO, { from: "backlog", to: "in_progress" }),
      makeHistoryEvent("transition", "marketing-agent", YESTERDAY, {
        from: "in_progress",
        to: "review",
      }),
    ],
    updated_at: YESTERDAY,
  }),
  makeTask({
    id: "task-006",
    title: "Texte d'accueil salle d'attente — écran digital",
    description:
      "Rédiger le contenu rotatif affiché sur l'écran de la salle d'attente : présentation services, conseils santé, rappels RDV.",
    agent_type: "marketing",
    status: "review",
    reviewer_agent_type: "clinic_admin",
    review_cycles: 0,
    history_events: [
      makeHistoryEvent("created", "receptionist-agent", YESTERDAY, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "receptionist-agent", YESTERDAY, {
        from: "backlog",
        to: "in_progress",
      }),
      makeHistoryEvent("transition", "marketing-agent", NOW, { from: "in_progress", to: "review" }),
    ],
    created_at: YESTERDAY,
    updated_at: NOW,
  }),

  // CHANGES_REQUESTED — 1 task
  makeTask({
    id: "task-007",
    title: "Message de rappel pré-opératoire",
    description:
      "WhatsApp envoyé J-1 avant une intervention : jeûne, documents à apporter, heure d'arrivée.",
    agent_type: "reminder",
    status: "changes_requested",
    reviewer_agent_type: "doctor",
    review_comments:
      "Le message doit préciser explicitement l'heure limite pour le jeûne (minuit la veille). Reformuler la mention des documents pour inclure les ordonnances récentes.",
    review_cycles: 1,
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", TWO_DAYS_AGO, { from: "backlog", to: "in_progress" }),
      makeHistoryEvent("transition", "reminder-agent", YESTERDAY, {
        from: "in_progress",
        to: "review",
      }),
      makeHistoryEvent("review", "doctor-agent", NOW, {
        from: "review",
        to: "changes_requested",
        comments: "Préciser heure du jeûne et liste des documents.",
      }),
    ],
    created_at: TWO_DAYS_AGO,
    updated_at: NOW,
  }),

  // DONE — 2 tasks
  makeTask({
    id: "task-008",
    title: "Rapport mensuel — résumé activité juin 2026",
    description: "Synthèse automatisée : consultations, revenus, taux de no-show, top services.",
    agent_type: "support",
    status: "done",
    reviewer_agent_type: "clinic_admin",
    review_cycles: 1,
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", TWO_DAYS_AGO, { from: "backlog", to: "in_progress" }),
      makeHistoryEvent("transition", "support-agent", YESTERDAY, {
        from: "in_progress",
        to: "review",
      }),
      makeHistoryEvent("approved", "clinic-admin-agent", NOW, { from: "review", to: "done" }),
    ],
    created_at: TWO_DAYS_AGO,
    updated_at: NOW,
  }),
  makeTask({
    id: "task-009",
    title: "Annonce ouverture nouveau service dermatologie",
    description:
      "Email + WhatsApp annonçant l'ouverture du service dermatologie et la disponibilité des premiers créneaux.",
    agent_type: "marketing",
    status: "done",
    review_cycles: 0,
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", YESTERDAY, { from: "backlog", to: "in_progress" }),
      makeHistoryEvent("transition", "marketing-agent", YESTERDAY, {
        from: "in_progress",
        to: "review",
      }),
      makeHistoryEvent("approved", "admin", NOW, { from: "review", to: "done" }),
    ],
    created_at: TWO_DAYS_AGO,
    updated_at: NOW,
  }),

  // CANCELLED — 1 task
  makeTask({
    id: "task-010",
    title: "Sondage satisfaction post-consultation — test A/B",
    description:
      "Test de deux versions d'un formulaire de satisfaction à envoyer 24h après chaque consultation.",
    agent_type: "support",
    status: "cancelled",
    history_events: [
      makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
      makeHistoryEvent("transition", "admin", YESTERDAY, { from: "backlog", to: "in_progress" }),
      makeHistoryEvent("cancelled", "admin", NOW, {
        from: "in_progress",
        to: "cancelled",
        reason: "Hors périmètre sprint",
      }),
    ],
    created_at: TWO_DAYS_AGO,
    updated_at: NOW,
  }),
];

// ── Stories ───────────────────────────────────────────────────────────────────

/**
 * Full board — all 6 columns populated.
 * Primary acceptance story for Phase C3.
 */
export const FullBoard: Story = {
  name: "Full Board (all columns)",
  args: {
    tasks: FULL_BOARD_TASKS,
  },
};

/**
 * Empty board — no tasks in any column.
 * Should render 6 empty columns with "Aucune tâche" placeholder.
 */
export const EmptyBoard: Story = {
  args: {
    tasks: [],
  },
};

/**
 * Review focus — tasks concentrated in review + changes_requested columns.
 * Tests the approve / request-changes action paths.
 */
export const ReviewPending: Story = {
  name: "Review Focus",
  args: {
    tasks: [
      makeTask({
        id: "rev-001",
        title: "Protocole de rappel post-opératoire — contenu médical",
        description:
          "Instructions post-op rédigées par l'agent — nécessite validation du médecin avant envoi aux patients.",
        agent_type: "reminder",
        status: "review",
        reviewer_agent_type: "doctor",
        review_cycles: 0,
        history_events: [
          makeHistoryEvent("created", "admin", YESTERDAY, { from: null, to: "backlog" }),
          makeHistoryEvent("transition", "reminder-agent", NOW, {
            from: "in_progress",
            to: "review",
          }),
        ],
        updated_at: NOW,
      }),
      makeTask({
        id: "rev-002",
        title: "Fiche info patient — hypertension artérielle",
        description: "Document éducatif pour les patients nouvellement diagnostiqués hypertendus.",
        agent_type: "support",
        status: "review",
        reviewer_agent_type: "doctor",
        review_cycles: 1,
        history_events: [
          makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
          makeHistoryEvent("transition", "support-agent", YESTERDAY, {
            from: "in_progress",
            to: "review",
          }),
          makeHistoryEvent("review", "doctor-agent", YESTERDAY, {
            from: "review",
            to: "changes_requested",
            comments: "Revoir la section sur le sel.",
          }),
          makeHistoryEvent("transition", "support-agent", NOW, {
            from: "changes_requested",
            to: "in_progress",
          }),
          makeHistoryEvent("transition", "support-agent", NOW, {
            from: "in_progress",
            to: "review",
          }),
        ],
        updated_at: NOW,
      }),
      makeTask({
        id: "rev-003",
        title: "Newsletter mensuelle — édition juillet",
        description: "Brouillon newsletter contenant conseils santé estivaux et rappels vaccins.",
        agent_type: "marketing",
        status: "changes_requested",
        reviewer_agent_type: "clinic_admin",
        review_comments:
          "Ajouter le numéro d'urgence de la clinique dans le footer. La section vaccins doit mentionner les tarifs CNSS.",
        review_cycles: 1,
        history_events: [
          makeHistoryEvent("created", "admin", TWO_DAYS_AGO, { from: null, to: "backlog" }),
          makeHistoryEvent("transition", "marketing-agent", YESTERDAY, {
            from: "in_progress",
            to: "review",
          }),
          makeHistoryEvent("review", "clinic-admin", NOW, {
            from: "review",
            to: "changes_requested",
          }),
        ],
        updated_at: NOW,
      }),
    ],
  },
};

/**
 * Escalation warning — a task that has exceeded the max review cycles.
 * The card should display the escalation warning badge.
 */
export const WithEscalation: Story = {
  name: "Review Cycle Escalation",
  args: {
    tasks: [
      makeTask({
        id: "esc-001",
        title: "Guide de prise en charge diabète type 2",
        description:
          "Document complet sur le suivi du patient diabétique : objectifs glycémiques, alimentation, activité physique, médicaments courants.",
        agent_type: "support",
        status: "changes_requested",
        reviewer_agent_type: "doctor",
        review_comments:
          "3ème révision : les valeurs cibles HbA1c sont correctes mais la section sur l'insulinothérapie doit être validée par un endocrinologue. Escalade humaine requise.",
        review_cycles: 3,
        history_events: [
          makeHistoryEvent("created", "admin", "2026-06-15T09:00:00.000Z", {
            from: null,
            to: "backlog",
          }),
          makeHistoryEvent("transition", "admin", "2026-06-15T09:05:00.000Z", {
            from: "backlog",
            to: "in_progress",
          }),
          makeHistoryEvent("transition", "support-agent", "2026-06-16T10:00:00.000Z", {
            from: "in_progress",
            to: "review",
          }),
          makeHistoryEvent("review", "doctor-agent", "2026-06-16T14:00:00.000Z", {
            from: "review",
            to: "changes_requested",
            comments: "Révision 1: corriger les unités glycémiques.",
          }),
          makeHistoryEvent("transition", "support-agent", "2026-06-17T09:00:00.000Z", {
            from: "changes_requested",
            to: "in_progress",
          }),
          makeHistoryEvent("transition", "support-agent", "2026-06-17T11:00:00.000Z", {
            from: "in_progress",
            to: "review",
          }),
          makeHistoryEvent("review", "doctor-agent", "2026-06-17T16:00:00.000Z", {
            from: "review",
            to: "changes_requested",
            comments: "Révision 2: revoir section activité physique.",
          }),
          makeHistoryEvent("transition", "support-agent", "2026-06-18T09:00:00.000Z", {
            from: "changes_requested",
            to: "in_progress",
          }),
          makeHistoryEvent("transition", "support-agent", "2026-06-18T11:30:00.000Z", {
            from: "in_progress",
            to: "review",
          }),
          makeHistoryEvent("review", "doctor-agent", "2026-06-19T10:00:00.000Z", {
            from: "review",
            to: "changes_requested",
            comments: "Révision 3: section insuline nécessite endocrinologue.",
          }),
        ],
        created_at: "2026-06-15T09:00:00.000Z",
        updated_at: "2026-06-19T10:00:00.000Z",
      }),
      makeTask({
        id: "esc-002",
        title: "Campagne de rappel — mammographie annuelle",
        description:
          "Message ciblé pour patientes de 40-69 ans — coordination avec agenda et radiologie.",
        agent_type: "marketing",
        status: "in_progress",
        history_events: [
          makeHistoryEvent("created", "admin", YESTERDAY, { from: null, to: "backlog" }),
          makeHistoryEvent("transition", "admin", NOW, { from: "backlog", to: "in_progress" }),
        ],
        updated_at: NOW,
      }),
    ],
  },
};

/**
 * Handoff task — a task created by a handoff from another agent.
 * Shows how delegated tasks look on the board.
 */
export const HandoffTask: Story = {
  name: "Handoff Delegation",
  args: {
    tasks: [
      makeTask({
        id: "hoff-001",
        title: "Vérifier disponibilité Dr. Benali pour consultation urgente",
        description:
          "La secrétaire a transmis cette demande : un patient demande une consultation en urgence pour douleur thoracique atypique. Confirmer disponibilité et protocole.",
        agent_type: "doctor",
        status: "backlog",
        history_events: [
          makeHistoryEvent("created", "secretary-agent", NOW, { from: null, to: "backlog" }),
          makeHistoryEvent("handoff", "secretary-agent", NOW, {
            sourceAgentType: "secretary",
            targetAgentType: "doctor",
            taskSummary: "Consultation urgente demandée — douleur thoracique atypique",
          }),
        ],
        created_at: NOW,
        updated_at: NOW,
      }),
      makeTask({
        id: "hoff-002",
        title: "Répondre à la question médicale sur la contre-indication warfarine",
        description:
          "Un patient a demandé si l'ibuprofène est compatible avec son traitement warfarine. La question a été transmise par l'agent réceptionniste.",
        agent_type: "doctor",
        status: "in_progress",
        history_events: [
          makeHistoryEvent("created", "receptionist-agent", YESTERDAY, {
            from: null,
            to: "backlog",
          }),
          makeHistoryEvent("handoff", "receptionist-agent", YESTERDAY, {
            sourceAgentType: "receptionist",
            targetAgentType: "doctor",
          }),
          makeHistoryEvent("transition", "doctor-agent", NOW, {
            from: "backlog",
            to: "in_progress",
          }),
        ],
        updated_at: NOW,
      }),
    ],
  },
};
