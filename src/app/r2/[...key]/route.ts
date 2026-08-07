import { NextResponse, type NextRequest } from "next/server";
import { apiError, apiNotFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { getR2Bucket } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MAX_KEY_LENGTH = 1024;

// The local worker-env.d.ts exposes a minimal R2ObjectBody interface without
// the runtime body/etag/uploaded properties. Cast to this extended shape so
// we can stream the object instead of buffering it in the Worker.
interface R2ObjectBodyStream extends R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  httpEtag?: string;
  uploaded?: Date;
}

function isSafeKey(key: string): boolean {
  if (!key) return false;
  if (key.length > MAX_KEY_LENGTH) return false;
  if (key.startsWith("/")) return false;
  if (key.includes("..")) return false;
  if (key.includes("\\")) return false;
  if (/\u0000/.test(key)) return false;
  if (/%00/i.test(key)) return false;
  if (/[\u0000-\u001f\u007f]/.test(key)) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(key)) return false;
  return true;
}

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "application/octet-stream";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key?: string[] }> },
): Promise<NextResponse> {
  const raw = (await params).key;
  const key = Array.isArray(raw) ? raw.join("/") : raw;

  if (!key || !isSafeKey(key)) {
    return apiNotFound();
  }

  // Encrypted PHI files are intentionally not served by this public proxy.
  if (key.toLowerCase().endsWith(".enc")) {
    return apiNotFound();
  }

  const bucket = await getR2Bucket();
  if (!bucket) {
    logger.error("R2 bucket binding not available", { context: "r2-proxy" });
    return apiError("Storage unavailable", 503, "STORAGE_UNAVAILABLE");
  }

  let object;
  try {
    object = await bucket.get(key);
  } catch (err) {
    logger.error("Failed to fetch object from R2", { context: "r2-proxy", key, error: err });
    return apiError("Storage unavailable", 503, "STORAGE_UNAVAILABLE");
  }

  if (!object) {
    return apiNotFound();
  }

  const obj = object as R2ObjectBodyStream;
  if (obj.body == null) {
    return apiNotFound();
  }

  const contentType = obj.httpMetadata?.contentType || contentTypeForKey(key);
  const filename = key.split("/").pop() || "download";
  // Images are safe to display inline; everything else is treated as a
  // download to avoid accidental execution of uploaded content.
  const disposition = contentType.startsWith("image/") ? "inline" : "attachment";

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `${disposition}; filename="${filename}"`,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  if (typeof obj.size === "number" && obj.size >= 0) {
    headers.set("Content-Length", String(obj.size));
  }
  if (obj.httpEtag) {
    headers.set("ETag", obj.httpEtag);
  }
  if (obj.uploaded) {
    headers.set("Last-Modified", obj.uploaded.toUTCString());
  }

  return new NextResponse(obj.body, { headers });
}
