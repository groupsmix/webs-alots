import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (request: NextRequest, auth: unknown) => Promise<Response>) =>
    (request: NextRequest) => handler(request, {}),
}));

vi.mock("@/lib/env", () => ({
  getAnthropicApiKey: vi.fn(() => ""),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/onboarding/state", () => ({
  syncClinicOnboardingState: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase-server", () => ({
  createUntypedAdminClient: vi.fn(() => ({})),
}));

function buildRequest(file: File): NextRequest {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("clinic_id", "11111111-1111-1111-1111-111111111111");
  formData.append("clinic_name", "Clinique Test");

  return new NextRequest("http://localhost:3000/api/admin/onboarding/extract", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/admin/onboarding/extract — upload validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects oversized onboarding documents", async () => {
    const { POST, MAX_ONBOARDING_DOCUMENT_BYTES } = await import(
      "@/app/api/admin/onboarding/extract/route"
    );

    const oversized = new File([
      new Uint8Array(MAX_ONBOARDING_DOCUMENT_BYTES + 1),
    ], "legal-doc.pdf", {
      type: "application/pdf",
    });

    const response = await POST(buildRequest(oversized));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/file too large/i);
  });

  it("rejects empty onboarding documents", async () => {
    const { POST } = await import("@/app/api/admin/onboarding/extract/route");

    const empty = new File([], "legal-doc.pdf", {
      type: "application/pdf",
    });

    const response = await POST(buildRequest(empty));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/must not be empty/i);
  });
});
