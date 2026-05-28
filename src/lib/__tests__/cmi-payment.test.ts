import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const TEST_MERCHANT_ID = "test-merchant-456";
const TEST_SECRET_KEY = "test-secret-key-for-payment-creation";

describe("createCmiPayment", () => {
  beforeEach(() => {
    vi.stubEnv("CMI_MERCHANT_ID", TEST_MERCHANT_ID);
    vi.stubEnv("CMI_SECRET_KEY", TEST_SECRET_KEY);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns error when CMI is not configured", async () => {
    vi.stubEnv("CMI_MERCHANT_ID", "");
    vi.stubEnv("CMI_SECRET_KEY", "");
    vi.resetModules();

    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 500,
      orderId: "order-1",
      successUrl: "https://app.com/success",
      failUrl: "https://app.com/fail",
      callbackUrl: "https://app.com/callback",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("CMI is not configured");
    expect(result.formUrl).toBe("");
  });

  it("creates a valid payment request with required fields", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 250.5,
      orderId: "order-abc",
      successUrl: "https://app.oltigo.com/payment/success",
      failUrl: "https://app.oltigo.com/payment/fail",
      callbackUrl: "https://app.oltigo.com/api/payments/cmi/callback",
    });

    expect(result.success).toBe(true);
    expect(result.formUrl).toContain("cmi.co.ma");
    expect(result.formFields.clientid).toBe(TEST_MERCHANT_ID);
    expect(result.formFields.amount).toBe("250.50");
    expect(result.formFields.currency).toBe("504");
    expect(result.formFields.oid).toBe("order-abc");
    expect(result.formFields.TranType).toBe("PreAuth");
    expect(result.formFields.lang).toBe("fr");
    expect(result.formFields.hash).toBeTruthy();
    expect(result.formFields.encoding).toBe("UTF-8");
    expect(result.formFields.hashAlgorithm).toBe("ver3");
    expect(result.formFields.storeType).toBe("3D_PAY_HOSTING");
  });

  it("defaults currency to MAD (504) when not specified", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 100,
      orderId: "order-2",
      successUrl: "https://app.com/ok",
      failUrl: "https://app.com/fail",
      callbackUrl: "https://app.com/cb",
    });

    expect(result.formFields.currency).toBe("504");
  });

  it("uses custom currency when provided", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 100,
      orderId: "order-3",
      currency: "840",
      successUrl: "https://app.com/ok",
      failUrl: "https://app.com/fail",
      callbackUrl: "https://app.com/cb",
    });

    expect(result.formFields.currency).toBe("840");
  });

  it("includes customer info when provided", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 300,
      orderId: "order-4",
      customerName: "Ahmed Ben",
      customerEmail: "ahmed@clinic.com",
      description: "Consultation fee",
      successUrl: "https://app.com/ok",
      failUrl: "https://app.com/fail",
      callbackUrl: "https://app.com/cb",
    });

    expect(result.formFields.BillToName).toBe("Ahmed Ben");
    expect(result.formFields.email).toBe("ahmed@clinic.com");
    expect(result.formFields.description).toBe("Consultation fee");
  });

  it("adds metadata as rnd_ prefixed custom fields", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 100,
      orderId: "order-5",
      successUrl: "https://app.com/ok",
      failUrl: "https://app.com/fail",
      callbackUrl: "https://app.com/cb",
      metadata: { clinicId: "clinic-123", patientId: "patient-456" },
    });

    expect(result.formFields.rnd_clinicId).toBe("clinic-123");
    expect(result.formFields.rnd_patientId).toBe("patient-456");
  });

  it("extracts shop URL from success URL", async () => {
    const { createCmiPayment } = await import("@/lib/cmi");
    const result = await createCmiPayment({
      amount: 100,
      orderId: "order-6",
      successUrl: "https://app.oltigo.com/payment/success",
      failUrl: "https://app.oltigo.com/payment/fail",
      callbackUrl: "https://app.oltigo.com/api/callback",
    });

    expect(result.formFields.shopurl).toBe("https://app.oltigo.com");
  });
});

describe("isCmiConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns false when credentials are missing", async () => {
    vi.stubEnv("CMI_MERCHANT_ID", "");
    vi.stubEnv("CMI_SECRET_KEY", "");
    vi.resetModules();

    const { isCmiConfigured } = await import("@/lib/cmi");
    expect(isCmiConfigured()).toBe(false);
  });

  it("returns true when credentials are set", async () => {
    vi.stubEnv("CMI_MERCHANT_ID", "merchant-1");
    vi.stubEnv("CMI_SECRET_KEY", "secret-1");
    vi.resetModules();

    const { isCmiConfigured } = await import("@/lib/cmi");
    expect(isCmiConfigured()).toBe(true);
  });
});
