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
    ],
  };
}

/**
 * GET handler - returns OpenAPI JSON spec
 */
export async function GET(request: NextRequest) {
  const spec = generateOpenApiSpec();
  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}