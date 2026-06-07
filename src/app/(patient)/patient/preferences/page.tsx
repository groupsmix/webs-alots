import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default function PatientNotificationPreferencesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Patient", href: "/patient/dashboard" },
          { label: "Preferences", href: "/patient/preferences" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold">Notification Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Oltigo should contact you for reminders, confirmations, payments, and
          prescription updates.
        </p>
      </div>

      <NotificationPreferencesForm />
    </div>
  );
}
