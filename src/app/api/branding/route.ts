/**
 * GET  /api/branding         — Fetch current clinic branding
 * PUT  /api/branding         — Update clinic branding fields (colors, fonts)
 * POST /api/branding         — Upload a branding image (logo, favicon, hero)
 *                              and persist the URL to the clinics table
 */

import { revalidatePath } from "next/cache";
import { apiError, apiInternalError, apiSuccess } from "@/lib/api-response";
import { withAuthValidation } from "@/lib/api-validate";
import { meetsWCAG_AA, WCAG_SAFE_DEFAULTS } from "@/lib/contrast";
import { logger } from "@/lib/logger";
import {
  uploadToR2,
  isR2Configured,
  buildUploadKey,
  getResponsiveImageUrls,
} from "@/lib/r2";
import { invalidateAllSubdomainCaches } from "@/lib/subdomain-cache";
import { createTenantClient } from "@/lib/supabase-server";
import { getTenant, requireTenant } from "@/lib/tenant";
import type { UserRole } from "@/lib/types/database";
import { brandingUpdateSchema } from "@/lib/validations";
import { withAuth } from "@/lib/with-auth";

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
    const tenant = await getTenant();

    if (!tenant?.clinicId) {
      return apiError("No clinic context. This endpoint requires a clinic subdomain.");
    }

    const clinicId = tenant.clinicId;
    const supabase = await createTenantClient(clinicId);

    const { data, error } = await supabase
      .from("clinics")
      .select(
        "name, logo_url, favicon_url, primary_color, secondary_color, heading_font, body_font, hero_image_url, tagline, cover_photo_url, template_id, section_visibility, website_config, phone, address",
      )
      .eq("id", clinicId)
      .single();

    if (error || !data) {
      return apiSuccess({
        name: tenant.clinicName || "Clinic",
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
        website_config: null,
        phone: null,
        address: null,
      });
    }

    // MED-01: Redact potentially sensitive contact fields from the
    // unauthenticated public branding response.  Name, colors, fonts,
    // images, and template settings are intentionally public (needed to
    // render the clinic's branded booking page).  Phone and address are
    // PII that should only be visible to authenticated users.
    const { phone: _phone, address: _address, ...publicData } = data;

    // Issue 8: Server-side contrast fallback — if custom colors fail
    // WCAG AA against white, fall back to accessible defaults so public
    // pages always render with sufficient contrast.
    const primaryColor = publicData.primary_color ?? WCAG_SAFE_DEFAULTS.primary;
    const secondaryColor = publicData.secondary_color ?? WCAG_SAFE_DEFAULTS.secondary;
    if (!meetsWCAG_AA("#ffffff", primaryColor)) {
      publicData.primary_color = WCAG_SAFE_DEFAULTS.primary;
    }
    if (!meetsWCAG_AA("#ffffff", secondaryColor)) {
      publicData.secondary_color = WCAG_SAFE_DEFAULTS.secondary;
    }

    return apiSuccess(publicData, 200, { "Cache-Control": "public, max-age=300" });
  } catch (err) {
    logger.warn("Operation failed", { context: "branding", error: err });
    return apiInternalError("Failed to fetch branding");
  }
}

// ── PUT — update text branding fields (colors, fonts) ──

export const PUT = withAuthValidation(brandingUpdateSchema, async (body, request, { supabase }) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

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
    return apiError("No valid fields to update");
  }

  const { error } = await supabase
    .from("clinics")
    .update(updates)
    .eq("id", clinicId);

  if (error) {
    logger.warn("Operation failed", { context: "branding", error });
    return apiInternalError("Failed to update branding");
  }

  // Invalidate branding cache so public pages pick up the change
  revalidatePath("/", "layout");

  // Invalidate subdomain cache so middleware picks up any name/config changes
  invalidateAllSubdomainCaches();

  return apiSuccess({ ok: true });
}, ADMIN_ROLES);

// ── POST — upload a branding image and save URL ──

export const POST = withAuth(async (request, { supabase }) => {
  const tenant = await requireTenant();
  const clinicId = tenant.clinicId;

  if (!isR2Configured()) {
    return apiError("File storage is not configured", 503);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const field = (formData.get("field") as string) || "";

  if (!FIELD_MAP[field]) {
    return apiError("field must be one of: logo, favicon, hero");
  }

  if (!file || !(file instanceof File)) {
    return apiError("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiError("File too large (max 5 MB)");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return apiError(`File type not allowed: ${file.type}`);
  }

  const key = buildUploadKey(clinicId, "branding", `${field}-${file.name}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate file content matches declared MIME type via magic bytes.
  if (!validateFileContent(buffer, file.type)) {
    return apiError("File content does not match declared type");
  }

  const url = await uploadToR2(key, buffer, file.type);

  if (!url) {
    // A84-F3: User-friendly error with structured logging for R2 outages.
    logger.error("Branding upload failed — R2 storage unavailable or write error", {
      context: "branding",
      clinicId,
      field,
      contentType: file.type,
      fileSize: file.size,
    });
    return apiError(
      "Image upload failed. Please try again later or contact support if the problem persists.",
      502,
      "STORAGE_UNAVAILABLE",
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
    return apiInternalError("Upload succeeded but failed to save URL");
  }

  // Invalidate branding cache so public pages pick up the new image
  revalidatePath("/", "layout");

  // Invalidate subdomain cache so middleware picks up any config changes
  invalidateAllSubdomainCaches();

  // L3-H2: Return Cloudflare Image Resizing thumbnails so the admin panel
  // can display optimized previews immediately after upload.
  const thumbnails = getResponsiveImageUrls(url);

  return apiSuccess({ url, key, thumbnails });
}, ADMIN_ROLES);
