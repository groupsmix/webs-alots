import { describe, it, expect } from "vitest";
import {
  containsPotentialPHI,
  sanitizeErrorMessage,
  safeLogContext,
  DEPLOYMENT_SECURITY_CHECKLIST,
} from "../phi-compliance";

describe("containsPotentialPHI", () => {
  it("detects date-of-birth patterns", () => {
    expect(containsPotentialPHI("Patient born on 15/03/1990")).toBe(true);
  });

  it("detects national ID patterns", () => {
    expect(containsPotentialPHI("CIN: AB123456")).toBe(true);
  });

  it("returns false for safe text", () => {
    expect(containsPotentialPHI("Error processing request")).toBe(false);
  });

  it("returns false for UUIDs (opaque identifiers are safe)", () => {
    expect(containsPotentialPHI("Record a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(false);
  });
});

describe("sanitizeErrorMessage", () => {
  it("returns generic message when PHI detected", () => {
    const result = sanitizeErrorMessage("Patient born 15/03/1990 not found");
    expect(result).toBe("Une erreur s'est produite. Veuillez réessayer.");
  });

  it("passes through safe messages", () => {
    const result = sanitizeErrorMessage("Appointment not found");
    expect(result).toBe("Appointment not found");
  });
});

describe("safeLogContext", () => {
  it("only keeps safe keys (IDs, action, type, context, status)", () => {
    const result = safeLogContext({
      id: "abc-123",
      patientId: "p-456",
      clinicId: "c-789",
      patientName: "Karim",
      dateOfBirth: "1990-03-15",
      diagnosis: "Diabète",
      action: "read",
      status: "completed",
    });

    expect(result).toEqual({
      id: "abc-123",
      patientId: "p-456",
      clinicId: "c-789",
      action: "read",
      status: "completed",
    });

    expect(result).not.toHaveProperty("patientName");
    expect(result).not.toHaveProperty("dateOfBirth");
    expect(result).not.toHaveProperty("diagnosis");
  });

  it("returns empty object for no safe keys", () => {
    const result = safeLogContext({
      name: "Test",
      email: "test@example.com",
    });
    expect(result).toEqual({});
  });
});

describe("DEPLOYMENT_SECURITY_CHECKLIST", () => {
  it("has at least 10 check items", () => {
    expect(DEPLOYMENT_SECURITY_CHECKLIST.length).toBeGreaterThanOrEqual(10);
  });

  it("all items have required fields", () => {
    for (const item of DEPLOYMENT_SECURITY_CHECKLIST) {
      expect(item.id).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(typeof item.critical).toBe("boolean");
    }
  });

  it("includes PHI category items", () => {
    const phiItems = DEPLOYMENT_SECURITY_CHECKLIST.filter((i) => i.category === "PHI");
    expect(phiItems.length).toBeGreaterThanOrEqual(3);
  });
});
