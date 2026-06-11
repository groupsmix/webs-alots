/**
 * AUDIT P0-3 regression tests for PHI pseudonymisation.
 *
 * The original implementation derived name pseudonyms from
 * `forward.size % 8`, which collided once more than 8 fields were mapped
 * (or when non-name fields advanced the counter). A collision overwrote the
 * reverse map, so `depseudonymise()` substituted the WRONG patient's name
 * into AI output — a patient-safety bug, not just a privacy one.
 */

import { describe, expect, it } from "vitest";
import { createPseudonymMap, depseudonymise, pseudonymise } from "@/lib/ai/pseudonymise";

describe("pseudonymise", () => {
  it("assigns unique pseudonyms to many distinct patient names", () => {
    const map = createPseudonymMap();
    const patients = Array.from({ length: 12 }, (_, i) => ({
      name: `Patient Réel ${i}`,
      phone: `+2126000000${String(i).padStart(2, "0")}`,
      email: `p${i}@example.com`,
    }));

    const out = patients.map((p) => pseudonymise(p, map));
    const pseudonyms = out.map((o) => o.name as string);

    // All 12 names must map to 12 DISTINCT pseudonyms
    expect(new Set(pseudonyms).size).toBe(12);
    // And none of the real names may appear in the pseudonymised output
    for (const o of out) {
      expect(JSON.stringify(o)).not.toContain("Patient Réel");
    }
  });

  it("round-trips the correct name for every patient via depseudonymise", () => {
    const map = createPseudonymMap();
    const patients = Array.from({ length: 10 }, (_, i) => ({ name: `Personne-${i}` }));
    const out = patients.map((p) => pseudonymise(p, map));

    for (let i = 0; i < patients.length; i++) {
      const aiText = `Le patient ${out[i]!.name as string} doit revenir dans 3 mois.`;
      const restored = depseudonymise(aiText, map);
      expect(restored).toContain(`Personne-${i}`);
      // Must NOT restore any other patient's name
      for (let j = 0; j < patients.length; j++) {
        if (j !== i) expect(restored).not.toContain(`Personne-${j}`);
      }
    }
  });

  it("is stable: the same name always gets the same pseudonym", () => {
    const map = createPseudonymMap();
    const a = pseudonymise({ name: "Amina Alaoui" }, map);
    const b = pseudonymise({ name: "Amina Alaoui" }, map);
    expect(a.name).toBe(b.name);
  });

  it("pseudonymises date-of-birth fields (PHI) while preserving age", () => {
    const map = createPseudonymMap();
    const dob = "1990-03-15";
    const out = pseudonymise({ name: "Test", date_of_birth: dob, dob }, map);

    expect(out.date_of_birth).not.toContain("1990");
    expect(out.dob).not.toContain("1990");
    // Age is preserved in the token for clinical utility (dosing etc.)
    expect(String(out.date_of_birth)).toMatch(/^DOB-\d{1,3}ans-/);
    // Reversible
    const restored = depseudonymise(String(out.date_of_birth), map);
    expect(restored).toBe(dob);
  });

  it("handles unparseable DOB values without leaking them", () => {
    const map = createPseudonymMap();
    const out = pseudonymise({ birth_date: "le quinze mars" }, map);
    expect(String(out.birth_date)).toMatch(/^DOB-XXXX-/);
  });

  it("pseudonymises nested objects and arrays", () => {
    const map = createPseudonymMap();
    const out = pseudonymise(
      {
        patient: { name: "Karim Benani", cin: "AB123456" },
        contacts: [{ phone: "+212600000001" }],
      },
      map,
    );
    const json = JSON.stringify(out);
    expect(json).not.toContain("Karim Benani");
    expect(json).not.toContain("AB123456");
    expect(json).not.toContain("+212600000001");
  });

  it("never maps two distinct real values to the same pseudonym", () => {
    const map = createPseudonymMap();
    for (let i = 0; i < 50; i++) {
      pseudonymise({ name: `N-${i}`, phone: `+21260${i}`, email: `e${i}@x.ma` }, map);
    }
    // reverse map size must equal forward map size — no overwrites
    expect(map.reverse.size).toBe(map.forward.size);
  });
});
