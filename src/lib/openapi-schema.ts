/**
 * Auto-generate an OpenAPI 3.0 specification from the Zod schemas
 * defined in @/lib/validations/. Uses Zod v4's built-in toJSONSchema()
 * so API docs stay in sync with actual validation logic.
 */

import type { ZodTypeAny } from "zod";
import { consentSchema, onboardingSchema, brandingUpdateSchema } from "@/lib/validations/admin";
import {
  bookingCancelSchema,
  emergencySlotSchema,
  recurringSchema,
  rescheduleSchema,
  waitingListSchema,
  waitingListDeleteSchema,
  checkinConfirmSchema,
} from "@/lib/validations/booking";
import { chatRequestSchema, aiManagerRequestSchema } from "@/lib/validations/chat";
import {
  uploadConfirmSchema,
  radiologyOrderCreateSchema,
  labReportSchema,
} from "@/lib/validations/clinical";
import {
  notificationDispatchSchema,
  notificationTriggerSchema,
} from "@/lib/validations/notifications";
import {
  paymentConfirmSchema,
  paymentInitiateSchema,
  paymentRefundSchema,
  cmiPaymentSchema,
  stripeCheckoutSchema,
} from "@/lib/validations/payments";
import { v1AppointmentCreateSchema, v1PatientCreateSchema } from "@/lib/validations/v1";

// ── Zod → OpenAPI 3.0 JSON Schema helper ──────────────────────────

function zodToOpenApi(schema: ZodTypeAny): object {
  try {
    return schema.toJSONSchema({ target: "openapi3", unrepresentable: "any" });
  } catch {
    return {};
  }
}

// ── Endpoint registry ──────────────────────────────────────────────

interface EndpointDef {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  summary: string;
  tags: string[];
  security?: boolean;
  requestSchema?: ZodTypeAny;
  responseDescription?: string;
}

