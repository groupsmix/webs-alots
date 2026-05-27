import { z } from "zod";
import { isoDate, timeHHMM } from "./primitives";

export const bookingCancelSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

const emergencySlotCreateSchema = z.object({
  action: z.literal("create"),
  doctorId: z.string().min(1),
  date: isoDate,
  startTime: timeHHMM,
  durationMin: z.number().int().min(1).max(480),
  reason: z.string().max(1000).optional(),
});

const emergencySlotBookSchema = z.object({
  action: z.literal("book"),
  slotId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  serviceId: z.string().optional(),
});

export const emergencySlotSchema = z.discriminatedUnion("action", [
  emergencySlotCreateSchema,
  emergencySlotBookSchema,
]);

const recurringCreateSchema = z.object({
  action: z.literal("create"),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  doctorId: z.string().min(1),
  serviceId: z.string().optional(),
  date: isoDate,
  time: timeHHMM,
  pattern: z.enum(["weekly", "biweekly", "monthly"]),
  occurrences: z.number().int().min(1).max(52),
  isFirstVisit: z.boolean().optional(),
  hasInsurance: z.boolean().optional(),
});

const recurringCancelSchema = z.object({
  action: z.literal("cancel"),
  groupId: z.string().optional(),
  cancelAll: z.boolean().optional(),
  appointmentId: z.string().optional(),
});

export const recurringSchema = z.discriminatedUnion("action", [
  recurringCreateSchema,
  recurringCancelSchema,
]);

export const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  newDate: isoDate,
  newTime: timeHHMM,
});

export const waitingListSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  doctorId: z.string().min(1),
  preferredDate: isoDate,
  preferredTime: timeHHMM.optional(),
  serviceId: z.string().optional(),
  /** Honeypot field – hidden from real users, filled only by bots (Issue 51) */
  website: z.string().max(200).optional(),
});

export const waitingListDeleteSchema = z.object({
  entryId: z.string().min(1),
});

export const doctorUnavailabilitySchema = z.object({
  doctorId: z.string().min(1),
  /** AUDIT F-01: clinicId is now optional — subdomain-derived tenant is authoritative.
   *  If provided, it is validated against the subdomain in the route handler. */
  clinicId: z.string().min(1).optional(),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().max(1000).optional(),
});

export const checkinConfirmSchema = z.object({
  appointmentId: z.string().min(1),
  /** AUDIT F-04: clinicId is now optional — subdomain-derived tenant is authoritative.
   *  If provided, it is validated against the subdomain in the route handler. */
  clinicId: z.string().min(1).optional(),
});
