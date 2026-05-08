/**
 * WhatsApp Message Templates — Darija (Moroccan Arabic)
 *
 * 10 patient-facing message templates written in Darija for higher
 * engagement with Moroccan patients. These map to the same
 * `NotificationTrigger` types and use the same `{{variable}}`
 * placeholders as the default (French/formal) templates in
 * `notifications.ts`.
 *
 * Each template is pre-approved-ready for Meta WhatsApp Business API
 * submission. See `docs/whatsapp-template-approval.md` for the
 * approval workflow.
 */

import type {
  NotificationTrigger,
  NotificationTemplate,
  NotificationChannel,
  NotificationPriority,
} from "./notifications";

// ---- Darija Template Definitions ----

export interface DarijaTemplate {
  id: string;
  trigger: NotificationTrigger;
  name: string;
  label: string;
  labelDarija: string;
  channels: NotificationChannel[];
  subject: string;
  body: string;
  whatsappBody: string;
  enabled: boolean;
  priority: NotificationPriority;
  recipientRoles: ("patient" | "doctor" | "receptionist" | "clinic_admin")[];
  /** Meta template name for API submission (lowercase, underscores) */
  metaTemplateName: string;
}

/**
 * 10 Darija WhatsApp templates for patient notifications.
 *
 * These are designed to feel conversational and warm — the way
 * Moroccans actually communicate on WhatsApp — rather than using
 * formal Modern Standard Arabic.
 */
