/**
 * Integration tests for File Download Authorization (A7-01)
 *
 * Tests the complete file authorization flow including:
 * - Patient access to own files
 * - Patient blocked from other patient files
 * - Staff access to all clinic files
 * - Cross-tenant isolation
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
  downloadFromR2: vi.fn(() => Promise.resolve({
    body: new ReadableStream(),
    contentType: "application/pdf",
    contentLength: 1000,
  })),
}));

vi.mock("@/lib/audit-log", () => ({
  logAuditEvent: vi.fn(),
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

// Helper to create mock request for file download
function createMockDownloadRequest(r2Key: string): NextRequest {
  const url = new URL("http://localhost:3000/api/files/download");
  url.searchParams.set("key", r2Key);
  
  return new NextRequest(url, {
    method: "GET",
  });
}

// Helper to create mock Supabase client with patient_files query results
function createMockSupabaseClient(queryResult: { data?: any[]; error?: any } = {}): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(queryResult),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("File Download Authorization Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Patient File Access", () => {
    it("should allow patient to download own file", async () => {
      // Mock patient_files query to return matching record
      const mockSupabase = createMockSupabaseClient({
        data: [{
          id: "file-123",
          clinic_id: "clinic-456",
          patient_id: "patient-123",
          r2_key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
          content_type: "application/pdf",
        }],
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: patientProfile };
      const response = await GET(request, mockContext);

      // Should succeed
      expect(response.status).toBe(200);

      // Verify patient_files query was made
      expect(mockSupabase.from).toHaveBeenCalledWith("patient_files");
      
      // Verify audit log was called
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "patient-123",
        metadata: expect.objectContaining({
          r2_key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
          authorized: true,
        }),
      });
    });

    it("should block patient from downloading other patient's file", async () => {
      // Mock patient_files query to return no matching record (different patient_id)
      const mockSupabase = createMockSupabaseClient({
        data: [], // No matching records
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-789/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: patientProfile };
      const response = await GET(request, mockContext);

      // Should be forbidden
      expect(response.status).toBe(403);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        ok: false,
        error: "Access denied",
        code: "FORBIDDEN",
      });

      // Verify patient_files query was made with patient's ID
      const selectChain = (mockSupabase.from as any).mock.results[0].value.select.mock.results[0].value;
      expect(selectChain.eq).toHaveBeenCalledWith("clinic_id", "clinic-456");
      expect(selectChain.eq.mock.results[0].value.eq).toHaveBeenCalledWith("patient_id", "patient-123");

      // Verify audit log recorded the denial
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download_denied",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "patient-123",
        metadata: expect.objectContaining({
          r2_key: "clinics/clinic-456/patients/patient-789/documents/report.pdf",
          reason: "patient_not_authorized",
        }),
      });
    });

    it("should block patient from accessing files in different clinic", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [], // No matching records (different clinic)
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-789/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: patientProfile };
      const response = await GET(request, mockContext);

      // Should be forbidden
      expect(response.status).toBe(403);

      // Verify query was scoped to patient's clinic
      const selectChain = (mockSupabase.from as any).mock.results[0].value.select.mock.results[0].value;
      expect(selectChain.eq).toHaveBeenCalledWith("clinic_id", "clinic-456");
    });
  });

  describe("Doctor File Access", () => {
    it("should allow doctor to download any file in their clinic", async () => {
      // Mock patient_files query to return matching record
      const mockSupabase = createMockSupabaseClient({
        data: [{
          id: "file-456",
          clinic_id: "clinic-456",
          patient_id: "patient-789",
          r2_key: "clinics/clinic-456/patients/patient-789/documents/report.pdf",
          content_type: "application/pdf",
        }],
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-789/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should succeed
      expect(response.status).toBe(200);

      // Verify audit log shows doctor access
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "doctor-123",
        metadata: expect.objectContaining({
          r2_key: "clinics/clinic-456/patients/patient-789/documents/report.pdf",
          authorized: true,
          staff_access: true,
        }),
      });
    });

    it("should block doctor from accessing files in different clinic", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [], // No matching records (different clinic)
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-789/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should be forbidden
      expect(response.status).toBe(403);

      // Verify query was scoped to doctor's clinic
      const selectChain = (mockSupabase.from as any).mock.results[0].value.select.mock.results[0].value;
      expect(selectChain.eq).toHaveBeenCalledWith("clinic_id", "clinic-456");
    });
  });

  describe("Receptionist File Access", () => {
    it("should allow receptionist to download any file in their clinic", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [{
          id: "file-789",
          clinic_id: "clinic-456",
          patient_id: "patient-123",
          r2_key: "clinics/clinic-456/patients/patient-123/lab_results/blood_test.pdf",
          content_type: "application/pdf",
        }],
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const receptionistProfile = {
        id: "receptionist-456",
        role: "receptionist" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-123/lab_results/blood_test.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: receptionistProfile };
      const response = await GET(request, mockContext);

      // Should succeed
      expect(response.status).toBe(200);

      // Verify audit log shows receptionist access
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "receptionist-456",
        metadata: expect.objectContaining({
          authorized: true,
          staff_access: true,
        }),
      });
    });
  });

  describe("Super Admin File Access", () => {
    it("should allow super admin to download any file from any clinic", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [{
          id: "file-999",
          clinic_id: "clinic-789",
          patient_id: "patient-456",
          r2_key: "clinics/clinic-789/patients/patient-456/documents/report.pdf",
          content_type: "application/pdf",
        }],
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const superAdminProfile = {
        id: "admin-999",
        role: "super_admin" as const,
        clinic_id: null, // Super admin has no clinic
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-789/patients/patient-456/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: superAdminProfile };
      const response = await GET(request, mockContext);

      // Should succeed
      expect(response.status).toBe(200);

      // Verify audit log shows super admin access
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-789", // Target clinic from R2 key
        user_id: "admin-999",
        metadata: expect.objectContaining({
          authorized: true,
          super_admin_access: true,
        }),
      });
    });
  });

  describe("File Not Found Scenarios", () => {
    it("should return 404 when file not tracked in patient_files table", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [], // No matching records
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/documents/untracked_file.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should be not found
      expect(response.status).toBe(404);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        ok: false,
        error: "File not found",
        code: "NOT_FOUND",
      });
    });

    it("should handle database errors gracefully", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: null,
        error: { message: "Database connection failed" },
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should be internal server error
      expect(response.status).toBe(500);

      // Verify error was logged
      const { logger } = await import("@/lib/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "File authorization check failed",
        expect.objectContaining({
          context: "file-download/authorization",
          clinicId: "clinic-456",
          userId: "doctor-123",
        })
      );
    });
  });

  describe("Legacy File Support", () => {
    it("should handle files uploaded before ownership tracking", async () => {
      // Mock R2 download success but no patient_files record
      const mockSupabase = createMockSupabaseClient({
        data: [], // No tracking record
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      // Mock R2 file exists
      const { downloadFromR2 } = vi.mocked(await import("@/lib/r2"));
      downloadFromR2.mockResolvedValue({
        body: new ReadableStream(),
        contentType: "application/pdf",
        contentLength: 1000,
      });

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/legacy/old_file.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should fall back to legacy authorization (staff can access)
      expect(response.status).toBe(200);

      // Verify audit log shows legacy access
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "doctor-123",
        metadata: expect.objectContaining({
          authorized: true,
          legacy_file: true,
        }),
      });
    });

    it("should block patients from legacy files without ownership records", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [], // No tracking record
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/legacy/old_file.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: patientProfile };
      const response = await GET(request, mockContext);

      // Should be forbidden (patients need explicit ownership)
      expect(response.status).toBe(403);
    });
  });

  describe("Malicious Access Attempts", () => {
    it("should block path traversal attempts", async () => {
      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      const maliciousKeys = [
        "../../../etc/passwd",
        "clinics/../../../secrets.txt",
        "clinics/clinic-456/../clinic-789/file.pdf",
        "clinics/clinic-456/patients/../../../admin/config.json",
      ];

      for (const maliciousKey of maliciousKeys) {
        const request = createMockDownloadRequest(maliciousKey);
        const { GET } = await import("@/app/api/files/download/route");
        
        const mockContext = { profile: doctorProfile };
        const response = await GET(request, mockContext);

        // Should be forbidden or bad request
        expect([400, 403, 404]).toContain(response.status);
      }
    });

    it("should block attempts to access other clinic files via key manipulation", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [], // No matching records (different clinic)
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const doctorProfile = {
        id: "doctor-123",
        role: "doctor" as const,
        clinic_id: "clinic-456",
      };

      // Attempt to access file from different clinic
      const request = createMockDownloadRequest(
        "clinics/clinic-789/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      const mockContext = { profile: doctorProfile };
      const response = await GET(request, mockContext);

      // Should be forbidden
      expect(response.status).toBe(403);

      // Verify audit log recorded the cross-tenant attempt
      const { logAuditEvent } = await import("@/lib/audit-log");
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: "file_download_denied",
        resource_type: "patient_file",
        resource_id: expect.any(String),
        clinic_id: "clinic-456",
        user_id: "doctor-123",
        metadata: expect.objectContaining({
          reason: "cross_tenant_access_attempt",
          requested_clinic: "clinic-789",
        }),
      });
    });
  });

  describe("Performance and Rate Limiting", () => {
    it("should handle concurrent download requests efficiently", async () => {
      const mockSupabase = createMockSupabaseClient({
        data: [{
          id: "file-123",
          clinic_id: "clinic-456",
          patient_id: "patient-123",
          r2_key: "clinics/clinic-456/patients/patient-123/documents/report.pdf",
          content_type: "application/pdf",
        }],
        error: null,
      });

      const { createClient } = vi.mocked(await import("@/lib/supabase-server"));
      createClient.mockResolvedValue(mockSupabase);

      const patientProfile = {
        id: "patient-123",
        role: "patient" as const,
        clinic_id: "clinic-456",
      };

      const request = createMockDownloadRequest(
        "clinics/clinic-456/patients/patient-123/documents/report.pdf"
      );

      const { GET } = await import("@/app/api/files/download/route");
      
      // Simulate concurrent requests
      const concurrentRequests = Array(5).fill(null).map(() => 
        GET(request, { profile: patientProfile })
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Database should be queried for each request (no caching expected)
      expect(mockSupabase.from).toHaveBeenCalledTimes(5);
    });
  });
});