/**
 * GET /api/messages — List messages for authenticated user
 * POST /api/messages — Send a new message
 *
 * Note: Uses type assertions for the `messages` table since it is added
 * in migration 00132 and not yet in the generated Database types.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/audit-log";
import { withAuth, type AuthContext } from "@/lib/with-auth";

const sendMessageSchema = z.object({
  recipientId: z.string().uuid(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
  parentMessageId: z.string().uuid().optional(),
  attachmentKeys: z.array(z.string()).max(5).optional(),
});

async function handleGet(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic association", 403, "FORBIDDEN");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = auth.supabase as any;
  let query = client
    .from("messages")
    .select("*", { count: "exact" })
    .eq("clinic_id", clinicId)
    .or(`sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (threadId) {
    query = query.eq("thread_id", threadId);
  }
  if (unreadOnly) {
    query = query.eq("is_read", false).eq("recipient_id", auth.user.id);
  }

  const { data, error, count } = await query;
  if (error) {
    return apiError("Failed to fetch messages", 500, "DB_ERROR");
  }

  return apiSuccess({ messages: data, total: count });
}

async function handlePost(req: NextRequest, auth: AuthContext): Promise<NextResponse> {
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const clinicId = auth.profile.clinic_id;
  if (!clinicId) {
    return apiError("No clinic association", 403, "FORBIDDEN");
  }

  const { recipientId, subject, body: messageBody, parentMessageId, attachmentKeys } = parsed.data;

  // Verify recipient belongs to same clinic
  const { data: recipient } = await auth.supabase
    .from("users")
    .select("id, clinic_id")
    .eq("id", recipientId)
    .eq("clinic_id", clinicId)
    .single();

  if (!recipient) {
    return apiError("Recipient not found in clinic", 404, "NOT_FOUND");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = auth.supabase as any;
  const { data: message, error } = await client
    .from("messages")
    .insert({
      clinic_id: clinicId,
      sender_id: auth.user.id,
      recipient_id: recipientId,
      subject,
      body: messageBody,
      parent_message_id: parentMessageId ?? null,
      attachment_keys: attachmentKeys ?? [],
    })
    .select()
    .single();

  if (error) {
    return apiError("Failed to send message", 500, "DB_ERROR");
  }

  void logAuditEvent({
    supabase: auth.supabase,
    type: "patient",
    action: "message_sent",
    clinicId,
    actor: auth.user.id,
    metadata: { recipientId, hasAttachments: (attachmentKeys?.length ?? 0) > 0 },
  });

  return apiSuccess({ message }, 201);
}

export const GET = withAuth(handleGet, ["doctor", "clinic_admin", "patient", "receptionist"]);
export const POST = withAuth(handlePost, ["doctor", "clinic_admin", "patient"]);
