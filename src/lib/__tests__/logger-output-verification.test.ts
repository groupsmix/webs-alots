/**
 * Log Output Verification Test (A8-01)
 *
 * Tests that verify no PII patterns appear in actual log output.
 * Uses regex patterns to scan log output for email addresses, phone numbers,
 * and other PII that should be redacted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

// PII detection regex patterns
const PII_PATTERNS = {
  // Email pattern: matches most common email formats
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone pattern: matches various phone formats including international
  phone: /\+?[0-9]{6,}/g,
  
  // Credit card pattern: matches common credit card formats
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  
  // SSN pattern: matches XXX-XX-XXXX format
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Moroccan CIN pattern: matches letter followed by numbers
  cin: /\b[A-Z]{1,2}\d{6,8}\b/g,
  
  // IBAN pattern: matches international bank account numbers
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
  
  // Date of birth patterns: various date formats that could be DOB
  dateOfBirth: /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/g,
};

// Mock console.error to capture log output
const mockConsoleError = vi.fn();
let logOutputs: string[] = [];

describe("Log Output Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logOutputs = [];
    
    // Mock console.error to capture all log output
    vi.spyOn(console, "error").mockImplementation((output: string) => {
      mockConsoleError(output);
      logOutputs.push(output);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to get all log outputs as a single string
  function getAllLogOutput(): string {
    return logOutputs.join('\n');
  }

  // Helper to check for PII patterns in log output
  function checkForPiiPatterns(output: string): { found: boolean; matches: Record<string, string[]> } {
    const matches: Record<string, string[]> = {};
    let found = false;

    for (const [patternName, regex] of Object.entries(PII_PATTERNS)) {
      const patternMatches = Array.from(output.matchAll(regex)).map(match => match[0]);
      if (patternMatches.length > 0) {
        matches[patternName] = patternMatches;
        found = true;
      }
    }

    return { found, matches };
  }

  describe("Email Redaction Verification", () => {
    it("should not contain email addresses in log output", () => {
      // Log various email formats that should be redacted
      logger.info("User registration", {
        context: "auth",
        email: "user@example.com",
        patient_email: "patient@clinic.ma",
        backup_email: "backup@domain.org",
      });

      logger.error("Email validation failed", {
        context: "validation",
        email: "invalid.email@test-domain.co.uk",
        user: {
          email: "nested@example.com",
          name: "Ahmed Benali",
        },
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.email) {
        console.log("Found email addresses in logs:", matches.email);
      }

      expect(found).toBe(false);
      expect(matches.email).toBeUndefined();
      
      // Verify [REDACTED] appears instead
      expect(output).toContain('"email":"[REDACTED]"');
      expect(output).toContain('"patient_email":"[REDACTED]"');
    });

    it("should allow non-email strings that contain @ symbol", () => {
      logger.info("System message", {
        context: "system",
        message: "Process @startup completed",
        command: "run @background-task",
        mention: "@admin please review",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      // These should not be detected as emails
      expect(found).toBe(false);
      expect(matches.email).toBeUndefined();
    });
  });

  describe("Phone Number Redaction Verification", () => {
    it("should not contain phone numbers in log output", () => {
      // Log various phone formats that should be redacted
      logger.info("Patient contact", {
        context: "patient",
        phone: "+212612345678",
        patient_phone: "0612345678",
        emergency_contact: "+1-555-123-4567",
      });

      logger.warn("SMS delivery failed", {
        context: "notifications",
        phone: "212-555-0123",
        backup_phone: "(555) 123-4567",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.phone) {
        console.log("Found phone numbers in logs:", matches.phone);
      }

      expect(found).toBe(false);
      expect(matches.phone).toBeUndefined();
      
      // Verify [REDACTED] appears instead
      expect(output).toContain('"phone":"[REDACTED]"');
      expect(output).toContain('"patient_phone":"[REDACTED]"');
    });

    it("should allow non-phone numeric strings", () => {
      logger.info("System metrics", {
        context: "metrics",
        port: 3000,
        timeout: 5000,
        version: "1.2.3",
        build: 20240505,
      });

      const output = getAllLogOutput();
      
      // These numbers should not be detected as phone numbers
      // (they're too short or in non-phone contexts)
      expect(output).toContain('"port":3000');
      expect(output).toContain('"timeout":5000');
      expect(output).toContain('"build":20240505');
    });
  });

  describe("Financial Information Redaction Verification", () => {
    it("should not contain credit card numbers in log output", () => {
      logger.error("Payment processing error", {
        context: "payments",
        credit_card: "4111-1111-1111-1111",
        card_number: "5555 5555 5555 4444",
        payment_method: "378282246310005",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.creditCard) {
        console.log("Found credit card numbers in logs:", matches.creditCard);
      }

      expect(found).toBe(false);
      expect(matches.creditCard).toBeUndefined();
    });

    it("should not contain IBAN numbers in log output", () => {
      logger.info("Bank transfer", {
        context: "payments",
        iban: "MA64011519000001205000534921",
        bank_account: "FR1420041010050500013M02606",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.iban) {
        console.log("Found IBAN numbers in logs:", matches.iban);
      }

      expect(found).toBe(false);
      expect(matches.iban).toBeUndefined();
    });
  });

  describe("Identification Numbers Redaction Verification", () => {
    it("should not contain SSN in log output", () => {
      logger.info("Patient verification", {
        context: "verification",
        ssn: "123-45-6789",
        social_security: "987-65-4321",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.ssn) {
        console.log("Found SSN in logs:", matches.ssn);
      }

      expect(found).toBe(false);
      expect(matches.ssn).toBeUndefined();
    });

    it("should not contain Moroccan CIN in log output", () => {
      logger.info("Identity verification", {
        context: "identity",
        cin: "AB123456",
        national_id: "CD789012",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.cin) {
        console.log("Found CIN in logs:", matches.cin);
      }

      expect(found).toBe(false);
      expect(matches.cin).toBeUndefined();
    });
  });

  describe("Date of Birth Redaction Verification", () => {
    it("should not contain date of birth patterns in log output", () => {
      logger.info("Patient registration", {
        context: "registration",
        date_of_birth: "1990-01-15",
        dob: "15/01/1990",
        birth_date: "01-15-1990",
      });

      const output = getAllLogOutput();
      const { found, matches } = checkForPiiPatterns(output);

      if (found && matches.dateOfBirth) {
        console.log("Found date of birth in logs:", matches.dateOfBirth);
      }

      expect(found).toBe(false);
      expect(matches.dateOfBirth).toBeUndefined();
    });

    it("should allow non-DOB date strings", () => {
      logger.info("Appointment scheduled", {
        context: "appointments",
        appointment_date: "2026-05-15",
        created_at: "2026-05-05T10:00:00Z",
        timestamp: new Date().toISOString(),
      });

      const output = getAllLogOutput();
      
      // These should be allowed as they're not PII fields
      expect(output).toContain('"appointment_date":"2026-05-15"');
      expect(output).toContain('"created_at":"2026-05-05T10:00:00Z"');
    });
  });

  describe("UUID Presence Verification", () => {
    it("should contain UUIDs instead of PII", () => {
      logger.info("User action", {
        context: "user-action",
        clinicId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        patientId: "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        appointmentId: "550e8401-e29b-41d4-a716-446655440000",
        // PII that should be redacted
        email: "user@example.com",
        name: "Ahmed Benali",
      });

      const output = getAllLogOutput();
      
      // Verify UUIDs are present
      expect(output).toContain('"clinicId":"550e8400-e29b-41d4-a716-446655440000"');
      expect(output).toContain('"userId":"6ba7b810-9dad-11d1-80b4-00c04fd430c8"');
      expect(output).toContain('"patientId":"6ba7b811-9dad-11d1-80b4-00c04fd430c8"');
      expect(output).toContain('"appointmentId":"550e8401-e29b-41d4-a716-446655440000"');
      
      // Verify PII is redacted
      expect(output).toContain('"email":"[REDACTED]"');
      expect(output).toContain('"name":"[REDACTED]"');
      
      // Verify no actual PII leaked
      const { found } = checkForPiiPatterns(output);
      expect(found).toBe(false);
    });
  });

  describe("Complex Nested Data Verification", () => {
    it("should redact PII in complex nested structures", () => {
      logger.error("Complex operation failed", {
        context: "complex-operation",
        request: {
          user: {
            email: "user@example.com",
            profile: {
              name: "Ahmed Benali",
              phone: "+212612345678",
              contacts: [
                {
                  type: "emergency",
                  name: "Fatima Benali",
                  phone: "+212687654321",
                },
                {
                  type: "work",
                  email: "work@company.com",
                },
              ],
            },
          },
          clinic: {
            clinic_name: "Al-Shifa Medical Center",
            owner_name: "Dr. Hassan Alami",
            staff: [
              {
                doctor_name: "Dr. Sarah Smith",
                email: "sarah@clinic.com",
              },
            ],
          },
        },
        metadata: {
          timestamp: "2026-05-05T10:00:00Z",
          requestId: "req-123456",
        },
      });

      const output = getAllLogOutput();
      
      // Verify no PII patterns are found
      const { found, matches } = checkForPiiPatterns(output);
      
      if (found) {
        console.log("Found PII in complex nested data:", matches);
      }
      
      expect(found).toBe(false);
      
      // Verify [REDACTED] appears for PII fields
      expect(output).toContain('"email":"[REDACTED]"');
      expect(output).toContain('"name":"[REDACTED]"');
      expect(output).toContain('"phone":"[REDACTED]"');
      expect(output).toContain('"clinic_name":"[REDACTED]"');
      expect(output).toContain('"owner_name":"[REDACTED]"');
      expect(output).toContain('"doctor_name":"[REDACTED]"');
      
      // Verify non-PII fields are preserved
      expect(output).toContain('"timestamp":"2026-05-05T10:00:00Z"');
      expect(output).toContain('"requestId":"req-123456"');
      expect(output).toContain('"type":"emergency"');
      expect(output).toContain('"type":"work"');
    });
  });

  describe("Error Object Verification", () => {
    it("should not leak PII through error messages", () => {
      const error = new Error("User ahmed@example.com not found with phone +212612345678");
      
      logger.error("Database query failed", {
        context: "database",
        error,
        query: "SELECT * FROM users WHERE email = 'user@domain.com'",
      });

      const output = getAllLogOutput();
      
      // Check if PII leaked through error message or query
      const { found, matches } = checkForPiiPatterns(output);
      
      if (found) {
        console.log("Found PII in error object:", matches);
      }
      
      // This test might fail if error messages contain PII
      // In a real implementation, you might need to sanitize error messages too
      expect(found).toBe(false);
    });
  });

  describe("Performance with Large Data", () => {
    it("should efficiently redact PII in large log entries", () => {
      // Create a large object with mixed PII and non-PII data
      const largeData: Record<string, unknown> = {
        context: "bulk-operation",
        users: [],
      };

      // Add 100 user objects with PII
      for (let i = 0; i < 100; i++) {
        (largeData.users as any[]).push({
          id: `user-${i}`,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          phone: `+21261234${String(i).padStart(4, '0')}`,
          age: 20 + (i % 50),
          role: i % 2 === 0 ? "patient" : "doctor",
        });
      }

      const startTime = performance.now();
      
      logger.info("Bulk user operation", largeData);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(200);
      
      const output = getAllLogOutput();
      
      // Verify no PII leaked in the large dataset
      const { found, matches } = checkForPiiPatterns(output);
      
      if (found) {
        console.log("Found PII in large dataset:", matches);
      }
      
      expect(found).toBe(false);
      
      // Verify redaction occurred
      expect(output).toContain('"email":"[REDACTED]"');
      expect(output).toContain('"name":"[REDACTED]"');
      expect(output).toContain('"phone":"[REDACTED]"');
      
      // Verify non-PII preserved
      expect(output).toContain('"id":"user-0"');
      expect(output).toContain('"role":"patient"');
      expect(output).toContain('"role":"doctor"');
    });
  });
});