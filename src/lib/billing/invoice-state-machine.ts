/**
 * Invoice lifecycle state machine for Moroccan clinic billing.
 *
 * Enforces valid status transitions, computes insurance co-pay for the
 * `partially_paid` state, and emits structured audit context for every
 * transition. Keeps the payment/insurance flow explicit:
 *
 *   draft → sent → partially_paid (insurance pending) → paid
 *                 \-> paid
 *                 \-> overdue
 *                 \-> cancelled
 *
 * This is Lane-A safe because it does NOT submit insurance claims; it only
 * records the patient and insurance portions on the invoice.
 */

import { calculateInsuranceCoPay } from "@/lib/billing/insurance-copay";
import type { MoroccanInsuranceType } from "@/lib/insurance/client";
import { logger } from "@/lib/logger";
import type { Json } from "@/lib/types/database";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled"
  | "refunded";

export interface InvoiceState {
  id: string;
  status: InvoiceStatus;
  totalCentimes: number;
  amountPaidCentimes: number;
  paymentMethod: string | null;
  insuranceType: string | null;
  insuranceRef: string | null;
  invoiceNumber: string;
  clinicId: string;
}

export interface InvoiceTransitionInput {
  targetStatus: InvoiceStatus;
  /** Manual payment amount already received, in centimes. */
  amountPaidCentimes?: number;
  /** Patient insurance policy number (used for eligibility check). */
  policyNumber?: string;
  actorId?: string;
}

interface InvoiceTransitionResult {
  updateFields: Record<string, unknown>;
  audit: {
    action: string;
    description: string;
    metadata: Record<string, Json | undefined>;
  };
}

interface InvoiceTransitionResultOrError {
  ok: true;
  result: InvoiceTransitionResult;
}

interface InvoiceTransitionError {
  ok: false;
  error: string;
  code?: string;
}

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["paid", "partially_paid", "overdue", "cancelled"],
  partially_paid: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "partially_paid", "cancelled"],
  paid: ["refunded"],
  refunded: [],
  cancelled: [],
};

function isValidTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

function madToCentimes(mad: number): number {
  return Math.round(mad * 100);
}

function centimesToMad(centimes: number): number {
  return Math.round(centimes) / 100;
}

export function transitionInvoiceStatus(
  invoice: InvoiceState,
  input: InvoiceTransitionInput,
): InvoiceTransitionResultOrError | InvoiceTransitionError {
  const { targetStatus, amountPaidCentimes: requestedAmountPaid, policyNumber } = input;

  if (!isValidTransition(invoice.status, targetStatus)) {
    return {
      ok: false,
      error: `Invalid invoice transition: ${invoice.status} → ${targetStatus}`,
      code: "INVOICE_INVALID_TRANSITION",
    };
  }

  const updateFields: Record<string, unknown> = { status: targetStatus };
  const metadata: Record<string, Json | undefined> = {
    invoice_id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    from_status: invoice.status,
    to_status: targetStatus,
  };

  if (targetStatus === "sent") {
    updateFields.sent_at = new Date().toISOString();
  }

  if (targetStatus === "paid") {
    let finalPaid = requestedAmountPaid ?? invoice.totalCentimes;

    // If transitioning from partially_paid with insurance, assume the claim
    // has been approved and the invoice is now fully paid.
    if (invoice.status === "partially_paid" && invoice.paymentMethod === "insurance") {
      finalPaid = invoice.totalCentimes;
    }

    if (finalPaid < invoice.totalCentimes) {
      return {
        ok: false,
        error: `Cannot mark invoice as paid: amount paid (${finalPaid} centimes) is less than total (${invoice.totalCentimes} centimes)`,
        code: "INVOICE_UNDERPAID",
      };
    }

    updateFields.amount_paid_centimes = invoice.totalCentimes;
    updateFields.paid_at = new Date().toISOString();
    metadata.amount_paid_centimes = invoice.totalCentimes;
  }

  if (targetStatus === "partially_paid") {
    // Insurance-driven partial payment: compute patient vs insurance portions.
    if (
      invoice.paymentMethod === "insurance" &&
      invoice.insuranceType &&
      invoice.totalCentimes > 0
    ) {
      const effectivePolicyNumber = policyNumber || invoice.insuranceRef;
      if (!effectivePolicyNumber) {
        return {
          ok: false,
          error:
            "Insurance policy number is required for partially_paid. Provide policy_number or set insurance_ref.",
          code: "INVOICE_MISSING_POLICY_NUMBER",
        };
      }

      return {
        ok: true,
        result: {
          updateFields: {},
          audit: {
            action: "invoice.status_changing",
            description: "Initiating insurance co-pay calculation",
            metadata: {
              ...metadata,
              insurance_type: invoice.insuranceType,
              policy_number: effectivePolicyNumber,
            },
          },
        },
      };
    }

    if (invoice.paymentMethod === "insurance" && !invoice.insuranceType) {
      return {
        ok: false,
        error: "insurance_type is required to transition an insurance invoice to partially_paid",
        code: "INVOICE_MISSING_INSURANCE_TYPE",
      };
    }

    // Manual partial payment: require explicit amount.
    if (requestedAmountPaid === undefined) {
      return {
        ok: false,
        error: "amount_paid_centimes is required to transition invoice to partially_paid",
        code: "INVOICE_MISSING_AMOUNT_PAID",
      };
    }

    if (requestedAmountPaid <= 0) {
      return {
        ok: false,
        error: "amount_paid_centimes must be greater than 0 for partially_paid",
        code: "INVOICE_INVALID_AMOUNT_PAID",
      };
    }

    if (requestedAmountPaid >= invoice.totalCentimes) {
      return {
        ok: false,
        error: "Use status 'paid' when the full invoice amount is received",
        code: "INVOICE_USE_PAID_STATUS",
      };
    }

    updateFields.amount_paid_centimes = requestedAmountPaid;
    metadata.amount_paid_centimes = requestedAmountPaid;
  }

  if (targetStatus === "refunded") {
    if (invoice.status !== "paid") {
      return {
        ok: false,
        error: "Only paid invoices can be refunded",
        code: "INVOICE_NOT_PAID",
      };
    }
    updateFields.paid_at = null;
    updateFields.amount_paid_centimes = 0;
  }

  return {
    ok: true,
    result: {
      updateFields,
      audit: {
        action: "invoice.status_changed",
        description: `Invoice ${invoice.invoiceNumber} transitioned ${invoice.status} → ${targetStatus}`,
        metadata,
      },
    },
  };
}