const endpoints: EndpointDef[] = [
  // Booking
  {
    path: "/api/v1/booking/cancel",
    method: "post",
    summary: "Cancel a booking",
    tags: ["Booking"],
    requestSchema: bookingCancelSchema,
  },
  {
    path: "/api/v1/booking/emergency-slot",
    method: "post",
    summary: "Create or book an emergency slot",
    tags: ["Booking"],
    security: true,
    requestSchema: emergencySlotSchema as unknown as ZodTypeAny,
  },
  {
    path: "/api/v1/booking/recurring",
    method: "post",
    summary: "Create or cancel recurring appointments",
    tags: ["Booking"],
    security: true,
    requestSchema: recurringSchema as unknown as ZodTypeAny,
  },
  {
    path: "/api/v1/booking/reschedule",
    method: "post",
    summary: "Reschedule an appointment",
    tags: ["Booking"],
    security: true,
    requestSchema: rescheduleSchema,
  },
  {
    path: "/api/v1/booking/waiting-list",
    method: "post",
    summary: "Join the waiting list",
    tags: ["Booking"],
    requestSchema: waitingListSchema,
  },
  {
    path: "/api/v1/booking/waiting-list",
    method: "delete",
    summary: "Remove from waiting list",
    tags: ["Booking"],
    requestSchema: waitingListDeleteSchema,
  },

  // Check-in
  {
    path: "/api/v1/checkin/confirm",
    method: "post",
    summary: "Confirm patient check-in",
    tags: ["Check-in"],
    requestSchema: checkinConfirmSchema,
  },
  {
    path: "/api/v1/checkin/lookup",
    method: "get",
    summary: "Look up appointments for check-in",
    tags: ["Check-in"],
  },
  {
    path: "/api/v1/checkin/status",
    method: "get",
    summary: "Get check-in status",
    tags: ["Check-in"],
  },

  // Chat / AI
  {
    path: "/api/v1/chat",
    method: "post",
    summary: "Send a chat message to the AI assistant",
    tags: ["Chat"],
    requestSchema: chatRequestSchema,
  },
  {
    path: "/api/v1/ai/manager",
    method: "post",
    summary: "AI clinic manager assistant",
    tags: ["AI"],
    security: true,
    requestSchema: aiManagerRequestSchema,
  },

  // Uploads
  {
    path: "/api/v1/upload",
    method: "post",
    summary: "Upload a file to R2 storage",
    tags: ["Uploads"],
    security: true,
    requestSchema: uploadConfirmSchema,
  },

  // Files
  {
    path: "/api/v1/files/download",
    method: "get",
    summary: "Download an encrypted file from R2",
    tags: ["Files"],
    security: true,
  },

  // Notifications
  {
    path: "/api/v1/notifications",
    method: "post",
    summary: "Dispatch a notification",
    tags: ["Notifications"],
    security: true,
    requestSchema: notificationDispatchSchema,
  },
  {
    path: "/api/v1/notifications/trigger",
    method: "post",
    summary: "Trigger notifications to multiple recipients",
    tags: ["Notifications"],
    security: true,
    requestSchema: notificationTriggerSchema,
  },

  // Payments
  {
    path: "/api/v1/payments/create-checkout",
    method: "post",
    summary: "Create a Stripe checkout session",
    tags: ["Payments"],
    security: true,
    requestSchema: stripeCheckoutSchema,
  },
  {
    path: "/api/v1/payments/cmi",
    method: "post",
    summary: "Initiate a CMI payment",
    tags: ["Payments"],
    security: true,
    requestSchema: cmiPaymentSchema,
  },
  {
    path: "/api/v1/payments/webhook",
    method: "post",
    summary: "Handle Stripe webhook events",
    tags: ["Webhooks"],
  },
  {
    path: "/api/v1/booking/payment/initiate",
    method: "post",
    summary: "Initiate a booking payment",
    tags: ["Payments"],
    security: true,
    requestSchema: paymentInitiateSchema,
  },
  {
    path: "/api/v1/booking/payment/confirm",
    method: "post",
    summary: "Confirm a booking payment",
    tags: ["Payments"],
    security: true,
    requestSchema: paymentConfirmSchema,
  },
  {
    path: "/api/v1/booking/payment/refund",
    method: "post",
    summary: "Refund a booking payment",
    tags: ["Payments"],
    security: true,
    requestSchema: paymentRefundSchema,
  },

  // Consent
  {
    path: "/api/v1/consent",
    method: "post",
    summary: "Record patient consent",
    tags: ["Consent"],
    requestSchema: consentSchema,
  },

  // Webhooks
  {
    path: "/api/v1/webhooks",
    method: "post",
    summary: "Handle WhatsApp Business API webhooks",
    tags: ["Webhooks"],
  },
  {
    path: "/api/v1/webhooks",
    method: "get",
    summary: "WhatsApp webhook verification",
    tags: ["Webhooks"],
  },

  // Existing v1 endpoints
  {
    path: "/api/v1/appointments",
    method: "get",
    summary: "List appointments",
    tags: ["Appointments"],
    security: true,
  },
  {
    path: "/api/v1/appointments",
    method: "post",
    summary: "Create an appointment",
    tags: ["Appointments"],
    security: true,
    requestSchema: v1AppointmentCreateSchema,
  },
  {
    path: "/api/v1/patients",
    method: "get",
    summary: "List patients",
    tags: ["Patients"],
    security: true,
  },
  {
    path: "/api/v1/patients",
    method: "post",
    summary: "Register a new patient",
    tags: ["Patients"],
    security: true,
    requestSchema: v1PatientCreateSchema,
  },
  {
    path: "/api/v1/register-clinic",
    method: "post",
    summary: "Register a new clinic",
    tags: ["Onboarding"],
    requestSchema: onboardingSchema,
  },

  // Health
  {
    path: "/api/health",
    method: "get",
    summary: "Service health check",
    tags: ["Health"],
    responseDescription: "Health status with per-dependency checks",
  },

  // Radiology
  {
    path: "/api/v1/radiology/orders",
    method: "post",
    summary: "Create a radiology order",
    tags: ["Radiology"],
    security: true,
    requestSchema: radiologyOrderCreateSchema,
  },

  // Lab
  {
    path: "/api/v1/lab/report-html",
    method: "post",
    summary: "Generate a lab report as HTML",
    tags: ["Lab"],
    security: true,
    requestSchema: labReportSchema,
  },

  // Branding
  {
    path: "/api/v1/branding",
    method: "put",
    summary: "Update clinic branding",
    tags: ["Branding"],
    security: true,
    requestSchema: brandingUpdateSchema,
  },
];

