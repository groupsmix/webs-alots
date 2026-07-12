import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  transitionInvoiceStatus,
  computeInsurancePartialPayment,
  type InvoiceState,
} from "@/lib/billing/invoice-state-machine";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const baseInvoice: InvoiceState = {
  id: "inv-1",
  status: "draft",
  totalCentimes: 10000, // 100 MAD
  amountPaidCentimes: 0,
  paymentMethod: null,
  insuranceType: null,
  insuranceRef: null,
  invoiceNumber: "INV-20260101-0001",
  clinicId: "clinic-1",
};

const originalEnv = { ...process.env };

describe("transitionInvoiceStatus", () => {
  beforeEach(() => {
    process.env.INSURANCE_PROVIDER = "sandbox";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows draft → sent", () => {
    const result = transitionInvoiceStatus(baseInvoice, { targetStatus: "sent" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.updateFields.status).toBe("sent");
    expect(result.result.updateFields.sent_at).toBeDefined();
    expect(result.result.audit.action).toBe("invoice.status_changed");
  });

  it("allows sent → paid with full amount", () => {
    const invoice = { ...baseInvoice, status: "sent" as const };
    const result = transitionInvoiceStatus(invoice, { targetStatus: "paid" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.updateFields.status).toBe("paid");
    expect(result.result.updateFields.amount_paid_centimes).toBe(10000);
    expect(result.result.updateFields.paid_at).toBeDefined();
  });

  it("rejects paid when amount is less than total", () => {
    const invoice = { ...baseInvoice, status: "sent" as const };
    const result = transitionInvoiceStatus(invoice, {
      targetStatus: "paid",
      amountPaidCentimes: 5000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_UNDERPAID");
  });

  it("rejects invalid transitions", () => {
    const invoice = { ...baseInvoice, status: "paid" as const };
    const result = transitionInvoiceStatus(invoice, { targetStatus: "sent" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_INVALID_TRANSITION");
  });

  it("allows paid → refunded", () => {
    const invoice = { ...baseInvoice, status: "paid" as const, amountPaidCentimes: 10000 };
    const result = transitionInvoiceStatus(invoice, { targetStatus: "refunded" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.updateFields.status).toBe("refunded");
    expect(result.result.updateFields.paid_at).toBeNull();
    expect(result.result.updateFields.amount_paid_centimes).toBe(0);
  });

  it("allows manual partially_paid with explicit amount", () => {
    const invoice = { ...baseInvoice, status: "sent" as const };
    const result = transitionInvoiceStatus(invoice, {
      targetStatus: "partially_paid",
      amountPaidCentimes: 4000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result.updateFields.status).toBe("partially_paid");
    expect(result.result.updateFields.amount_paid_centimes).toBe(4000);
  });

  it("rejects manual partially_paid without amount", () => {
    const invoice = { ...baseInvoice, status: "sent" as const };
    const result = transitionInvoiceStatus(invoice, { targetStatus: "partially_paid" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_MISSING_AMOUNT_PAID");
  });

  it("rejects partially_paid when amount equals total", () => {
    const invoice = { ...baseInvoice, status: "sent" as const };
    const result = transitionInvoiceStatus(invoice, {
      targetStatus: "partially_paid",
      amountPaidCentimes: 10000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_USE_PAID_STATUS");
  });

  it("rejects partially_paid for insurance invoice without policy number", () => {
    const invoice = {
      ...baseInvoice,
      status: "sent" as const,
      paymentMethod: "insurance" as const,
      insuranceType: "CNSS" as const,
    };
    const result = transitionInvoiceStatus(invoice, { targetStatus: "partially_paid" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVOICE_MISSING_POLICY_NUMBER");
  });
});

describe("computeInsurancePartialPayment", () => {
  beforeEach(() => {
    process.env.INSURANCE_PROVIDER = "sandbox";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("computes CNSS patient pay (30%) for sent invoice", async () => {
    const invoice: InvoiceState = {
      ...baseInvoice,
      status: "sent",
      paymentMethod: "insurance",
      insuranceType: "CNSS",
      insuranceRef: "123456789",
    };
    const result = await computeInsurancePartialPayment(invoice, "123456789");
    expect(result.updateFields.status).toBe("partially_paid");
    expect(result.updateFields.amount_paid_centimes).toBe(3000); // 30 MAD
    expect(result.audit.metadata.coverage_percentage).toBe(70);
    expect(result.audit.metadata.co_pay_percentage).toBe(30);
  });

  it("computes RAMED 100% coverage and marks paid", async () => {
    const invoice: InvoiceState = {
      ...baseInvoice,
      status: "sent",
      paymentMethod: "insurance",
      insuranceType: "RAMED",
      insuranceRef: "123456789",
    };
    const result = await computeInsurancePartialPayment(invoice, "123456789");
    expect(result.updateFields.status).toBe("paid");
    expect(result.updateFields.amount_paid_centimes).toBe(10000);
  });

  it("falls back to paid when eligibility fails", async () => {
    const invoice: InvoiceState = {
      ...baseInvoice,
      status: "sent",
      paymentMethod: "insurance",
      insuranceType: "CNSS",
      insuranceRef: "1234",
    };
    const result = await computeInsurancePartialPayment(invoice, "1234");
    expect(result.updateFields.status).toBe("paid");
    expect(result.updateFields.amount_paid_centimes).toBe(10000);
  });
});
