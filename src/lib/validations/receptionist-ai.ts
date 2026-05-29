import { z } from "zod";
import { isoDate, timeHHMM } from "./primitives";

// ── Smart Scheduling ──

export const smartScheduleSchema = z.object({
  doctorId: z.string().min(1),
  serviceId: z.string().min(1),
  patientId: z.string().min(1),
  preferredDate: isoDate,
  preferredTimeStart: timeHHMM.optional(),
  preferredTimeEnd: timeHHMM.optional(),
  isFirstVisit: z.boolean().optional(),
  urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

export const smartScheduleConfirmSchema = z.object({
  doctorId: z.string().min(1),
  serviceId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  date: isoDate,
  time: timeHHMM,
  slotDuration: z.number().int().positive(),
  bufferTime: z.number().int().min(0),
  isFirstVisit: z.boolean().optional(),
  hasInsurance: z.boolean().optional(),
});

// ── Automated Reminders ──

export const sendRemindersSchema = z.object({
  appointmentId: z.string().min(1).optional(),
  reminderType: z.enum(["24h", "2h"]),
  dryRun: z.boolean().optional(),
});

// ── Waitlist Manager ──

export const waitlistAddSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1).max(200),
  patientPhone: z.string().max(30).optional(),
  doctorId: z.string().min(1),
  serviceId: z.string().optional(),
  preferredDate: isoDate,
  preferredTime: timeHHMM.optional(),
  urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const waitlistNotifySchema = z.object({
  entryId: z.string().min(1),
  availableDate: isoDate,
  availableTime: timeHHMM,
});

export const waitlistPromoteSchema = z.object({
  entryId: z.string().min(1),
  date: isoDate,
  time: timeHHMM,
  slotDuration: z.number().int().positive(),
  bufferTime: z.number().int().min(0),
});

// ── No-Show Tracking ──

export const noShowMarkSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

export const noShowAnalyticsQuerySchema = z.object({
  doctorId: z.string().optional(),
  patientId: z.string().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});
