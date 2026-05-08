/**
 * OpenAPI 3.0 Specification Generator
 *
 * Generates API documentation for all /api/v1/ endpoints.
 * Includes schemas, security schemes, and rate limiting info.
 */

import { NextRequest } from "next/server";

const OPENAPI_VERSION = "3.0.3";
const API_VERSION = "v1";

export interface ApiEndpoint {
  path: string;
  method: string;
  summary: string;
  description?: string;
  tags?: string[];
  security?: boolean;
  requestBody?: {
    content: Record<string, { schema: unknown }>;
  };
  responses?: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>;
}

export interface ApiSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string; format?: string; enum?: string[] }>;
  required?: string[];
  items?: ApiSchema;
}

const SECURITY_SCHEMES = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Supabase JWT token from /api/auth/login or /api/auth/phone-login",
  },
};

const PATIENT_SCHEMA: ApiSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    phone: { type: "string" },
    email: { type: "string", format: "email" },
    date_of_birth: { type: "string", format: "date" },
    gender: { type: "string", enum: ["M", "F"] },
    address: { type: "string" },
    cin: { type: "string" },
    insurance: { type: "string" },
    insurance_number: { type: "string" },
    created_at: { type: "string", format: "date-time" },
  },
};

const APPOINTMENT_SCHEMA: ApiSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    patient_id: { type: "string", format: "uuid" },
    clinic_id: { type: "string", format: "uuid" },
    doctor_id: { type: "string", format: "uuid" },
    service: { type: "string" },
    date: { type: "string", format: "date" },
    time: { type: "string" },
    status: { type: "string", enum: ["scheduled", "confirmed", "completed", "cancelled", "no_show"] },
    notes: { type: "string" },
    created_at: { type: "string", format: "date-time" },
  },
};

const ERROR_RESPONSES = {
  "400": {
    description: "Bad Request - Invalid parameters",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  },
  "401": {
    description: "Unauthorized - Invalid or missing authentication",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  },
  "404": {
    description: "Not Found - Resource does not exist",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  },
  "429": {
    description: "Too Many Requests - Rate limit exceeded",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
      },
    },
  },
  "500": {
    description: "Internal Server Error",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
};

