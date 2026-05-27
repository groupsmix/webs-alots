import { z } from "zod";

const notificationChannelEnum = z.enum(["whatsapp", "in_app", "sms", "email"]);

export const notificationDispatchSchema = z.object({
  trigger: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  recipientId: z.string().min(1),
  channels: z.array(notificationChannelEnum).min(1),
});

export const notificationTriggerSchema = z.object({
  trigger: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional().default({}),
  recipients: z
    .array(
      z.object({
        id: z.string().min(1),
        channels: z.array(notificationChannelEnum).min(1),
      }),
    )
    .min(1),
});
