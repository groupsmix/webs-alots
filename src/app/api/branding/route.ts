/**
 * GET  /api/branding         — Fetch current clinic branding
 * PUT  /api/branding         — Update clinic branding fields (colors, fonts)
 * POST /api/branding         — Upload a branding image (logo, favicon, hero)
 *                              and persist the URL to the clinics table
 */

import { NextResponse, type NextRequest } from "next/server";
import { clinicConfig } from "@/config/clinic.config";
import { createClient } from "@/lib/supabase-server";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
} from "@/lib/r2";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const FIELD_MAP: Record<string, string> = {
  logo: "logo_url",
  favicon: "favicon_url",
  hero: "hero_image_url",
};

// ── GET — return current branding ──

export async function GET() {
  const clinicId = clinicConfig.clinicId;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinics")
    .select(
      "logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url",
    )
    .eq("id", clinicId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        logo_url: null,
        favicon_url: null,
        primary_color: "#1E4DA1",
        secondary_color: "#0F6E56",
        heading_font: "Geist",
        body_font: "Geist",
        hero_image_url: null,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(data);
}

// ── PUT — update text branding fields (colors, fonts) ──

export async function PUT(request: NextRequest) {
  const clinicId = clinicConfig.clinicId;
  const body = await request.json();

  const allowed = [
    "primary_color",
    "secondary_color",
    "heading_font",
    "body_font",
  ];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof body[key] === "string" && body[key].trim()) {
      updates[key] = body[key].trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update(updates)
    .eq("id", clinicId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update branding" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// ── POST — upload a branding image and save URL ──

export async function POST(request: NextRequest) {
  const clinicId = clinicConfig.clinicId;

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
  const url = await uploadToR2(key, buffer, file.type);

  if (!url) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }

  // Persist the URL to the clinics table
  const column = FIELD_MAP[field];
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ [column]: url })
    .eq("id", clinicId);

  if (error) {
    return NextResponse.json(
      { error: "Upload succeeded but failed to save URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url, key });
}