/**
 * Compute the patient/insurance split for an insurance invoice and return
 * update fields for the `partially_paid` state.
 *
 * This is separated from `transitionInvoiceStatus` because eligibility lookup
 * is async and should be awaited by the caller.
 */
export async function computeInsurancePartialPayment(
  invoice: InvoiceState,
  policyNumber: string,
): Promise<{
  updateFields: Record<string, unknown>;
  audit: {
    action: string;
    description: string;
    metadata: Record<string, Json | undefined>;
  };
}> {
  const totalAmount = centimesToMad(invoice.totalCentimes);

  const coPay = await calculateInsuranceCoPay({
    totalAmount,
    policyNumber,
    insuranceType: invoice.insuranceType as MoroccanInsuranceType,
    clinicId: invoice.clinicId,
  });

  const amountPaidCentimes = madToCentimes(coPay.patientPayAmount);
  const insuranceCoveredCentimes = madToCentimes(coPay.insuranceCoveredAmount);

  if (
    coPay.patientPayAmount <= 0 ||
    coPay.patientPayAmount >= totalAmount ||
    coPay.insuranceCoveredAmount >= totalAmount
  ) {
    return {
      updateFields: {
        status: "paid",
        amount_paid_centimes: invoice.totalCentimes,
        paid_at: new Date().toISOString(),
      },
      audit: {
        action: "invoice.status_changed",
        description: `Invoice ${invoice.invoiceNumber} paid in full (insurance coverage ${coPay.coveragePercentage}%)`,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          from_status: invoice.status,
          to_status: "paid",
          amount_paid_centimes: invoice.totalCentimes,
          insurance_covered_centimes: insuranceCoveredCentimes,
          coverage_percentage: coPay.coveragePercentage,
        },
      },
    };
  }

  logger.info("Invoice partially paid — insurance pending", {
    context: "billing/invoice-state-machine",
    invoiceId: invoice.id,
    clinicId: invoice.clinicId,
    insuranceType: invoice.insuranceType,
    coveragePercentage: coPay.coveragePercentage,
    patientPayCentimes: amountPaidCentimes,
    insuranceCoveredCentimes,
  });

  return {
    updateFields: {
      status: "partially_paid",
      amount_paid_centimes: amountPaidCentimes,
    },
    audit: {
      action: "invoice.status_changed",
      description: `Invoice ${invoice.invoiceNumber} partially paid — insurance covers ${coPay.coveragePercentage}%`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        from_status: invoice.status,
        to_status: "partially_paid",
        insurance_type: invoice.insuranceType,
        policy_number: policyNumber,
        coverage_percentage: coPay.coveragePercentage,
        co_pay_percentage: coPay.coPayPercentage,
        amount_paid_centimes: amountPaidCentimes,
        insurance_covered_centimes: insuranceCoveredCentimes,
        total_centimes: invoice.totalCentimes,
      },
    },
  };
}
