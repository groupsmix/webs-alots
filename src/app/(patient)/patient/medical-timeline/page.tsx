import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { Breadcrumb } from "@/components/ui/breadcrumb";

/**
 * Patient Medical Timeline
 *
 * Server Component that displays a chronological timeline of the patient's
 * visits, prescriptions, and medical events. Fetches data server-side
 * to eliminate client-side loading states for initial render.
 */

interface TimelineEvent {
  id: string;
  type: "appointment" | "prescription";
  date: string;
  title: string;
  description: string;
}

async function getPatientTimeline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  userId: string,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // Fetch appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status, notes")
    .eq("clinic_id", clinicId)
    .eq("patient_id", userId)
    .order("appointment_date", { ascending: false })
    .limit(50);

  if (appointments) {
    for (const appt of appointments) {
      events.push({
        id: `appt-${appt.id}`,
        type: "appointment",
        date: appt.appointment_date ?? "",
        title: `${t("fr", "nav.appointments")} — ${appt.status}`,
        description: appt.notes ?? `${appt.start_time ?? ""}`,
      });
    }
  }

  // Fetch prescriptions
  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select("id, created_at, notes")
    .eq("clinic_id", clinicId)
    .eq("patient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (prescriptions) {
    for (const rx of prescriptions) {
      events.push({
        id: `rx-${rx.id}`,
        type: "prescription",
        date: rx.created_at?.split("T")[0] ?? "",
        title: t("fr", "prescription.title"),
        description: rx.notes ?? "",
      });
    }
  }

  // Sort all events by date descending
  events.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  return events;
}

export default async function MedicalTimelinePage() {
  const tenant = await requireTenant();
  const supabase = await createClient();

  // Get the current user's profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("fr", "auth.genericError")}
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .eq("clinic_id", tenant.clinicId)
    .single();

  if (!profile) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("fr", "auth.genericError")}
      </div>
    );
  }

  const timeline = await getPatientTimeline(supabase, tenant.clinicId, profile.id);

  const typeColors: Record<string, string> = {
    appointment: "bg-blue-100 text-blue-800",
    prescription: "bg-green-100 text-green-800",
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Patient", href: "/patient/dashboard" }, { label: "Medical Timeline" }]} />
      <h1 className="text-2xl font-bold">{t("fr", "carnet.title")}</h1>

      {timeline.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t("fr", "directory.noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-0 before:h-full before:w-0.5 before:bg-border">
          {timeline.map((event) => (
            <div key={event.id} className="relative">
              <div className="absolute -left-4 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[event.type] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {event.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.date}
                    </span>
                  </div>
                  <CardTitle className="text-sm">{event.title}</CardTitle>
                </CardHeader>
                {event.description && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
