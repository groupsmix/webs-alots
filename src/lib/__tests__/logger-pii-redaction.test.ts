/**
 * Unit tests for PII Redaction in Logger (A8-01)
 *
 * Tests the automatic redaction of personally identifiable information
 * from log metadata to prevent PHI leakage in log systems.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

// Mock console.error to capture log output
const mockConsoleError = vi.fn();

describe("Logger PII Redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to capture structured log output
    vi.spyOn(console, "error").mockImplementation(mockConsoleError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get the last logged payload
  function getLastLogPayload(): Record<string, unknown> {
    const lastCall = mockConsoleError.mock.calls[mockConsoleError.mock.calls.length - 1];
    return JSON.parse(lastCall[0]);
  }

  describe("Basic PII Field Redaction", () => {
    it("should redact email fields", () => {
      logger.info("Test message", {
        context: "test",
        email: "patient@example.com",
        patient_email: "patient@clinic.com",
        userEmail: "user@test.com", // Should not be redacted (not in PHI_FIELD_PATTERNS)
      });

      const payload = getLastLogPayload();
      expect(payload.email).toBe("[REDACTED]");
      expect(payload.patient_email).toBe("[REDACTED]");
      expect(payload.userEmail).toBe("user@test.com"); // Not redacted
    });

    it("should redact phone fields", () => {
      logger.info("Test message", {
        context: "test",
        phone: "+212612345678",
        patient_phone: "0612345678",
        phoneNumber: "123456789", // Should not be redacted
      });

      const payload = getLastLogPayload();
      expect(payload.phone).toBe("[REDACTED]");
      expect(payload.patient_phone).toBe("[REDACTED]");
      expect(payload.phoneNumber).toBe("123456789"); // Not redacted
    });

    it("should redact name fields", () => {
      logger.info("Test message", {
        context: "test",
        name: "Ahmed Benali",
        patient_name: "Fatima Zahra",
        full_name: "Dr. Mohammed Hassan",
        doctor_name: "Dr. Sarah Smith",
        clinic_name: "Clinic Al-Shifa",
        owner_name: "Hassan Alami",
      });

      const payload = getLastLogPayload();
      expect(payload.name).toBe("[REDACTED]");
      expect(payload.patient_name).toBe("[REDACTED]");
      expect(payload.full_name).toBe("[REDACTED]");
      expect(payload.doctor_name).toBe("[REDACTED]");
      expect(payload.clinic_name).toBe("[REDACTED]");
      expect(payload.owner_name).toBe("[REDACTED]");
    });

    it("should redact medical information fields", () => {
      logger.info("Test message", {
        context: "test",
        diagnosis: "Hypertension",
        prescription: "Lisinopril 10mg",
        medical_record: "Patient has history of...",
        medical_history: "Previous surgeries...",
        allergies: "Penicillin allergy",
        medications: "Aspirin, Metformin",
        symptoms: "Chest pain, shortness of breath",
      });

      const payload = getLastLogPayload();
      expect(payload.diagnosis).toBe("[REDACTED]");
      expect(payload.prescription).toBe("[REDACTED]");
      expect(payload.medical_record).toBe("[REDACTED]");
      expect(payload.medical_history).toBe("[REDACTED]");
      expect(payload.allergies).toBe("[REDACTED]");
      expect(payload.medications).toBe("[REDACTED]");
      expect(payload.symptoms).toBe("[REDACTED]");
    });

    it("should redact identification fields", () => {
      logger.info("Test message", {
        context: "test",
        cin: "AB123456",
        ssn: "123-45-6789",
        national_id: "ID123456789",
        passport: "P123456789",
        license_number: "DL123456",
        insurance_number: "INS123456",
        insurance_id: "INS789012",
      });

      const payload = getLastLogPayload();
      expect(payload.cin).toBe("[REDACTED]");
      expect(payload.ssn).toBe("[REDACTED]");
      expect(payload.national_id).toBe("[REDACTED]");
      expect(payload.passport).toBe("[REDACTED]");
      expect(payload.license_number).toBe("[REDACTED]");
      expect(payload.insurance_number).toBe("[REDACTED]");
      expect(payload.insurance_id).toBe("[REDACTED]");
    });

    it("should redact financial information fields", () => {
      logger.info("Test message", {
        context: "test",
        credit_card: "4111-1111-1111-1111",
        bank_account: "123456789",
        iban: "MA64011519000001205000534921",
        swift: "BMCEMAMC",
      });

      const payload = getLastLogPayload();
      expect(payload.credit_card).toBe("[REDACTED]");
      expect(payload.bank_account).toBe("[REDACTED]");
      expect(payload.iban).toBe("[REDACTED]");
      expect(payload.swift).toBe("[REDACTED]");
    });

    it("should redact contact and address fields", () => {
      logger.info("Test message", {
        context: "test",
        address: "123 Main St, Casablanca",
        patient_address: "456 Oak Ave, Rabat",
        emergency_contact: "Hassan Benali - 0612345678",
        next_of_kin: "Fatima Alami - Sister",
        date_of_birth: "1990-01-15",
        dob: "15/01/1990",
      });

      const payload = getLastLogPayload();
      expect(payload.address).toBe("[REDACTED]");
      expect(payload.patient_address).toBe("[REDACTED]");
      expect(payload.emergency_contact).toBe("[REDACTED]");
      expect(payload.next_of_kin).toBe("[REDACTED]");
      expect(payload.date_of_birth).toBe("[REDACTED]");
      expect(payload.dob).toBe("[REDACTED]");
    });
  });

  describe("Case Insensitive Redaction", () => {
    it("should redact fields regardless of case", () => {
      logger.info("Test message", {
        context: "test",
        EMAIL: "test@example.com",
        Phone: "+212612345678",
        NAME: "Ahmed Benali",
        PATIENT_EMAIL: "patient@clinic.com",
        Doctor_Name: "Dr. Smith",
        clinic_NAME: "Test Clinic",
      });

      const payload = getLastLogPayload();
      expect(payload.EMAIL).toBe("[REDACTED]");
      expect(payload.Phone).toBe("[REDACTED]");
      expect(payload.NAME).toBe("[REDACTED]");
      expect(payload.PATIENT_EMAIL).toBe("[REDACTED]");
      expect(payload.Doctor_Name).toBe("[REDACTED]");
      expect(payload.clinic_NAME).toBe("[REDACTED]");
    });
  });

  describe("Nested Object Redaction", () => {
    it("should redact PII in nested objects", () => {
      logger.info("Test message", {
        context: "test",
        user: {
          email: "user@example.com",
          name: "Ahmed Benali",
          id: "user-123", // Should not be redacted
        },
        patient: {
          patient_name: "Fatima Zahra",
          phone: "+212612345678",
          age: 30, // Should not be redacted
        },
        metadata: {
          clinic_name: "Test Clinic",
          doctor_name: "Dr. Smith",
          appointment_id: "appt-456", // Should not be redacted
        },
      });

      const payload = getLastLogPayload();
      
      // Check nested user object
      expect(payload.user).toEqual({
        email: "[REDACTED]",
        name: "[REDACTED]",
        id: "user-123",
      });

      // Check nested patient object
      expect(payload.patient).toEqual({
        patient_name: "[REDACTED]",
        phone: "[REDACTED]",
        age: 30,
      });

      // Check nested metadata object
      expect(payload.metadata).toEqual({
        clinic_name: "[REDACTED]",
        doctor_name: "[REDACTED]",
        appointment_id: "appt-456",
      });
    });

    it("should redact PII in deeply nested objects", () => {
      logger.info("Test message", {
        context: "test",
        data: {
          clinic: {
            info: {
              clinic_name: "Deep Clinic",
              owner_name: "Hassan Alami",
              location: "Casablanca", // Should not be redacted
            },
          },
          patients: {
            primary: {
              name: "Ahmed Benali",
              email: "ahmed@example.com",
            },
          },
        },
      });

      const payload = getLastLogPayload();
      
      expect(payload.data).toEqual({
        clinic: {
          info: {
            clinic_name: "[REDACTED]",
            owner_name: "[REDACTED]",
            location: "Casablanca",
          },
        },
        patients: {
          primary: {
            name: "[REDACTED]",
            email: "[REDACTED]",
          },
        },
      });
    });
  });

  describe("Array Redaction", () => {
    it("should redact PII in arrays of objects", () => {
      logger.info("Test message", {
        context: "test",
        patients: [
          {
            name: "Ahmed Benali",
            email: "ahmed@example.com",
            id: "patient-1",
          },
          {
            name: "Fatima Zahra",
            phone: "+212612345678",
            id: "patient-2",
          },
        ],
        doctors: [
          {
            doctor_name: "Dr. Smith",
            specialty: "Cardiology", // Should not be redacted
          },
          {
            doctor_name: "Dr. Johnson",
            department: "Emergency", // Should not be redacted
          },
        ],
      });

      const payload = getLastLogPayload();
      
      expect(payload.patients).toEqual([
        {
          name: "[REDACTED]",
          email: "[REDACTED]",
          id: "patient-1",
        },
        {
          name: "[REDACTED]",
          phone: "[REDACTED]",
          id: "patient-2",
        },
      ]);

      expect(payload.doctors).toEqual([
        {
          doctor_name: "[REDACTED]",
          specialty: "Cardiology",
        },
        {
          doctor_name: "[REDACTED]",
          department: "Emergency",
        },
      ]);
    });

    it("should handle arrays with mixed types", () => {
      logger.info("Test message", {
        context: "test",
        mixed_array: [
          "string value",
          123,
          {
            name: "Ahmed Benali",
            age: 30,
          },
          null,
          true,
        ],
      });

      const payload = getLastLogPayload();
      
      expect(payload.mixed_array).toEqual([
        "string value",
        123,
        {
          name: "[REDACTED]",
          age: 30,
        },
        null,
        true,
      ]);
    });
  });

  describe("Non-PII Fields Preservation", () => {
    it("should preserve non-PII fields", () => {
      logger.info("Test message", {
        context: "test",
        clinicId: "clinic-123",
        userId: "user-456",
        appointmentId: "appt-789",
        timestamp: "2026-05-05T10:00:00Z",
        status: "completed",
        count: 42,
        enabled: true,
        config: {
          timeout: 5000,
          retries: 3,
        },
      });

      const payload = getLastLogPayload();
      
      expect(payload.clinicId).toBe("clinic-123");
      expect(payload.userId).toBe("user-456");
      expect(payload.appointmentId).toBe("appt-789");
      expect(payload.timestamp).toBe("2026-05-05T10:00:00Z");
      expect(payload.status).toBe("completed");
      expect(payload.count).toBe(42);
      expect(payload.enabled).toBe(true);
      expect(payload.config).toEqual({
        timeout: 5000,
        retries: 3,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined values", () => {
      logger.info("Test message", {
        context: "test",
        email: null,
        name: undefined,
        phone: "",
        patient_name: "Ahmed Benali",
      });

      const payload = getLastLogPayload();
      
      expect(payload.email).toBe("[REDACTED]");
      expect(payload.name).toBe("[REDACTED]");
      expect(payload.phone).toBe("[REDACTED]");
      expect(payload.patient_name).toBe("[REDACTED]");
    });

    it("should handle empty objects and arrays", () => {
      logger.info("Test message", {
        context: "test",
        empty_object: {},
        empty_array: [],
        nested_empty: {
          empty: {},
          array: [],
        },
      });

      const payload = getLastLogPayload();
      
      expect(payload.empty_object).toEqual({});
      expect(payload.empty_array).toEqual([]);
      expect(payload.nested_empty).toEqual({
        empty: {},
        array: [],
      });
    });

    it("should handle circular references gracefully", () => {
      const obj: any = {
        name: "Ahmed Benali",
        id: "user-123",
      };
      obj.self = obj; // Create circular reference

      // This should not throw an error
      expect(() => {
        logger.info("Test message", {
          context: "test",
          circular: obj,
        });
      }).not.toThrow();
    });
  });

  describe("Log Level Integration", () => {
    it("should redact PII across all log levels", () => {
      const testData = {
        context: "test",
        email: "test@example.com",
        name: "Ahmed Benali",
        safe_field: "safe_value",
      };

      logger.debug("Debug message", testData);
      logger.info("Info message", testData);
      logger.warn("Warn message", testData);
      logger.error("Error message", testData);

      // Check that all log levels redact PII
      const calls = mockConsoleError.mock.calls;
      
      for (const call of calls) {
        const payload = JSON.parse(call[0]);
        expect(payload.email).toBe("[REDACTED]");
        expect(payload.name).toBe("[REDACTED]");
        expect(payload.safe_field).toBe("safe_value");
      }
    });
  });

  describe("Performance", () => {
    it("should handle large objects efficiently", () => {
      const largeObject: Record<string, unknown> = {};
      
      // Create a large object with mixed PII and non-PII fields
      for (let i = 0; i < 1000; i++) {
        largeObject[`field_${i}`] = `value_${i}`;
        if (i % 10 === 0) {
          largeObject[`email_${i}`] = `user${i}@example.com`;
        }
        if (i % 15 === 0) {
          largeObject[`name_${i}`] = `User ${i}`;
        }
      }

      const startTime = performance.now();
      
      logger.info("Large object test", {
        context: "test",
        data: largeObject,
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
      
      const payload = getLastLogPayload();
      const data = payload.data as Record<string, unknown>;
      
      // Verify PII fields were redacted
      expect(data.email_0).toBe("[REDACTED]");
      expect(data.name_0).toBe("[REDACTED]");
      
      // Verify non-PII fields were preserved
      expect(data.field_1).toBe("value_1");
      expect(data.field_999).toBe("value_999");
    });
  });
});