/**
 * Tests for Sentry PHI filter (A41)
 * 
 * Validates: Requirements 9.3, 2.47
 */

import { describe, it, expect } from "vitest";
import { stripPhi, stripPhiFromBreadcrumb } from "../sentry-phi-filter";
import type { Event } from "@sentry/types";

describe("Sentry PHI Filter (A41)", () => {
  describe("stripPhi", () => {
    it("should redact PHI from request data", () => {
      const event: Event = {
        request: {
          data: {
            email: "patient@example.com",
            phone: "+212612345678",
            name: "John Doe",
            clinicId: "clinic-123",
          },
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.data).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        name: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should scrub PHI from URL query parameters", () => {
      const event: Event = {
        request: {
          url: "https://example.com/api/patient?email=patient@example.com&phone=+212612345678&clinicId=clinic-123",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.url).toContain("email=[REDACTED_PHI]");
      expect(filtered?.request?.url).toContain("phone=[REDACTED_PHI]");
      expect(filtered?.request?.url).toContain("clinicId=clinic-123");
    });

    it("should scrub PHI from query_string", () => {
      const event: Event = {
        request: {
          query_string: "email=patient@example.com&phone=+212612345678&name=John+Doe",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.query_string).toContain("email=[REDACTED_PHI]");
      expect(filtered?.request?.query_string).toContain("phone=[REDACTED_PHI]");
      expect(filtered?.request?.query_string).toContain("name=[REDACTED_PHI]");
    });

    it("should remove cookies entirely", () => {
      const event: Event = {
        request: {
          cookies: {
            session: "abc123",
            auth: "xyz789",
          },
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.cookies).toBeUndefined();
    });

    it("should redact user email, IP, and username", () => {
      const event: Event = {
        user: {
          id: "user-123",
          email: "patient@example.com",
          ip_address: "192.168.1.1",
          username: "johndoe",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.user).toEqual({
        id: "user-123", // UUID preserved
      });
    });

    it("should redact PHI from contexts", () => {
      const event: Event = {
        contexts: {
          patient: {
            email: "patient@example.com",
            phone: "+212612345678",
            clinicId: "clinic-123",
          },
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.contexts?.patient).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should redact PHI from extra data", () => {
      const event: Event = {
        extra: {
          patient_name: "John Doe",
          patient_email: "patient@example.com",
          diagnosis: "Diabetes",
          clinicId: "clinic-123",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.extra).toEqual({
        patient_name: "[REDACTED_PHI]",
        patient_email: "[REDACTED_PHI]",
        diagnosis: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should redact PHI from tags", () => {
      const event: Event = {
        tags: {
          email: "patient@example.com",
          phone: "+212612345678",
          clinicId: "clinic-123",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.tags).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should redact PHI from breadcrumbs", () => {
      const event: Event = {
        breadcrumbs: [
          {
            message: "User action",
            data: {
              email: "patient@example.com",
              phone: "+212612345678",
              clinicId: "clinic-123",
            },
          },
        ],
      };

      const filtered = stripPhi(event);

      expect(filtered?.breadcrumbs?.[0]?.data).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should scrub PHI from breadcrumb messages with URLs", () => {
      const event: Event = {
        breadcrumbs: [
          {
            message: "Navigated to https://example.com/patient?email=patient@example.com&phone=+212612345678",
          },
        ],
      };

      const filtered = stripPhi(event);

      expect(filtered?.breadcrumbs?.[0]?.message).toContain("email=[REDACTED_PHI]");
      expect(filtered?.breadcrumbs?.[0]?.message).toContain("phone=[REDACTED_PHI]");
    });

    it("should redact PHI from stack frame variables", () => {
      const event: Event = {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  {
                    vars: {
                      email: "patient@example.com",
                      phone: "+212612345678",
                      clinicId: "clinic-123",
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should handle nested PHI in request data", () => {
      const event: Event = {
        request: {
          data: {
            patient: {
              email: "patient@example.com",
              phone: "+212612345678",
              address: "123 Main St",
            },
            clinicId: "clinic-123",
          },
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.data).toEqual({
        patient: {
          email: "[REDACTED_PHI]",
          phone: "[REDACTED_PHI]",
          address: "[REDACTED_PHI]",
        },
        clinicId: "clinic-123",
      });
    });

    it("should handle arrays of objects with PHI", () => {
      const event: Event = {
        extra: {
          patients: [
            { email: "patient1@example.com", name: "John Doe" },
            { email: "patient2@example.com", name: "Jane Smith" },
          ],
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.extra?.patients).toEqual([
        { email: "[REDACTED_PHI]", name: "[REDACTED_PHI]" },
        { email: "[REDACTED_PHI]", name: "[REDACTED_PHI]" },
      ]);
    });

    it("should redact hostname from request data (A41)", () => {
      const event: Event = {
        request: {
          data: {
            hostname: "clinic.example.com",
            clinicId: "clinic-123",
          },
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.request?.data).toEqual({
        hostname: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should redact r2Key from request data (A41)", () => {
      const event: Event = {
        extra: {
          r2Key: "patient-files/clinic-123/patient-456/document.pdf",
          r2_key: "backups/clinic-123/backup.tar.gz",
          clinicId: "clinic-123",
        },
      };

      const filtered = stripPhi(event);

      expect(filtered?.extra).toEqual({
        r2Key: "[REDACTED_PHI]",
        r2_key: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });
  });

  describe("stripPhiFromBreadcrumb", () => {
    it("should redact PHI from breadcrumb data", () => {
      const breadcrumb = {
        data: {
          email: "patient@example.com",
          phone: "+212612345678",
          clinicId: "clinic-123",
        },
      };

      const filtered = stripPhiFromBreadcrumb(breadcrumb);

      expect(filtered.data).toEqual({
        email: "[REDACTED_PHI]",
        phone: "[REDACTED_PHI]",
        clinicId: "clinic-123",
      });
    });

    it("should scrub PHI from breadcrumb message URLs", () => {
      const breadcrumb = {
        message: "Fetch to https://example.com/api?email=patient@example.com&phone=+212612345678",
      };

      const filtered = stripPhiFromBreadcrumb(breadcrumb);

      expect(filtered.message).toContain("email=[REDACTED_PHI]");
      expect(filtered.message).toContain("phone=[REDACTED_PHI]");
    });

    it("should scrub PHI from breadcrumb data URLs", () => {
      const breadcrumb = {
        data: {
          url: "https://example.com/patient?email=patient@example.com&phone=+212612345678",
        },
      };

      const filtered = stripPhiFromBreadcrumb(breadcrumb);

      expect(filtered.data.url).toContain("email=[REDACTED_PHI]");
      expect(filtered.data.url).toContain("phone=[REDACTED_PHI]");
    });
  });
});
