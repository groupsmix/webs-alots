import { z } from "zod";
import { passwordPolicySchema } from "./password-policy";

/** Invite a staff member — adapted from MediFlow onboarding flow. */
export const staffInviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(["clinic_admin", "receptionist", "doctor"]),
});

/** Accept a staff invitation. */
export const staffInviteAcceptSchema = z.object({
  token: z.string().min(1).max(256),
  full_name: z.string().min(1).max(200),
  password: passwordPolicySchema.max(128),
});

/** Revoke a pending invitation. */
export const staffInviteRevokeSchema = z.object({
  invitation_id: z.string().uuid(),
});

/** Query staff invitations. */
export const staffInviteQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "expired", "revoked"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
