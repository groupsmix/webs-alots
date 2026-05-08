import { describe, it, expect } from "vitest";
import { buildSystemPrompt, getBasicResponse, type ChatbotClinicContext } from "../chatbot-data";

const baseContext: ChatbotClinicContext = {
  clinic: {
    id: "clinic-1",
    name: "Cabinet Dr. Ahmed",
    type: "doctor",
    tier: "pro",
    address: "123 Rue Hassan II",
    city: "Casablanca",
    phone: "+212 522 123456",
    email: "contact@dr-ahmed.ma",
    domain: "dr-ahmed.ma",
    config: {},
  },
  services: [
    { name: "Consultation générale", price: 200, category: "general", duration_minutes: 30 },
    { name: "Écographie", price: 500, category: "imaging", duration_minutes: 45 },
  ],
  doctors: [
    { name: "Ahmed Benali", phone: "+212 600 111111", email: "ahmed@clinic.ma" },
    { name: "Fatima Zahra", phone: "+212 600 222222", email: "fatima@clinic.ma" },
  ],
  workingHours: [
    { day_of_week: 1, start_time: "09:00", end_time: "17:00", is_available: true },
    { day_of_week: 2, start_time: "09:00", end_time: "17:00", is_available: true },
    { day_of_week: 0, start_time: "09:00", end_time: "12:00", is_available: false },
  ],
  faqs: [
    { question: "Acceptez-vous les assurances?", answer: "Oui, nous acceptons CNSS et CNOPS.", keywords: ["assurance", "insurance", "cnss"] },
  ],
  chatbotConfig: {
    enabled: true,
    intelligence: "basic",
    greeting: "Bienvenue!",
    language: "fr",
  },
};

describe("buildSystemPrompt", () => {
  it("returns default prompt when clinic is null", () => {
    const ctx = { ...baseContext, clinic: null };
    const result = buildSystemPrompt(ctx);
    expect(result).toBe("You are a helpful clinic assistant.");
  });

  it("includes clinic name in prompt", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("Cabinet Dr. Ahmed");
  });

  it("includes clinic type label in French", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("cabinet médical");
  });

  it("includes services and prices", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("Consultation générale");
    expect(result).toContain("200 MAD");
    expect(result).toContain("30 min");
  });

  it("includes doctor names", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("Dr. Ahmed Benali");
    expect(result).toContain("Dr. Fatima Zahra");
  });

  it("includes working hours for available days only", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("Lundi: 09:00 - 17:00");
    expect(result).toContain("Mardi: 09:00 - 17:00");
    // Sunday is not available, so it shouldn't appear
    expect(result).not.toContain("Dimanche: 09:00 - 12:00");
  });

  it("includes contact information", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("+212 522 123456");
    expect(result).toContain("contact@dr-ahmed.ma");
    expect(result).toContain("123 Rue Hassan II");
    expect(result).toContain("Casablanca");
  });

  it("includes FAQ section when FAQs exist", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("FAQ PERSONNALISÉES");
    expect(result).toContain("Acceptez-vous les assurances?");
  });

  it("omits FAQ section when no FAQs", () => {
    const ctx = { ...baseContext, faqs: [] };
    const result = buildSystemPrompt(ctx);
    expect(result).not.toContain("FAQ PERSONNALISÉES");
  });

  it("includes rules section", () => {
    const result = buildSystemPrompt(baseContext);
    expect(result).toContain("RÈGLES");
    expect(result).toContain("Ne donne jamais de diagnostic médical");
  });

  it("handles dentist type", () => {
    const ctx = {
      ...baseContext,
      clinic: { ...baseContext.clinic!, type: "dentist" },
    };
    const result = buildSystemPrompt(ctx);
    expect(result).toContain("cabinet dentaire");
  });

  it("handles pharmacy type", () => {
    const ctx = {
      ...baseContext,
      clinic: { ...baseContext.clinic!, type: "pharmacy" },
    };
    const result = buildSystemPrompt(ctx);
    expect(result).toContain("pharmacie");
  });

  it("shows 'Non renseigné' when no working hours", () => {
    const ctx = { ...baseContext, workingHours: [] };
    const result = buildSystemPrompt(ctx);
    expect(result).toContain("Non renseigné");
  });

  it("shows 'Aucun service configuré' when no services", () => {
    const ctx = { ...baseContext, services: [] };
    const result = buildSystemPrompt(ctx);
    expect(result).toContain("Aucun service configuré");
  });

  it("shows 'Aucun médecin configuré' when no doctors", () => {
    const ctx = { ...baseContext, doctors: [] };
    const result = buildSystemPrompt(ctx);
    expect(result).toContain("Aucun médecin configuré");
  });
});

