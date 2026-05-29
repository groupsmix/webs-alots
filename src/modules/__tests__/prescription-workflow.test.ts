import { describe, it, expect } from "vitest";
import { isValidTransition, type PrescriptionStatus } from "@/modules/prescription/workflow";

describe("isValidTransition", () => {
  const validTransitions: [PrescriptionStatus, PrescriptionStatus][] = [
    ["draft", "pending_review"],
    ["draft", "cancelled"],
    ["pending_review", "approved"],
    ["pending_review", "rejected"],
    ["approved", "dispensed"],
    ["approved", "cancelled"],
    ["rejected", "draft"],
    ["dispensed", "completed"],
    ["cancelled", "draft"],
  ];

  it.each(validTransitions)("allows %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  const invalidTransitions: [PrescriptionStatus, PrescriptionStatus][] = [
    ["draft", "approved"],
    ["draft", "dispensed"],
    ["draft", "completed"],
    ["pending_review", "dispensed"],
    ["pending_review", "completed"],
    ["approved", "pending_review"],
    ["approved", "rejected"],
    ["dispensed", "draft"],
    ["dispensed", "cancelled"],
    ["completed", "draft"],
    ["completed", "dispensed"],
    ["completed", "cancelled"],
  ];

  it.each(invalidTransitions)("rejects %s → %s", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });
});
