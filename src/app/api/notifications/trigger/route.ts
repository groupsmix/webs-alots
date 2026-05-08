import { apiForbidden, apiNotFound, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { STAFF_ROLES } from "@/lib/auth-roles";
import {
  dispatchNotification,
  defaultNotificationTemplates,
  type NotificationTrigger,
  type TemplateVariables,
} from "@/lib/notifications";
import { notificationTriggerSchema } from "@/lib/validations";
/**
 * POST /api/notifications/trigger
 *
 * Triggers a notification for a specific event.
 * This is the main endpoint used by the booking system, payment system, etc.
 *
 * Body:
 * {
 *   trigger: NotificationTrigger,
 *   variables: TemplateVariables,
 *   recipients: Array<{ id: string; channels: ("whatsapp" | "in_app")[] }>
 * }
 *
 * Supported triggers:
 * - new_booking: When a new appointment is booked
 * - booking_confirmation: When an appointment is confirmed
 * - reminder_24h: 24 hours before appointment
 * - reminder_2h: 2 hours before appointment
 * - cancellation: When an appointment is cancelled
 * - no_show: When a patient doesn't show up
 * - prescription_ready: When a prescription is ready
 * - new_review: When a patient leaves a review
 * - payment_received: When a payment is confirmed
 * - new_patient_registered: When a new patient registers
 */
export const POST = withAuthValidation(notificationTriggerSchema, async (body, request, { supabase, profile }) => {
    const { trigger, variables, recipients } = body as {
      trigger: NotificationTrigger;
      variables: TemplateVariables;
      recipients: Array<{ id: string; channels: ("whatsapp" | "in_app")[] }>;
    };

    // Tenant isolation: verify all recipients belong to the same clinic
    // as the authenticated user (super_admin bypasses this check).
    if (profile.role !== "super_admin" && profile.clinic_id) {
      const recipientIds = recipients.map((r) => r.id);
      const { data: recipientRows } = await supabase
        .from("users")
        .select("id, clinic_id")
        .in("id", recipientIds);

      const invalidRecipients = (recipientRows ?? []).filter(
        (r) => r.clinic_id !== profile.clinic_id,
      );
      const missingRecipients = recipientIds.filter(
        (id) => !(recipientRows ?? []).some((r) => r.id === id),
      );

      if (invalidRecipients.length > 0 || missingRecipients.length > 0) {
        return apiForbidden("One or more recipients not found in your clinic");
      }
    }

    // Find the template for this trigger
    const template = defaultNotificationTemplates.find(
      (t) => t.trigger === trigger && t.enabled,
    );

    if (!template) {
      return apiNotFound(`No enabled template found for trigger: ${trigger}`);
    }

    // Dispatch to all recipients
    const allResults = [];

    for (const recipient of recipients) {
      const results = await dispatchNotification(
        trigger,
        variables || {},
        recipient.id,
        recipient.channels,
      );
      allResults.push({
        recipientId: recipient.id,
        results,
      });
    }

    return apiSuccess({
      trigger,
      template: template.name,
      dispatched: allResults,
    });
}, STAFF_ROLES);
