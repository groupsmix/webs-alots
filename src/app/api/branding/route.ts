/**
 * GET  /api/branding         — Fetch current clinic branding
 * PUT  /api/branding         — Update clinic branding fields (colors, fonts)
 * POST /api/branding         — Upload a branding image (logo, favicon, hero)
 *                              and persist the URL to the clinics table
 */

import { NextResponse } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { createClient } from "@/lib/supabase-server";
import { requireTenant } from "@/lib/tenant";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
} from "@/lib/r2";
import type { UserRole } from "@/lib/types/database";
import { withAuth } from "@/lib/with-auth";
import { logger } from "@/lib/logger";
import { brandingUpdateSchema, safeParse } from "@/lib/validations";

const ADMIN_ROLES: UserRole[] = ["super_admin", "clinic_admin"];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  // SVG removed: can contain embedded <script> tags leading to XSS
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

// Magic byte signatures for server-side file content validation.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/x-icon": [new Uint8Array([0x00, 0x00, 0x01, 0x00])],
  "image/vnd.microsoft.icon": [new Uint8Array([0x00, 0x00, 0x01, 0x00])],
};

function validateFileContent(buffer: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => i < buffer.length && buffer[i] === byte),
  );
}

const FIELD_MAP: Record<string, string> = {
  logo: "logo_url",
  favicon: "favicon_url",
  hero: "hero_image_url",
  cover: "cover_photo_url",
};

// ── GET — return current branding ──

export async function GET() {
  try {
    const tenant = await requireTenant();
    const clinicId = tenant.clinicId;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clinics")
      .select(
        "name, logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url, tagline, cover_photo_url, template_id, section_visibility, phone, address",
      )
      .eq("id", clinicId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          name: clinicConfig.name,
          logo_url: null,
          favicon_url: null,
          primary_color: "#1E4DA1",
          secondary_color: "#0F6E56",
          heading_font: "Geist",
          body_font: "Geist",
          hero_image_url: null,
          tagline: null,
          cover_photo_url: null,
          template_id: "modern",
          section_visibility: {},
          phone: null,
          address: null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    logger.warn("Operation failed", { context: "branding", error: err });
    return NextResponse.json(
      { error: "Failed to fetch branding" },
      { status: 500 },
    );
  }
}

// ── PUT — update text branding fields (colors, fonts) ──

export const PUT = withAuth(async (request, { supabase }) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;
  const raw = await request.json();
  const parsed = safeParse(brandingUpdateSchema, raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = {};
  const stringKeys = [
    "primary_color",
    "secondary_color",
    "heading_font",
    "body_font",
    "name",
    "tagline",
    "phone",
    "address",
    "template_id",
  ] as const;
  for (const key of stringKeys) {
    const val = body[key as keyof typeof body];
    if (typeof val === "string") {
      updates[key] = val.trim();
    }
  }

  // Handle section_visibility as JSONB
  if (body.section_visibility && typeof body.section_visibility === "object") {
    updates.section_visibility = body.section_visibility;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("clinics")
    .update(updates)
    .eq("id", clinicId);

  if (error) {
    logger.warn("Operation failed", { context: "branding", error });
    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}, ADMIN_ROLES);

// ── POST — upload a branding image and save URL ──

export const POST = withAuth(async (request, { supabase }) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured" },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const field = (formData.get("field") as string) || "";

  if (!FIELD_MAP[field]) {
    return NextResponse.json(
      { error: "field must be one of: logo, favicon, hero" },
      { status: 400 },
    );
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 400 },
    );
  }

  const key = buildUploadKey(clinicId, "branding", `${field}-${file.name}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate file content matches declared MIME type via magic bytes.
  if (!validateFileContent(buffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match declared type" },
      { status: 400 },
    );
  }

  const url = await uploadToR2(key, buffer, file.type);

  if (!url) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }

  // Persist the URL to the clinics table
  const column = FIELD_MAP[field];
  const { error } = await supabase
    .from("clinics")
    .update({ [column]: url })
    .eq("id", clinicId);

  if (error) {
    logger.warn("Operation failed", { context: "branding", error });
    return NextResponse.json(
      { error: "Upload succeeded but failed to save URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url, key });
}, ADMIN_ROLES);
