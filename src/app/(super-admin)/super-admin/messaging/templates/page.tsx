import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase-server";

/**
 * The 10 required Darija / French WhatsApp templates for the platform.
 * These must be submitted and approved via Meta Business API before use.
 * See docs/whatsapp-template-approval.md for the submission guide.
 */
const EXPECTED_TEMPLATES = [
  {
    name: "appointment_reminder_24h",
    label: "Rappel — 24h avant",
    category: "reminder",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{date}}, {{time}}, {{clinic_name}}",
  },
  {
    name: "appointment_reminder_2h",
    label: "Rappel — 2h avant",
    category: "reminder",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{date}}, {{time}}, {{clinic_name}}",
  },
  {
    name: "appointment_reminder_15min",
    label: "Rappel — 15min avant",
    category: "reminder",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{time}}, {{clinic_name}}",
  },
  {
    name: "booking_confirmation",
    label: "Confirmation de réservation",
    category: "transactional",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{date}}, {{time}}, {{clinic_name}}",
  },
  {
    name: "cancellation",
    label: "Annulation de rendez-vous",
    category: "transactional",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{date}}, {{clinic_name}}",
  },
  {
    name: "rescheduled",
    label: "Reprogrammation",
    category: "transactional",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{date}}, {{time}}, {{clinic_name}}",
  },
  {
    name: "slot_available",
    label: "Créneau disponible (liste d'attente)",
    category: "marketing",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{slot_datetime}}, {{claim_url}}, {{expires_in}}",
  },
  {
    name: "prescription_ready",
    label: "Ordonnance disponible",
    category: "transactional",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{doctor_name}}, {{clinic_name}}",
  },
  {
    name: "billing_receipt",
    label: "Reçu de paiement",
    category: "transactional",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{amount}}, {{clinic_name}}, {{order_id}}",
  },
  {
    name: "welcome_patient",
    label: "Bienvenue (nouveau patient)",
    category: "marketing",
    language: "fr / Darija",
    variables: "{{patient_name}}, {{clinic_name}}",
  },
] as const;

type TemplateName = (typeof EXPECTED_TEMPLATES)[number]["name"];

interface DbTemplate {
  template_name: string;
  status: string;
  meta_template_id: string | null;
  updated_at: string;
  clinic_id: string;
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "outline" | "destructive" | "secondary" }
> = {
  approved: { label: "Approuvé", variant: "success" },
  pending: { label: "En attente", variant: "outline" },
  rejected: { label: "Rejeté", variant: "destructive" },
  not_submitted: { label: "Non soumis", variant: "secondary" },
};

export default async function WhatsAppTemplatesPage() {
  const supabase = await createClient();

  // Fetch all templates across all clinics to show aggregate approval status.
  // nosemgrep: semgrep.tenant-scoping — super_admin cross-tenant read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("whatsapp_templates")
    .select("template_name, status, meta_template_id, updated_at, clinic_id")
    .in(
      "template_name",
      EXPECTED_TEMPLATES.map((t) => t.name),
    );

  const rows = (data ?? []) as DbTemplate[];

  // Build a lookup: template_name → best status
  // Priority: approved > pending > rejected > not_submitted
  const STATUS_PRIORITY: Record<string, number> = {
    approved: 3,
    pending: 2,
    rejected: 1,
    not_submitted: 0,
  };
  const bestStatus = new Map<TemplateName, string>();
  for (const row of rows) {
    const name = row.template_name as TemplateName;
    const current = bestStatus.get(name) ?? "not_submitted";
    if ((STATUS_PRIORITY[row.status] ?? 0) > (STATUS_PRIORITY[current] ?? 0)) {
      bestStatus.set(name, row.status);
    }
  }

  const approvedCount = [...bestStatus.values()].filter((s) => s === "approved").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Templates WhatsApp Darija</h1>
        <p className="text-muted-foreground mt-1">
          Statut d&apos;approbation Meta des 10 templates requis. Voir{" "}
          <code className="text-xs bg-muted px-1 rounded">docs/whatsapp-template-approval.md</code>{" "}
          pour la procédure de soumission.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3">
        <Badge variant={approvedCount === 10 ? "success" : "outline"} className="text-sm px-3 py-1">
          {approvedCount} / 10 approuvés
        </Badge>
        {approvedCount < 10 && (
          <span className="text-sm text-amber-600">
            ⚠️ {10 - approvedCount} template{10 - approvedCount > 1 ? "s" : ""} non approuvé
            {10 - approvedCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventaire des templates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Statut Meta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXPECTED_TEMPLATES.map((tpl) => {
                const status = bestStatus.get(tpl.name) ?? "not_submitted";
                const badge = STATUS_BADGE[status] ?? STATUS_BADGE.not_submitted;
                return (
                  <TableRow key={tpl.name}>
                    <TableCell>
                      <div className="font-medium text-sm">{tpl.label}</div>
                      <code className="text-xs text-muted-foreground">{tpl.name}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {tpl.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{tpl.language}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground break-all">
                        {tpl.variables}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