export const darijaWhatsAppTemplates: DarijaTemplate[] = [
  // 1. Appointment Confirmation
  {
    id: "darija_booking_confirmation",
    trigger: "booking_confirmation",
    name: "booking_confirmation_darija",
    label: "Appointment Confirmation (Darija)",
    labelDarija: "تأكيد الموعد",
    channels: ["whatsapp", "in_app"],
    subject: "تأكيد الموعد ديالك",
    body: "السلام {{patient_name}}، الموعد ديالك مع {{doctor_name}} تأكد. نهار {{date}} على {{time}}. الخدمة: {{service_name}}. العنوان: {{clinic_address}}. إلا بغيتي تبدل ولا تلغي: {{manage_url}}. {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nالموعد ديالك تأكد ✅\n\n🩺 دكتور: {{doctor_name}}\n📅 نهار: {{date}}\n🕐 الوقت: {{time}}\n💼 الخدمة: {{service_name}}\n📍 العنوان: {{clinic_address}}\n\nإلا بغيتي تبدل ولا تلغي: {{manage_url}}\n\n{{clinic_name}}",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
    metaTemplateName: "booking_confirmation_darija",
  },

  // 2. Reminder (24h)
  {
    id: "darija_reminder_24h",
    trigger: "reminder_24h",
    name: "reminder_24h_darija",
    label: "24-Hour Reminder (Darija)",
    labelDarija: "تذكير 24 ساعة",
    channels: ["whatsapp", "in_app"],
    subject: "تذكير: الموعد ديالك غدا",
    body: "السلام {{patient_name}}، تذكير بلي عندك موعد غدا مع {{doctor_name}} على {{time}} ف {{clinic_name}}. العنوان: {{clinic_address}}. جاوب ب نعم للتأكيد ولا لا للإلغاء.",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nما تنساش! عندك موعد غدا ⏰\n\n🩺 دكتور: {{doctor_name}}\n🕐 الوقت: {{time}}\n📍 {{clinic_name}} — {{clinic_address}}\n\nجاوبنا ب ✅ نعم للتأكيد ولا ❌ لا للإلغاء",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
    metaTemplateName: "reminder_24h_darija",
  },

  // 3. Cancellation
  {
    id: "darija_cancellation",
    trigger: "cancellation",
    name: "cancellation_darija",
    label: "Cancellation Notice (Darija)",
    labelDarija: "إلغاء الموعد",
    channels: ["whatsapp", "in_app"],
    subject: "الموعد ديالك تلغا",
    body: "السلام {{patient_name}}، الموعد ديالك مع {{doctor_name}} نهار {{date}} على {{time}} تلغا. عيط لينا على {{clinic_phone}} باش تاخد موعد جديد. {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nالموعد ديالك تلغا ❌\n\n🩺 دكتور: {{doctor_name}}\n📅 نهار: {{date}}\n🕐 الوقت: {{time}}\n\nإلا بغيتي تاخد موعد جديد عيط لينا على: {{clinic_phone}}\n\n{{clinic_name}}",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
    metaTemplateName: "cancellation_darija",
  },

  // 4. Prescription Ready
  {
    id: "darija_prescription_ready",
    trigger: "prescription_ready",
    name: "prescription_ready_darija",
    label: "Prescription Ready (Darija)",
    labelDarija: "الوصفة جاهزة",
    channels: ["whatsapp", "in_app"],
    subject: "الوصفة ديالك جاهزة",
    body: "السلام {{patient_name}}، الوصفة ديالك من عند {{doctor_name}} جاهزة. يمكن ليك تجيبها من {{clinic_name}}. العنوان: {{clinic_address}}.",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nالوصفة ديالك جاهزة 📋✅\n\n🩺 دكتور: {{doctor_name}}\n📍 جيبها من: {{clinic_name}}\n📍 العنوان: {{clinic_address}}\n\nصحتك تهمنا! 🙏",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
    metaTemplateName: "prescription_ready_darija",
  },

  // 5. Payment Received
  {
    id: "darija_payment_received",
    trigger: "payment_received",
    name: "payment_received_darija",
    label: "Payment Received (Darija)",
    labelDarija: "تأكيد الدفع",
    channels: ["whatsapp", "in_app"],
    subject: "الدفع توصل",
    body: "السلام {{patient_name}}، توصلنا بالخلاص ديالك {{amount}} {{currency}} عن طريق {{payment_method}}. رقم الفاتورة: {{invoice_id}}. شكرا! — {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nتوصلنا بالخلاص ديالك ✅\n\n💰 المبلغ: {{amount}} {{currency}}\n💳 طريقة الدفع: {{payment_method}}\n🧾 رقم الفاتورة: {{invoice_id}}\n\nشكرا ليك! 🙏\n{{clinic_name}}",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
    metaTemplateName: "payment_received_darija",
  },

  // 6. Welcome (New Patient Registered)
  {
    id: "darija_welcome",
    trigger: "new_patient_registered",
    name: "welcome_darija",
    label: "Welcome Message (Darija)",
    labelDarija: "مرحبا بيك",
    channels: ["whatsapp", "in_app"],
    subject: "مرحبا بيك ف {{clinic_name}}",
    body: "مرحبا بيك {{patient_name}} ف {{clinic_name}}! حنا هنا باش نعتانيو بصحتك. إلا عندك شي سؤال عيط لينا على {{clinic_phone}}.",
    whatsappBody:
      "مرحبا بيك {{patient_name}} 👋🎉\n\nتسجلتي ف {{clinic_name}} بنجاح ✅\n\nحنا هنا باش نعتانيو بصحتك 🏥\n\nإلا بغيتي تاخد موعد ولا عندك شي سؤال:\n📞 {{clinic_phone}}\n📍 {{clinic_address}}\n\nصحتك تهمنا! 🙏",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
    metaTemplateName: "welcome_darija",
  },

  // 7. Review Request
  {
    id: "darija_review_request",
    trigger: "follow_up",
    name: "review_request_darija",
    label: "Review Request (Darija)",
    labelDarija: "طلب تقييم",
    channels: ["whatsapp"],
    subject: "شاركنا رأيك",
    body: "السلام {{patient_name}}، كيفاش لقيتي الزيارة ديالك عند {{doctor_name}}؟ شاركنا رأيك باش نحسنو الخدمة ديالنا. شكرا! — {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nكيفاش لقيتي الزيارة ديالك عند {{doctor_name}}؟ 🩺\n\nرأيك مهم لينا باش نحسنو الخدمة ديالنا ⭐\n\nشاركنا تقييمك هنا: {{booking_url}}\n\nشكرا ليك! 🙏\n{{clinic_name}}",
    enabled: true,
    priority: "low",
    recipientRoles: ["patient"],
    metaTemplateName: "review_request_darija",
  },

  // 8. Reschedule
  {
    id: "darija_rescheduled",
    trigger: "rescheduled",
    name: "rescheduled_darija",
    label: "Appointment Rescheduled (Darija)",
    labelDarija: "تغيير الموعد",
    channels: ["whatsapp", "in_app"],
    subject: "الموعد ديالك تبدل",
    body: "السلام {{patient_name}}، الموعد ديالك مع {{doctor_name}} تبدل لنهار {{date}} على {{time}}. إلا عندك شي سؤال عيط لينا على {{clinic_phone}}. {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nالموعد ديالك تبدل 📅\n\n🩺 دكتور: {{doctor_name}}\n📅 النهار الجديد: {{date}}\n🕐 الوقت الجديد: {{time}}\n\nإلا عندك شي سؤال عيط لينا على: {{clinic_phone}}\n\n{{clinic_name}}",
    enabled: true,
    priority: "high",
    recipientRoles: ["patient"],
    metaTemplateName: "rescheduled_darija",
  },

  // 9. Waiting Room Update
  {
    id: "darija_waiting_room",
    trigger: "reminder_1h",
    name: "waiting_room_darija",
    label: "Waiting Room Update (Darija)",
    labelDarija: "تحديث قاعة الانتظار",
    channels: ["whatsapp"],
    subject: "الدور ديالك قرب",
    body: "السلام {{patient_name}}، الدور ديالك قرب عند {{doctor_name}}. بقاو {{time}} تقريبا. كون مستاعد. {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nالدور ديالك قرب عند {{doctor_name}} 🏥\n\n🕐 بقات تقريبا: {{time}}\n\nكون مستاعد! 🙏\n{{clinic_name}}",
    enabled: true,
    priority: "urgent",
    recipientRoles: ["patient"],
    metaTemplateName: "waiting_room_darija",
  },

  // 10. Follow-up Reminder
  {
    id: "darija_follow_up",
    trigger: "follow_up",
    name: "follow_up_darija",
    label: "Follow-up Reminder (Darija)",
    labelDarija: "تذكير بالمراجعة",
    channels: ["whatsapp", "in_app"],
    subject: "وقت المراجعة",
    body: "السلام {{patient_name}}، جا الوقت ديال المراجعة ديالك عند {{doctor_name}}. خود موعد جديد من هنا: {{booking_url}}. {{clinic_name}}",
    whatsappBody:
      "السلام {{patient_name}} 👋\n\nجا الوقت ديال المراجعة ديالك 📋\n\n🩺 دكتور: {{doctor_name}}\n\nخود موعد جديد من هنا: {{booking_url}}\n\nصحتك تهمنا! 🙏\n{{clinic_name}}",
    enabled: true,
    priority: "normal",
    recipientRoles: ["patient"],
    metaTemplateName: "follow_up_darija",
  },
];

/**
 * Convert Darija templates to the standard `NotificationTemplate` format
 * used by the notification engine, so they can be passed directly to
 * `dispatchNotification()` and `sendNotificationWhatsApp()`.
 */
export function toDarijaNotificationTemplates(): NotificationTemplate[] {
  return darijaWhatsAppTemplates.map((t) => ({
    id: t.id,
    trigger: t.trigger,
    name: t.name,
    label: t.label,
    channels: t.channels,
    subject: t.subject,
    body: t.body,
    whatsappBody: t.whatsappBody,
    enabled: t.enabled,
    priority: t.priority,
    recipientRoles: t.recipientRoles,
  }));
}

/**
 * Look up a single Darija template by its notification trigger.
 * Returns `undefined` if no enabled template exists for that trigger.
 */
export function getDarijaTemplate(
  trigger: NotificationTrigger,
): DarijaTemplate | undefined {
  return darijaWhatsAppTemplates.find(
    (t) => t.trigger === trigger && t.enabled,
  );
}