export const apiEndpoints: ApiEndpoint[] = [
  // Appointments
  {
    path: "/api/v1/appointments",
    method: "GET",
    summary: "List appointments",
    description: "Retrieve appointments for the authenticated clinic. Supports filtering by date range, status, and patient.",
    tags: ["Appointments"],
    security: true,
    responses: {
      "200": {
        description: "Successful response with array of appointments",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: APPOINTMENT_SCHEMA,
            },
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/appointments",
    method: "POST",
    summary: "Create appointment",
    description: "Create a new appointment for a patient.",
    tags: ["Appointments"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["patient_id", "clinic_id", "doctor_id", "service", "date", "time"],
            properties: {
              patient_id: { type: "string", format: "uuid" },
              clinic_id: { type: "string", format: "uuid" },
              doctor_id: { type: "string", format: "uuid" },
              service: { type: "string" },
              date: { type: "string", format: "date" },
              time: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Appointment created successfully",
        content: {
          "application/json": {
            schema: APPOINTMENT_SCHEMA,
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/appointments/{id}",
    method: "GET",
    summary: "Get appointment",
    description: "Retrieve a specific appointment by ID.",
    tags: ["Appointments"],
    security: true,
    responses: {
      "200": {
        description: "Successful response with appointment details",
        content: {
          "application/json": {
            schema: APPOINTMENT_SCHEMA,
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/appointments/{id}",
    method: "PATCH",
    summary: "Update appointment",
    description: "Update an existing appointment (status, time, notes).",
    tags: ["Appointments"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["scheduled", "confirmed", "completed", "cancelled", "no_show"] },
              date: { type: "string", format: "date" },
              time: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Appointment updated successfully",
        content: {
          "application/json": {
            schema: APPOINTMENT_SCHEMA,
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/appointments/{id}",
    method: "DELETE",
    summary: "Delete appointment",
    description: "Delete (cancel) an appointment.",
    tags: ["Appointments"],
    security: true,
    responses: {
      "204": { description: "Appointment deleted successfully" },
      ...ERROR_RESPONSES,
    },
  },

  // Patients
  {
    path: "/api/v1/patients",
    method: "GET",
    summary: "List patients",
    description: "Retrieve patients for the authenticated clinic. Supports search by name, phone, or email.",
    tags: ["Patients"],
    security: true,
    responses: {
      "200": {
        description: "Successful response with array of patients",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: PATIENT_SCHEMA,
            },
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/patients",
    method: "POST",
    summary: "Create patient",
    description: "Register a new patient in the clinic.",
    tags: ["Patients"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["name", "phone", "date_of_birth", "gender"],
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email" },
              date_of_birth: { type: "string", format: "date" },
              gender: { type: "string", enum: ["M", "F"] },
              address: { type: "string" },
              cin: { type: "string" },
              insurance: { type: "string" },
              insurance_number: { type: "string" },
              allergies: { type: "string" },
              medical_history: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "201": {
        description: "Patient created successfully",
        content: {
          "application/json": {
            schema: PATIENT_SCHEMA,
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/patients/{id}",
    method: "GET",
    summary: "Get patient",
    description: "Retrieve a specific patient by ID with full details.",
    tags: ["Patients"],
    security: true,
    responses: {
      "200": {
        description: "Successful response with patient details",
        content: {
          "application/json": {
            schema: {
              ...PATIENT_SCHEMA,
              properties: {
                ...PATIENT_SCHEMA.properties,
                emergency_contact_name: { type: "string" },
                emergency_contact_phone: { type: "string" },
                allergies: { type: "string" },
                medical_history: { type: "string" },
              },
            },
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/patients/{id}",
    method: "PATCH",
    summary: "Update patient",
    description: "Update patient information.",
    tags: ["Patients"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email" },
              address: { type: "string" },
              insurance: { type: "string" },
              insurance_number: { type: "string" },
              allergies: { type: "string" },
              medical_history: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Patient updated successfully",
        content: {
          "application/json": {
            schema: PATIENT_SCHEMA,
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/patients/{id}",
    method: "DELETE",
    summary: "Delete patient",
    description: "Soft-delete a patient (marks as archived).",
    tags: ["Patients"],
    security: true,
    responses: {
      "204": { description: "Patient deleted successfully" },
      ...ERROR_RESPONSES,
    },
  },

  // Auth
  {
    path: "/api/auth/demo-login",
    method: "POST",
    summary: "Demo login",
    description: "Authenticate with a demo/seed user account. Only available when demo mode is enabled.",
    tags: ["Auth"],
    responses: {
      "200": { description: "Login successful, returns session" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/verify-email",
    method: "GET",
    summary: "Verify email address",
    description: "Handles email verification callback from Supabase Auth magic link.",
    tags: ["Auth"],
    responses: {
      "302": { description: "Redirects to dashboard after verification" },
      ...ERROR_RESPONSES,
    },
  },

  // Booking
  {
    path: "/api/booking",
    method: "GET",
    summary: "List available slots",
    description: "Returns available time slots for a given doctor and date. Query params: doctorId, date (YYYY-MM-DD).",
    tags: ["Booking"],
    responses: {
      "200": {
        description: "Available slots with capacity info",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                slots: { type: "array", description: "Available slot times" },
                allSlots: { type: "array", description: "All generated slot times" },
                maxPerSlot: { type: "integer", description: "Maximum bookings per slot" },
                slotDuration: { type: "integer", description: "Slot duration in minutes" },
              },
            },
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking",
    method: "POST",
    summary: "Create booking",
    description: "Creates a new appointment booking. Requires a valid booking token from POST /api/booking/verify. Rate limited to 10 req/min per IP.",
    tags: ["Booking"],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["specialtyId", "doctorId", "serviceId", "date", "time", "isFirstVisit", "hasInsurance", "patient", "slotDuration", "bufferTime"],
            properties: {
              specialtyId: { type: "string" },
              doctorId: { type: "string", format: "uuid" },
              serviceId: { type: "string", format: "uuid" },
              date: { type: "string", format: "date" },
              time: { type: "string", description: "HH:MM format" },
              isFirstVisit: { type: "boolean" },
              hasInsurance: { type: "boolean" },
              patient: { type: "object", description: "Patient details: name, phone, email, reason" },
              slotDuration: { type: "integer" },
              bufferTime: { type: "integer" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Booking created successfully" },
      "409": { description: "Slot already booked (race condition)" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/verify",
    method: "POST",
    summary: "Verify booking OTP",
    description: "Sends an OTP to the patient's phone/email for booking verification. Returns a booking token on success.",
    tags: ["Booking"],
    responses: {
      "200": { description: "OTP sent or token issued" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/cancel",
    method: "POST",
    summary: "Cancel booking",
    description: "Cancels an existing appointment. Enforces timezone-aware cancellation window and ownership checks.",
    tags: ["Booking"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["appointmentId"],
            properties: {
              appointmentId: { type: "string", format: "uuid" },
              reason: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Appointment cancelled" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/cancel",
    method: "GET",
    summary: "Get cancellation details",
    description: "Retrieves appointment details for the cancellation confirmation page. Query param: appointmentId.",
    tags: ["Booking"],
    responses: {
      "200": { description: "Appointment details for cancellation" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/reschedule",
    method: "POST",
    summary: "Reschedule booking",
    description: "Reschedules an existing appointment to a new date/time slot.",
    tags: ["Booking"],
    security: true,
    responses: {
      "200": { description: "Appointment rescheduled" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/recurring",
    method: "POST",
    summary: "Create recurring booking",
    description: "Creates a series of recurring appointments based on a pattern (weekly, biweekly, monthly).",
    tags: ["Booking"],
    security: true,
    responses: {
      "200": { description: "Recurring appointments created" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/emergency-slot",
    method: "POST",
    summary: "Book emergency slot",
    description: "Books an emergency appointment slot that bypasses normal availability checks.",
    tags: ["Booking"],
    security: true,
    responses: {
      "200": { description: "Emergency slot booked" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/waiting-list",
    method: "POST",
    summary: "Join waiting list",
    description: "Adds a patient to the waiting list for a fully booked slot. Notified when a slot opens.",
    tags: ["Booking"],
    responses: {
      "200": { description: "Added to waiting list" },
      ...ERROR_RESPONSES,
    },
  },

  // Payments
  {
    path: "/api/payments/create-checkout",
    method: "POST",
    summary: "Create Stripe checkout session",
    description: "Creates a Stripe Checkout Session for clinic payments. Validates redirect URLs are same-origin.",
    tags: ["Payments"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["amount", "description"],
            properties: {
              amount: { type: "integer", description: "Amount in smallest currency unit (centimes)" },
              currency: { type: "string", description: "Currency code (default: mad)" },
              description: { type: "string" },
              patientId: { type: "string", format: "uuid" },
              appointmentId: { type: "string", format: "uuid" },
              successUrl: { type: "string", format: "uri" },
              cancelUrl: { type: "string", format: "uri" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Checkout session created with redirect URL" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/payments/webhook",
    method: "POST",
    summary: "Stripe webhook handler",
    description: "Processes Stripe webhook events (checkout.session.completed, payment_intent.payment_failed). Verifies stripe-signature header.",
    tags: ["Payments"],
    responses: {
      "200": { description: "Webhook processed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/payments/cmi",
    method: "POST",
    summary: "CMI payment initiation",
    description: "Initiates a payment via CMI (Centre Monétique Interbancaire) gateway for Moroccan bank cards.",
    tags: ["Payments"],
    security: true,
    responses: {
      "200": { description: "CMI payment form data returned" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/payments/cmi/callback",
    method: "POST",
    summary: "CMI payment callback",
    description: "Handles CMI payment gateway callback after card payment processing.",
    tags: ["Payments"],
    responses: {
      "200": { description: "Payment status updated" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/payment/initiate",
    method: "POST",
    summary: "Initiate booking payment",
    description: "Initiates the deposit payment flow for a booking that requires prepayment.",
    tags: ["Payments"],
    responses: {
      "200": { description: "Payment initiation details" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/payment/confirm",
    method: "POST",
    summary: "Confirm booking payment",
    description: "Confirms that a booking deposit payment was completed successfully.",
    tags: ["Payments"],
    responses: {
      "200": { description: "Payment confirmed, booking updated" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/booking/payment/refund",
    method: "POST",
    summary: "Refund booking payment",
    description: "Initiates a refund for a cancelled booking deposit.",
    tags: ["Payments"],
    security: true,
    responses: {
      "200": { description: "Refund initiated" },
      ...ERROR_RESPONSES,
    },
  },

  // Webhooks
  {
    path: "/api/webhooks",
    method: "POST",
    summary: "WhatsApp webhook handler",
    description: "Receives WhatsApp Business API webhooks. Verifies X-Hub-Signature-256, processes message replies (CONFIRM/CANCEL/RESCHEDULE), delivery statuses, rebooking responses, and feedback ratings.",
    tags: ["Webhooks"],
    responses: {
      "200": { description: "Webhook processed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/webhooks",
    method: "GET",
    summary: "WhatsApp webhook verification",
    description: "Meta webhook verification endpoint. Returns hub.challenge when hub.verify_token matches.",
    tags: ["Webhooks"],
    responses: {
      "200": { description: "Verification challenge returned" },
      "403": { description: "Invalid verify token" },
    },
  },

  // Cron Jobs
  {
    path: "/api/cron/reminders",
    method: "GET",
    summary: "Send appointment reminders",
    description: "Sends 24h and 1h appointment reminders via WhatsApp and in-app notifications. Protected by CRON_SECRET Bearer token.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Reminders processed with count of sent notifications" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/cron/notifications",
    method: "GET",
    summary: "Process pending notifications",
    description: "Processes queued notifications for delivery. Protected by CRON_SECRET.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Notifications processed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/cron/billing",
    method: "GET",
    summary: "Process billing cycle",
    description: "Processes subscription billing and generates invoices. Protected by CRON_SECRET.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Billing cycle processed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/cron/feedback",
    method: "GET",
    summary: "Send post-appointment feedback requests",
    description: "Sends feedback rating requests to patients after completed appointments. Protected by CRON_SECRET.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Feedback requests sent" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/cron/gdpr-purge",
    method: "GET",
    summary: "GDPR data purge",
    description: "Purges expired patient data per retention policies. Protected by CRON_SECRET.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Purge completed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/cron/rebooking-reminders",
    method: "GET",
    summary: "Send rebooking reminders",
    description: "Sends rebooking option reminders when doctor unavailability is detected. Protected by CRON_SECRET.",
    tags: ["Cron"],
    security: true,
    responses: {
      "200": { description: "Rebooking reminders sent" },
      ...ERROR_RESPONSES,
    },
  },

  // Branding
  {
    path: "/api/branding",
    method: "GET",
    summary: "Get clinic branding",
    description: "Returns public branding data (colors, fonts, logo, template) for the current clinic subdomain. Cached for 5 minutes. Applies WCAG AA contrast fallbacks.",
    tags: ["Branding"],
    responses: {
      "200": {
        description: "Clinic branding configuration",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                logo_url: { type: "string", format: "uri" },
                primary_color: { type: "string", description: "Hex color code" },
                secondary_color: { type: "string", description: "Hex color code" },
                heading_font: { type: "string" },
                body_font: { type: "string" },
                template_id: { type: "string", enum: ["modern", "classic", "minimal"] },
              },
            },
          },
        },
      },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/branding",
    method: "PUT",
    summary: "Update clinic branding",
    description: "Updates clinic branding fields (colors, fonts, name, tagline). Requires clinic_admin or super_admin role.",
    tags: ["Branding"],
    security: true,
    responses: {
      "200": { description: "Branding updated" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/branding",
    method: "POST",
    summary: "Upload branding image",
    description: "Uploads a branding image (logo, favicon, hero) to R2 storage. Validates file type via magic bytes. Max 5 MB.",
    tags: ["Branding"],
    security: true,
    requestBody: {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file", "field"],
            properties: {
              file: { type: "string", format: "binary" },
              field: { type: "string", enum: ["logo", "favicon", "hero", "cover"] },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Image uploaded, URL returned" },
      ...ERROR_RESPONSES,
    },
  },

  // Notifications
  {
    path: "/api/notifications",
    method: "GET",
    summary: "List notifications",
    description: "Returns in-app notifications for the authenticated user.",
    tags: ["Notifications"],
    security: true,
    responses: {
      "200": { description: "Array of notifications" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/notifications/trigger",
    method: "POST",
    summary: "Trigger notification",
    description: "Manually triggers a notification to a specific user via selected channels (whatsapp, email, in_app, sms).",
    tags: ["Notifications"],
    security: true,
    responses: {
      "200": { description: "Notification dispatched" },
      ...ERROR_RESPONSES,
    },
  },

  // Health
  {
    path: "/api/health",
    method: "GET",
    summary: "Health check",
    description: "Returns service status, uptime, and component-level health for database, R2 storage, WhatsApp API, and rate limiter. Cached for 30 seconds.",
    tags: ["Health"],
    responses: {
      "200": {
        description: "Service health status",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["ok", "degraded", "down"] },
                timestamp: { type: "string", format: "date-time" },
                checks: { type: "object", description: "Per-component health checks" },
              },
            },
          },
        },
      },
      "503": { description: "Service unavailable — critical components down" },
    },
  },

  // Impersonate
  {
    path: "/api/impersonate",
    method: "POST",
    summary: "Start impersonation",
    description: "Allows super_admin to impersonate another user. Requires re-authentication. Creates audit log entry.",
    tags: ["Impersonate"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["targetUserId", "password"],
            properties: {
              targetUserId: { type: "string", format: "uuid" },
              password: { type: "string", description: "Super admin password for re-auth" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Impersonation started, session cookie set" },
      "403": { description: "Not a super_admin or re-auth failed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/impersonate",
    method: "DELETE",
    summary: "Stop impersonation",
    description: "Ends the current impersonation session and restores the original super_admin identity.",
    tags: ["Impersonate"],
    security: true,
    responses: {
      "200": { description: "Impersonation ended" },
      ...ERROR_RESPONSES,
    },
  },

  // Onboarding
  {
    path: "/api/onboarding",
    method: "POST",
    summary: "Create clinic (onboarding)",
    description: "Creates a new clinic during the onboarding flow. Requires email verification. Generates subdomain from clinic name. Includes idempotency guard for retries.",
    tags: ["Onboarding"],
    security: true,
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["clinic_name", "clinic_type_key", "owner_name", "phone"],
            properties: {
              clinic_name: { type: "string" },
              clinic_type_key: { type: "string", description: "e.g. dental_clinic, pharmacy, general_medicine" },
              category: { type: "string", description: "e.g. medical, para_medical, diagnostic" },
              owner_name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string", format: "email" },
              city: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Clinic created with clinic_id and subdomain" },
      "409": { description: "Clinic already exists" },
      ...ERROR_RESPONSES,
    },
  },

  // Uploads
  {
    path: "/api/upload",
    method: "POST",
    summary: "Upload file",
    description: "Uploads a file to R2 storage. Validates file type via magic bytes and enforces size limits. Path traversal prevention via buildUploadKey().",
    tags: ["Uploads"],
    security: true,
    requestBody: {
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["file"],
            properties: {
              file: { type: "string", format: "binary" },
              category: { type: "string", description: "Upload category for path organization" },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "File uploaded, URL returned" },
      ...ERROR_RESPONSES,
    },
  },

  // CSP Reporting
  {
    path: "/api/csp-report",
    method: "POST",
    summary: "CSP violation report",
    description: "Receives Content-Security-Policy violation reports from browsers and forwards to Sentry.",
    tags: ["Security"],
    responses: {
      "204": { description: "Report received" },
    },
  },

  // Check-in
  {
    path: "/api/checkin/lookup",
    method: "GET",
    summary: "Look up appointment for check-in",
    description: "Finds a patient's appointment by phone number or appointment ID for the check-in kiosk.",
    tags: ["Check-in"],
    responses: {
      "200": { description: "Appointment details for check-in" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/checkin/confirm",
    method: "POST",
    summary: "Confirm check-in",
    description: "Marks a patient as checked in for their appointment.",
    tags: ["Check-in"],
    responses: {
      "200": { description: "Check-in confirmed" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/checkin/status",
    method: "GET",
    summary: "Get check-in status",
    description: "Returns the current check-in/queue status for a patient.",
    tags: ["Check-in"],
    responses: {
      "200": { description: "Check-in status" },
      ...ERROR_RESPONSES,
    },
  },

  // Chat
  {
    path: "/api/chat",
    method: "POST",
    summary: "AI chat",
    description: "Sends a message to the AI chatbot assistant. Supports Smart (Cloudflare Workers AI) and Advanced (OpenAI-compatible) levels.",
    tags: ["Chat"],
    security: true,
    responses: {
      "200": { description: "AI response" },
      ...ERROR_RESPONSES,
    },
  },

  // Custom Fields
  {
    path: "/api/custom-fields",
    method: "GET",
    summary: "List custom fields",
    description: "Returns custom field definitions for the clinic.",
    tags: ["Custom Fields"],
    security: true,
    responses: {
      "200": { description: "Array of custom field definitions" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/custom-fields",
    method: "POST",
    summary: "Create custom field",
    description: "Creates a new custom field definition for the clinic.",
    tags: ["Custom Fields"],
    security: true,
    responses: {
      "200": { description: "Custom field created" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/custom-fields/values",
    method: "POST",
    summary: "Set custom field values",
    description: "Sets custom field values for a specific patient or appointment.",
    tags: ["Custom Fields"],
    security: true,
    responses: {
      "200": { description: "Values saved" },
      ...ERROR_RESPONSES,
    },
  },

  // Radiology
  {
    path: "/api/radiology/orders",
    method: "POST",
    summary: "Create radiology order",
    description: "Creates a new radiology imaging order for a patient.",
    tags: ["Radiology"],
    security: true,
    responses: {
      "200": { description: "Order created" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/radiology/upload",
    method: "POST",
    summary: "Upload radiology image",
    description: "Uploads a radiology image (X-ray, scan) to R2 storage with PHI encryption.",
    tags: ["Radiology"],
    security: true,
    responses: {
      "200": { description: "Image uploaded" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/radiology/report-pdf",
    method: "POST",
    summary: "Generate radiology report PDF",
    description: "Generates a PDF report for a radiology order.",
    tags: ["Radiology"],
    security: true,
    responses: {
      "200": { description: "PDF generated" },
      ...ERROR_RESPONSES,
    },
  },

  // Lab
  {
    path: "/api/lab/report-html",
    method: "POST",
    summary: "Generate lab report HTML",
    description: "Generates an HTML lab report for a patient's test results.",
    tags: ["Lab"],
    security: true,
    responses: {
      "200": { description: "HTML report generated" },
      ...ERROR_RESPONSES,
    },
  },

  // Consent
  {
    path: "/api/consent",
    method: "POST",
    summary: "Record patient consent",
    description: "Records patient consent for treatment, data processing, or communication preferences.",
    tags: ["Consent"],
    security: true,
    responses: {
      "200": { description: "Consent recorded" },
      ...ERROR_RESPONSES,
    },
  },

  // Clinic Features
  {
    path: "/api/clinic-features",
    method: "GET",
    summary: "Get clinic feature flags",
    description: "Returns enabled features and tier limits for the current clinic.",
    tags: ["Clinic Features"],
    security: true,
    responses: {
      "200": { description: "Feature flags and limits" },
      ...ERROR_RESPONSES,
    },
  },

  // Doctor Unavailability
  {
    path: "/api/doctor-unavailability",
    method: "POST",
    summary: "Set doctor unavailability",
    description: "Marks a doctor as unavailable for a date range. Triggers rebooking notifications for affected appointments.",
    tags: ["Scheduling"],
    security: true,
    responses: {
      "200": { description: "Unavailability recorded" },
      ...ERROR_RESPONSES,
    },
  },

  // Patient Self-Service
  {
    path: "/api/patient/export",
    method: "GET",
    summary: "Export patient data",
    description: "Exports the authenticated patient's data in a portable format (GDPR/Law 09-08 data portability).",
    tags: ["Patient Self-Service"],
    security: true,
    responses: {
      "200": { description: "Patient data export" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/patient/delete-account",
    method: "DELETE",
    summary: "Delete patient account",
    description: "Permanently deletes the authenticated patient's account and personal data (right to erasure).",
    tags: ["Patient Self-Service"],
    security: true,
    responses: {
      "200": { description: "Account deleted" },
      ...ERROR_RESPONSES,
    },
  },

  // AI Endpoints
  {
    path: "/api/v1/ai/prescription",
    method: "POST",
    summary: "AI prescription assistance",
    description: "Generates medication prescription suggestions using AI. Doctor review required.",
    tags: ["AI"],
    security: true,
    responses: {
      "200": { description: "AI-generated prescription suggestions" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/ai/drug-check",
    method: "POST",
    summary: "AI drug interaction check",
    description: "Checks for potential drug interactions in a prescription.",
    tags: ["AI"],
    security: true,
    responses: {
      "200": { description: "Interaction check results" },
      ...ERROR_RESPONSES,
    },
  },
  {
    path: "/api/v1/ai/patient-summary",
    method: "POST",
    summary: "AI patient summary",
    description: "Generates a concise patient summary from medical history using AI.",
    tags: ["AI"],
    security: true,
    responses: {
      "200": { description: "AI-generated patient summary" },
      ...ERROR_RESPONSES,
    },
  },

  // Cache
  {
    path: "/api/v1/cache/invalidate",
    method: "POST",
    summary: "Invalidate cache",
    description: "Invalidates specific cache keys or patterns. Requires super_admin role.",
    tags: ["Admin"],
    security: true,
    responses: {
      "200": { description: "Cache invalidated" },
      ...ERROR_RESPONSES,
    },
  },

  // Register Clinic (v1)
  {
    path: "/api/v1/register-clinic",
    method: "POST",
    summary: "Register new clinic (v1)",
    description: "Alternative clinic registration endpoint via the v1 API.",
    tags: ["Onboarding"],
    security: true,
    responses: {
      "200": { description: "Clinic registered" },
      ...ERROR_RESPONSES,
    },
  },
];

/**
 * Generate the full OpenAPI specification
 */
export function generateOpenApiSpec(): object {
  const paths: Record<string, Record<string, object>> = {};

  for (const endpoint of apiEndpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      security: endpoint.security ? [{ bearerAuth: [] }] : [],
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
    };
  }

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: "Oltigo API",
      version: API_VERSION,
      description: `
## Overview
Oltigo is a healthcare management platform for clinics in Morocco.

## Authentication
All endpoints (except public booking) require a JWT token from Supabase Auth.
Include in header: \`Authorization: Bearer <token>\`

## Rate Limiting
- Default: 30 requests/minute per IP
- Login: 5 requests/minute
- Booking: 10 requests/minute
- Returns X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers

## Moroccan-Specific Features
- Phone numbers use Moroccan format (+212)
- Insurance supports CNSS, CNOPS, AMO, RAMED
- Payment methods: cash, card (CMI), CashPlus, Wafacash, Barid Bank

## Base URL
Production: https://oltigo.com/api
      `.trim(),
      contact: {
        name: "Oltigo Support",
        email: "support@oltigo.com",
        url: "https://oltigo.com/contact",
      },
      license: {
        name: "Proprietary",
        url: "https://oltigo.com/terms",
      },
    },
    servers: [
      {
        url: "https://oltigo.com",
        description: "Production server",
      },
      {
        url: "https://staging.oltigo.com",
        description: "Staging server",
      },
    ],
    components: {
      securitySchemes: SECURITY_SCHEMES,
    },
    paths,
    tags: [
      { name: "Appointments", description: "Appointment management endpoints" },
      { name: "Patients", description: "Patient registry and management" },
      { name: "Auth", description: "Authentication and email verification" },
      { name: "Booking", description: "Public booking flow (slots, OTP, create, cancel, reschedule)" },
      { name: "Payments", description: "Stripe and CMI payment processing" },
      { name: "Webhooks", description: "WhatsApp Business API webhook handlers" },
      { name: "Cron", description: "Scheduled jobs (reminders, billing, feedback, GDPR purge)" },
      { name: "Branding", description: "Clinic branding and theming" },
      { name: "Notifications", description: "In-app, WhatsApp, email, and SMS notifications" },
      { name: "Health", description: "Service health checks and monitoring" },
      { name: "Impersonate", description: "Super admin user impersonation" },
      { name: "Onboarding", description: "Clinic registration and setup" },
      { name: "Uploads", description: "File upload to R2 storage" },
      { name: "Security", description: "CSP violation reporting" },
      { name: "Check-in", description: "Patient check-in kiosk" },
      { name: "Chat", description: "AI chatbot assistant" },
      { name: "Custom Fields", description: "Custom field definitions and values" },
      { name: "Radiology", description: "Radiology orders, imaging, and reports" },
      { name: "Lab", description: "Lab test results and reports" },
      { name: "Consent", description: "Patient consent management" },
      { name: "Clinic Features", description: "Feature flags and tier limits" },
      { name: "Scheduling", description: "Doctor availability and scheduling" },
      { name: "Patient Self-Service", description: "Patient data export and account deletion" },
      { name: "AI", description: "AI-powered clinical assistance" },
      { name: "Admin", description: "Administrative operations" },
    ],
  };
}

/**
 * GET handler - returns OpenAPI JSON spec
 */
export async function GET(_request: NextRequest) {
  const spec = generateOpenApiSpec();
  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
