/**
 * Tests for logger PHI redaction and R2 key hashing (A41)
 * 
 * Validates: Requirements 9.1-9.4, 2.45-2.48
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

describe("Logger PHI Redaction (A41)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggedPayloads: any[];

  beforeEach(() => {
    loggedPayloads = [];
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((message) => {
      try {
        loggedPayloads.push(JSON.parse(message));
      } catch {
        // Not JSON, ignore
      }
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should redact email from log metadata", () => {
    logger.info("Test message", {
      context: "test",
      email: "patient@example.com",
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.email).toBe("[REDACTED]");
    expect(payload.clinicId).toBe("clinic-123");
  });

  it("should redact phone from log metadata", () => {
    logger.info("Test message", {
      context: "test",
      phone: "+212612345678",
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.phone).toBe("[REDACTED]");
  });

  it("should redact name from log metadata", () => {
    logger.info("Test message", {
      context: "test",
      name: "John Doe",
      patient_name: "Jane Smith",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.name).toBe("[REDACTED]");
    expect(payload.patient_name).toBe("[REDACTED]");
  });

  it("should redact hostname from log metadata (A41)", () => {
    logger.info("DNS verification failed", {
      context: "dns",
      hostname: "clinic.example.com",
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.hostname).toBe("[REDACTED]");
    expect(payload.clinicId).toBe("clinic-123");
  });

  it("should hash R2 keys instead of full redaction (A41)", () => {
    const r2Key = "patient-files/clinic-123/patient-456/document.pdf";
    
    logger.info("File download attempt", {
      context: "r2",
      r2Key,
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.r2Key).toBe("[REDACTED]");
    expect(payload.r2KeyHash).toBeDefined();
    expect(typeof payload.r2KeyHash).toBe("string");
    expect(payload.r2KeyHash).toHaveLength(8);
    // Hash should be consistent for the same key
    expect(payload.r2KeyHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("should hash r2_key with underscore naming (A41)", () => {
    const r2Key = "backups/clinic-123/backup-2024.tar.gz";
    
    logger.info("Backup access", {
      context: "backup",
      r2_key: r2Key,
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.r2_key).toBe("[REDACTED]");
    expect(payload.r2_keyHash).toBeDefined();
    expect(typeof payload.r2_keyHash).toBe("string");
    expect(payload.r2_keyHash).toHaveLength(8);
  });

  it("should redact multiple PHI fields in a single log entry", () => {
    logger.info("Patient registration", {
      context: "registration",
      email: "patient@example.com",
      phone: "+212612345678",
      name: "John Doe",
      address: "123 Main St",
      dob: "1990-01-01",
      cin: "AB123456",
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.email).toBe("[REDACTED]");
    expect(payload.phone).toBe("[REDACTED]");
    expect(payload.name).toBe("[REDACTED]");
    expect(payload.address).toBe("[REDACTED]");
    expect(payload.dob).toBe("[REDACTED]");
    expect(payload.cin).toBe("[REDACTED]");
    expect(payload.clinicId).toBe("clinic-123"); // Safe UUID preserved
  });

  it("should redact PHI from nested objects", () => {
    logger.info("Nested PHI test", {
      context: "test",
      patient: {
        email: "patient@example.com",
        phone: "+212612345678",
        name: "John Doe",
      },
      clinicId: "clinic-123",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.patient.email).toBe("[REDACTED]");
    expect(payload.patient.phone).toBe("[REDACTED]");
    expect(payload.patient.name).toBe("[REDACTED]");
  });

  it("should redact PHI from arrays of objects", () => {
    logger.info("Array PHI test", {
      context: "test",
      patients: [
        { email: "patient1@example.com", name: "John Doe" },
        { email: "patient2@example.com", name: "Jane Smith" },
      ],
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.patients[0].email).toBe("[REDACTED]");
    expect(payload.patients[0].name).toBe("[REDACTED]");
    expect(payload.patients[1].email).toBe("[REDACTED]");
    expect(payload.patients[1].name).toBe("[REDACTED]");
  });

  it("should preserve safe identifiers (UUIDs, clinicId)", () => {
    logger.info("Safe identifiers test", {
      context: "test",
      clinicId: "clinic-123",
      patientId: "patient-456",
      appointmentId: "appt-789",
      userId: "user-abc",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.clinicId).toBe("clinic-123");
    expect(payload.patientId).toBe("patient-456");
    expect(payload.appointmentId).toBe("appt-789");
    expect(payload.userId).toBe("user-abc");
  });

  it("should handle case-insensitive PHI field matching", () => {
    logger.info("Case test", {
      context: "test",
      EMAIL: "patient@example.com",
      Phone: "+212612345678",
      NAME: "John Doe",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.EMAIL).toBe("[REDACTED]");
    expect(payload.Phone).toBe("[REDACTED]");
    expect(payload.NAME).toBe("[REDACTED]");
  });

  it("should redact additional PII patterns from A41", () => {
    logger.info("Additional PII test", {
      context: "test",
      full_name: "John Doe",
      doctor_name: "Dr. Smith",
      clinic_name: "Test Clinic",
      emergency_contact: "+212612345678",
      medical_history: "Diabetes",
      insurance_id: "INS123456",
      national_id: "NAT789",
      credit_card: "4111111111111111",
      bank_account: "ACC123456",
    });

    expect(loggedPayloads).toHaveLength(1);
    const payload = loggedPayloads[0];
    expect(payload.full_name).toBe("[REDACTED]");
    expect(payload.doctor_name).toBe("[REDACTED]");
    expect(payload.clinic_name).toBe("[REDACTED]");
    expect(payload.emergency_contact).toBe("[REDACTED]");
    expect(payload.medical_history).toBe("[REDACTED]");
    expect(payload.insurance_id).toBe("[REDACTED]");
    expect(payload.national_id).toBe("[REDACTED]");
    expect(payload.credit_card).toBe("[REDACTED]");
    expect(payload.bank_account).toBe("[REDACTED]");
  });
});
