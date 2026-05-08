/**
 * Unit tests for File Ownership Tracking (A7-01)
 *
 * Tests the file ownership tracking functionality that links R2 keys
 * to patient IDs in the patient_files table for proper authorization.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock dependencies
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: vi.fn(() => true),
  uploadToR2: vi.fn(() => Promise.resolve("https://r2.example.com/file.pdf")),
  buildUploadKey: vi.fn((clinicId, category, filename) => 
    `clinics/${clinicId}/${category}/${filename}`
  ),
}));

vi.mock("@/lib/encryption", () => ({
  requiresEncryption: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: vi.fn((handler) => handler),
}));

// Helper to create mock request with file upload
function createMockUploadRequest(
  file: File,
  category: string = "documents",
  clinicId?: string
): NextRequest {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  if (clinicId) {
    formData.append("clinicId", clinicId);
  }

  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: formData,
  });
}

// Helper to create mock Supabase client
function createMockSupabaseClient(insertResult: { error?: any } = {}): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue(insertResult),
    }),
  } as unknown as SupabaseClient;
}

// Helper to create mock file
function createMockFile(name: string, type: string, content: string = "test content"): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe("File Ownership Tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Patient Upload Tracking", () => {
    it("should track patient uploads with uploader as patient_id", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      // Mock patient profile
      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      // Import and call the upload handler
      const { POST } = await import("@/app/api/upload/route");
      
      // Mock the handler context
      const mockContext = {
        profile: patientProfile,
      };

      await POST(request, mockContext);

      // Verify patient_files insert was called
      expect(mockSupabase.from).toHaveBeenCalledWith("patient_files");
      
      const insertCall = (mockSupabase.from as any).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        clinic_id: "clinic-456",
        patient_id: "patient-123", // Patient uploads use their own ID
        r2_key: "clinics/clinic-456/documents/report.pdf",
        content_type: "application/pdf",
        uploaded_by: "patient-123",
      });
    });

    it("should handle patient upload tracking errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        error: { message: "Database error" },
      });
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: patientProfile };
      const response = await POST(request, mockContext);

      // Upload should still succeed even if tracking fails
      expect(response.status).toBe(200);
      
      // Verify warning was logged
      const { logger } = await import("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to track file ownership",
        expect.objectContaining({
          context: "upload/track-ownership",
          clinicId: "clinic-456",
          patientId: "patient-123",
        })
      );
    });
  });

  describe("Staff Upload Tracking", () => {
    it("should track staff uploads with extracted patient_id from R2 key", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      // Mock doctor profile
      const doctorProfile = {
        id: "doctor-789",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      // Mock buildUploadKey to return a patient-specific path
      const { buildUploadKey } = vi.mocked(await import("@/lib/r2"));
      buildUploadKey.mockReturnValue(
        "clinics/clinic-456/patients/patient-123/documents/report.pdf"
      );

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: doctorProfile };
      await POST(request, mockContext);

      // Verify patient_files insert was called with extracted patient_id
      const insertCall = (mockSupabase.from as any).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        clinic_id: "clinic-456",
        patient_id: "patient-123", // Extracted from R2 key path
        r2_key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
        content_type: "application/pdf",
        uploaded_by: "doctor-789",
      });
    });

    it("should not track staff uploads without patient_id in key", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-789",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      // Mock buildUploadKey to return a staff-only path (no patient_id)
      const { buildUploadKey } = vi.mocked(await import("@/lib/r2"));
      buildUploadKey.mockReturnValue(
        "clinics/clinic-456/logos/clinic_logo.png"
      );

      const file = createMockFile("logo.png", "image/png");
      const request = createMockUploadRequest(file, "logos");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: doctorProfile };
      await POST(request, mockContext);

      // Verify patient_files insert was NOT called (no patient_id in path)
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("should handle invalid patient_id in R2 key gracefully", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-789",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      // Mock buildUploadKey to return path with invalid patient_id
      const { buildUploadKey } = vi.mocked(await import("@/lib/r2"));
      buildUploadKey.mockReturnValue(
        "clinics/clinic-456/patients/invalid-uuid/documents/report.pdf"
      );

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: doctorProfile };
      await POST(request, mockContext);

      // Verify patient_files insert was NOT called (invalid patient_id)
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Super Admin Upload Tracking", () => {
    it("should track super admin uploads with target clinic", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const superAdminProfile = {
        id: "admin-999",
        role: "super_admin" as const,
        clinic_id: null, // Super admin has no clinic
      };

      // Mock buildUploadKey for target clinic
      const { buildUploadKey } = vi.mocked(await import("@/lib/r2"));
      buildUploadKey.mockReturnValue(
        "clinics/target-clinic/patients/patient-123/documents/report.pdf"
      );

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents", "target-clinic");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: superAdminProfile };
      await POST(request, mockContext);

      // Verify patient_files insert was called with target clinic
      const insertCall = (mockSupabase.from as any).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        clinic_id: "target-clinic",
        patient_id: "patient-123",
        r2_key: "clinics/target-clinic/patients/patient-123/documents/report.pdf",
        content_type: "application/pdf",
        uploaded_by: "admin-999",
      });
    });
  });

  describe("Content Type Detection", () => {
    it("should track files with correct content types", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const testCases = [
        { file: createMockFile("report.pdf", "application/pdf"), expectedType: "application/pdf" },
        { file: createMockFile("xray.jpg", "image/jpeg"), expectedType: "image/jpeg" },
        { file: createMockFile("scan.png", "image/png"), expectedType: "image/png" },
        { file: createMockFile("results.txt", "text/plain"), expectedType: "text/plain" },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        const request = createMockUploadRequest(testCase.file, "documents");
        const { POST } = await import("@/app/api/upload/route");
        
        const mockContext = { profile: patientProfile };
        await POST(request, mockContext);

        const insertCall = (mockSupabase.from as any).mock.results[0].value.insert;
        expect(insertCall).toHaveBeenCalledWith(
          expect.objectContaining({
            content_type: testCase.expectedType,
          })
        );
      }
    });
  });

  describe("R2 Key Pattern Extraction", () => {
    it("should correctly extract patient_id from various R2 key patterns", () => {
      // Test the patient_id extraction logic directly
      const testCases = [
        {
          key: "clinics/clinic-123/patients/patient-456/documents/report.pdf",
          expectedPatientId: "patient-456",
          shouldMatch: true,
        },
        {
          key: "clinics/clinic-123/patients/patient-789/lab_results/blood_test.pdf",
          expectedPatientId: "patient-789",
          shouldMatch: true,
        },
        {
          key: "clinics/clinic-123/patients/550e8400-e29b-41d4-a716-446655440000/x_rays/chest.jpg",
          expectedPatientId: "550e8400-e29b-41d4-a716-446655440000",
          shouldMatch: true,
        },
        {
          key: "clinics/clinic-123/logos/logo.png",
          expectedPatientId: null,
          shouldMatch: false,
        },
        {
          key: "clinics/clinic-123/documents/general.pdf",
          expectedPatientId: null,
          shouldMatch: false,
        },
        {
          key: "clinics/clinic-123/patients/invalid-uuid/documents/report.pdf",
          expectedPatientId: null,
          shouldMatch: false,
        },
      ];

      for (const testCase of testCases) {
        // Extract patient_id using the same regex pattern used in the upload handler
        const patientIdMatch = testCase.key.match(/\/patients\/([0-9a-fA-F-]{36})\//);
        const extractedPatientId = patientIdMatch ? patientIdMatch[1] : null;

        if (testCase.shouldMatch) {
          expect(extractedPatientId).toBe(testCase.expectedPatientId);
        } else {
          expect(extractedPatientId).toBeNull();
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should not fail upload when tracking throws exception", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error("Database connection failed");
        }),
      } as unknown as SupabaseClient;

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: patientProfile };
      const response = await POST(request, mockContext);

      // Upload should still succeed
      expect(response.status).toBe(200);
      
      // Verify error was logged
      const { logger } = await import("@/lib/logger");
      expect(logger.warn).toHaveBeenCalledWith(
        "File ownership tracking failed",
        expect.objectContaining({
          context: "upload/track-ownership",
          clinicId: "clinic-456",
        })
      );
    });

    it("should handle null/undefined values gracefully", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      // Profile with null clinic_id
      const profileWithNullClinic = {
        id: "user-123",
        role: "doctor" as const,
        clinic_id: null,
      };

      const file = createMockFile("report.pdf", "application/pdf");
      const request = createMockUploadRequest(file, "documents");

      const { POST } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: profileWithNullClinic };
      const response = await POST(request, mockContext);

      // Should fail due to missing clinic context (handled by upload route validation)
      expect(response.status).toBe(403);
    });
  });

  describe("Integration with Upload Confirmation", () => {
    it("should track ownership for presigned uploads on confirmation", async () => {
      const mockSupabase = createMockSupabaseClient();
      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      // Mock upload confirmation dependencies
      vi.doMock("@/lib/r2", () => ({
        isR2Configured: vi.fn(() => true),
        getR2ObjectMetadata: vi.fn(() => Promise.resolve({
          contentLength: 1000,
          contentType: "application/pdf",
        })),
        readR2ObjectHead: vi.fn(() => Promise.resolve(Buffer.from("%PDF-1.4"))),
      }));

      const doctorProfile = {
        id: "doctor-789",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const confirmationBody = {
        key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
        contentType: "application/pdf",
      };

      const request = new NextRequest("http://localhost:3000/api/upload", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(confirmationBody),
      });

      const { PUT } = await import("@/app/api/upload/route");
      
      const mockContext = { profile: doctorProfile };
      await PUT(request, mockContext);

      // Verify patient_files insert was called for presigned upload
      const insertCall = (mockSupabase.from as any).mock.results[0].value.insert;
      expect(insertCall).toHaveBeenCalledWith({
        clinic_id: "clinic-456",
        patient_id: "patient-123",
        r2_key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
        content_type: "application/pdf",
        uploaded_by: "doctor-789",
      });
    });
  });
});