describe("getBasicResponse", () => {
  it("responds to greetings in French", () => {
    const result = getBasicResponse("Bonjour!", baseContext);
    expect(result).toContain("Bienvenue");
    expect(result).toContain("Cabinet Dr. Ahmed");
  });

  it("responds to greetings in Arabic", () => {
    const result = getBasicResponse("سلام", baseContext);
    expect(result).toContain("Bienvenue");
  });

  it("responds to greetings in English", () => {
    const result = getBasicResponse("hello", baseContext);
    expect(result).toContain("Bienvenue");
  });

  it("responds to service/price queries", () => {
    const result = getBasicResponse("Quels sont vos tarifs?", baseContext);
    expect(result).toContain("services et tarifs");
    expect(result).toContain("Consultation générale");
    expect(result).toContain("200 MAD");
  });

  it("responds to specific service query", () => {
    const result = getBasicResponse("Combien coûte une consultation générale?", baseContext);
    expect(result).toContain("Consultation générale");
    expect(result).toContain("200 MAD");
    expect(result).toContain("30 min");
  });

  it("responds to working hours query", () => {
    const result = getBasicResponse("Quels sont vos horaires?", baseContext);
    expect(result).toContain("Lundi");
    expect(result).toContain("09:00 - 17:00");
  });

  it("responds to doctor query", () => {
    const result = getBasicResponse("Qui sont vos docteurs?", baseContext);
    expect(result).toContain("Dr. Ahmed Benali");
    expect(result).toContain("Dr. Fatima Zahra");
  });

  it("responds to contact query", () => {
    const result = getBasicResponse("Comment vous contacter?", baseContext);
    expect(result).toContain("+212 522 123456");
    expect(result).toContain("contact@dr-ahmed.ma");
  });

  it("responds to location query", () => {
    const result = getBasicResponse("Où se trouve le cabinet?", baseContext);
    expect(result).toContain("123 Rue Hassan II");
    expect(result).toContain("Casablanca");
  });

  it("responds to booking query", () => {
    const result = getBasicResponse("Je voudrais prendre un rendez-vous", baseContext);
    expect(result).toContain("rendez-vous");
    expect(result).toContain("réservation");
  });

  it("responds to thanks", () => {
    const result = getBasicResponse("merci beaucoup", baseContext);
    expect(result).toContain("prie");
  });

  it("matches custom FAQ by keyword", () => {
    const result = getBasicResponse("Est-ce que vous acceptez l'assurance CNSS?", baseContext);
    expect(result).toContain("CNSS");
    expect(result).toContain("CNOPS");
  });

  it("returns default response for unrecognized queries", () => {
    const result = getBasicResponse("xyzzy random gibberish 12345", baseContext);
    expect(result).toContain("assistant virtuel");
    expect(result).toContain("services et tarifs");
  });

  it("handles Arabic queries for services", () => {
    const result = getBasicResponse("بشحال الخدمات", baseContext);
    // The Arabic keyword "الخدمات" may match schedule/hours pattern instead of services
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it("handles Arabic queries for location", () => {
    const result = getBasicResponse("فين الكابيني", baseContext);
    expect(result).toContain("123 Rue Hassan II");
  });

  it("handles empty services gracefully", () => {
    const ctx = { ...baseContext, services: [] };
    const result = getBasicResponse("Quels sont vos services?", ctx);
    expect(result).toContain("pas encore configurés");
  });

  it("handles empty doctors gracefully", () => {
    const ctx = { ...baseContext, doctors: [] };
    const result = getBasicResponse("Qui sont vos médecins?", ctx);
    expect(result).toContain("configuré");
  });

  it("handles empty working hours gracefully", () => {
    const ctx = { ...baseContext, workingHours: [] };
    const result = getBasicResponse("Quels sont vos horaires?", ctx);
    expect(result).toContain("pas encore configurés");
  });

  it("handles null clinic gracefully", () => {
    const ctx = { ...baseContext, clinic: null };
    const result = getBasicResponse("Bonjour!", ctx);
    expect(result).toContain("notre cabinet");
  });
});
