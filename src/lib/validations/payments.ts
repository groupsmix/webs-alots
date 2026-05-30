import { z } from "zod";

export const paymentConfirmSchema = z.object({
  paymentId: z.string().min(1),
});

export const paymentInitiateSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  amount: z.number().positive().finite(),
  paymentType: z.enum(["deposit", "full"]),
  method: z.enum(["cash", "card", "online", "insurance"]).optional(),
});

export const paymentRefundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive().finite().optional(),
  /** Optional reason — required for audit trail on large refunds */
  reason: z.string().max(500).optional(),
});

/**
 * Stripe webhook event schema — validates the parsed JSON body after
 * signature verification for defense-in-depth on payment events.
 */
const stripeWebhookEventObjectSchema = z.object({
  id: z.string().min(1),
  metadata: z.record(z.string(), z.string()).optional(),
  amount: z.number().optional(),
  amount_total: z.number().optional(),
  currency: z.string().optional(),
  payment_status: z.string().optional(),
  customer_email: z.string().optional(),
});

export const stripeWebhookEventSchema = z.object({
  id: z.string().optional(), // Stripe event ID (evt_xxx) — present on all real events
  type: z.string().min(1),
  data: z.object({
    object: stripeWebhookEventObjectSchema,
  }),
});

export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;

/**
 * S-06: CMI callback allow-list. Only known CMI parameters are accepted;
 * unknown parameters are rejected to prevent HMAC reconstruction with
 * attacker-injected fields.
 */
const CMI_ALLOWED_PARAMS = new Set([
  "oid",
  "OID",
  "amount",
  "AMOUNT",
  "currency",
  "ProcReturnCode",
  "procreturncode",
  "TransId",
  "transid",
  "AuthCode",
  "authcode",
  "HASH",
  "hash",
  "encoding",
  "hashAlgorithm",
  "clientid",
  "okUrl",
  "failUrl",
  "callbackUrl",
  "shopurl",
  "TranType",
  "lang",
  "BillToName",
  "email",
  "description",
  "storeType",
  "Response",
  "mdStatus",
  "txstatus",
  "iReqCode",
  "iReqDetail",
  "vendorCode",
  "PAResSyntaxOK",
  "PAResVerified",
  "cavv",
  "cavvAlgorithm",
  "eci",
  "xid",
  "md",
  "rnd",
  "EXTRA.TRXDATE",
  "EXTRA.CARDBRAND",
  "EXTRA.CARDISSUER",
  "EXTRA.CARDTYPE",
  "EXTRA.HOSTMSG",
]);

export const cmiCallbackFieldsSchema = z
  .object({
    oid: z.string().optional(),
    OID: z.string().optional(),
    amount: z.string().optional(),
    AMOUNT: z.string().optional(),
    ProcReturnCode: z.string().optional(),
    procreturncode: z.string().optional(),
    TransId: z.string().optional(),
    transid: z.string().optional(),
    AuthCode: z.string().optional(),
    authcode: z.string().optional(),
    HASH: z.string().optional(),
    hash: z.string().optional(),
  })
  .passthrough()
  .refine((data) => Boolean(data.HASH || data.hash), { message: "Missing required HASH field" })
  .refine(
    (data) => {
      const keys = Object.keys(data);
      return keys.every(
        (k) => CMI_ALLOWED_PARAMS.has(k) || k.startsWith("rnd_") || k.startsWith("EXTRA."),
      );
    },
    { message: "Unknown parameter in CMI callback — potential tampering" },
  );

export const cmiPaymentSchema = z.object({
  amount: z.number().positive().finite(),
  description: z
    .string()
    .max(200)
    .regex(/^[\w\s\-.,;:!?()éèêëàâôùûçïöüÉÈÊËÀÂÔÙÛÇÏÖÜ]*$/u, "Invalid characters in description")
    .optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
});

export const stripeCheckoutSchema = z.object({
  amount: z.number().positive().finite(),
  currency: z.string().min(1).max(10).optional(),
  description: z.string().max(500).optional(),
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

// Stripe IDs in the wild include `sub_1ABC...`, `cs_test_a1b2c3`,
// `evt_1ABC...` — i.e. `<lowercase-prefix>_<alphanumeric-with-underscores>`.
const stripeIdRegex = /^[a-z]+_[A-Za-z0-9_]+$/;
const stripeSubscriptionIdRegex = /^sub_[A-Za-z0-9_]+$/;

const subscriptionWebhookObjectSchema = z.object({
  id: z.string().min(1).max(255).regex(stripeIdRegex),
  metadata: z.record(z.string(), z.string()).optional(),
  amount_total: z.number().optional(),
  amount_paid: z.number().optional(),
  currency: z.string().optional(),
  payment_status: z.string().optional(),
  customer_email: z.string().optional(),
  customer: z.string().max(255).regex(stripeIdRegex).optional(),
  subscription: z.string().max(255).regex(stripeSubscriptionIdRegex).optional(),
  status: z.string().optional(),
  current_period_end: z.number().optional(),
  items: z
    .object({
      data: z.array(
        z.object({
          price: z.object({ id: z.string().max(255).regex(stripeIdRegex) }).optional(),
        }),
      ),
    })
    .optional(),
});

export const subscriptionWebhookEventSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    object: subscriptionWebhookObjectSchema,
  }),
});

export type SubscriptionWebhookEvent = z.infer<typeof subscriptionWebhookEventSchema>;

export const subscriptionCheckoutSchema = z.object({
  planId: z.enum(["starter", "professional", "enterprise"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const subscriptionPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
});