// ── Spec generator ─────────────────────────────────────────────────

const ERROR_SCHEMA = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" as const, enum: [false] },
    error: { type: "string" as const },
    code: { type: "string" as const },
  },
  required: ["ok", "error"],
};

const SUCCESS_WRAPPER = {
  type: "object" as const,
  properties: {
    ok: { type: "boolean" as const, enum: [true] },
    data: {},
  },
  required: ["ok", "data"],
};

function buildErrorResponses(): Record<string, object> {
  return {
    "400": {
      description: "Bad Request",
      content: { "application/json": { schema: ERROR_SCHEMA } },
    },
    "401": {
      description: "Unauthorized",
      content: { "application/json": { schema: ERROR_SCHEMA } },
    },
    "404": { description: "Not Found", content: { "application/json": { schema: ERROR_SCHEMA } } },
    "429": {
      description: "Rate Limited",
      content: { "application/json": { schema: ERROR_SCHEMA } },
    },
    "500": {
      description: "Internal Server Error",
      content: { "application/json": { schema: ERROR_SCHEMA } },
    },
  };
}

export function generateOpenApiFromZod(): object {
  const paths: Record<string, Record<string, object>> = {};

  for (const ep of endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};

    const operation: Record<string, unknown> = {
      summary: ep.summary,
      tags: ep.tags,
      responses: {
        "200": {
          description: ep.responseDescription ?? "Successful response",
          content: { "application/json": { schema: SUCCESS_WRAPPER } },
        },
        ...buildErrorResponses(),
      },
    };

    if (ep.security) {
      operation.security = [{ bearerAuth: [] }];
    }

    if (ep.requestSchema && ["post", "put", "patch"].includes(ep.method)) {
      const bodySchema = zodToOpenApi(ep.requestSchema);
      operation.requestBody = {
        required: true,
        content: { "application/json": { schema: bodySchema } },
      };
    }

    paths[ep.path][ep.method] = operation;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Oltigo Health API",
      version: "1.0.0",
      description:
        "Multi-tenant healthcare SaaS API for Moroccan clinics. " +
        "Schemas are auto-generated from Zod validation schemas.",
    },
    servers: [
      { url: "https://api.oltigo.com", description: "Production" },
      { url: "https://staging.oltigo.com", description: "Staging" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase JWT token",
        },
      },
    },
    paths,
    tags: [
      { name: "Appointments", description: "Appointment management" },
      { name: "Patients", description: "Patient registry" },
      { name: "Booking", description: "Public booking flow" },
      { name: "Payments", description: "Payment processing (Stripe, CMI)" },
      { name: "Webhooks", description: "Webhook handlers (WhatsApp, Stripe)" },
      { name: "Notifications", description: "Multi-channel notifications" },
      { name: "Chat", description: "AI chatbot assistant" },
      { name: "AI", description: "AI-powered clinical tools" },
      { name: "Uploads", description: "File upload to R2 storage" },
      { name: "Files", description: "Encrypted file download" },
      { name: "Check-in", description: "Patient check-in kiosk" },
      { name: "Consent", description: "Patient consent management" },
      { name: "Health", description: "Service health checks" },
      { name: "Onboarding", description: "Clinic registration" },
      { name: "Branding", description: "Clinic branding and theming" },
      { name: "Radiology", description: "Radiology orders and reports" },
      { name: "Lab", description: "Lab test results and reports" },
    ],
  };
}
